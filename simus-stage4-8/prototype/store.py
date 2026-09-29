"""PostgreSQL application service. All clocks and commit gates live in PostgreSQL."""
import hashlib
import secrets
import uuid
from contextlib import contextmanager
from decimal import Decimal, InvalidOperation

import psycopg
from psycopg.rows import dict_row
from content import classify


class Problem(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message
        super().__init__(message)


def ident(value):
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        raise Problem(400, '올바른 UUID가 필요해요.') from None


def token_hash(token):
    return hashlib.sha256((token or '').encode()).hexdigest()


class Store:
    def __init__(self, dsn, admin_id):
        self.dsn, self.admin_id = dsn, ident(admin_id)

    @contextmanager
    def tx(self):
        db = None
        try:
            db = psycopg.connect(self.dsn, row_factory=dict_row, connect_timeout=5)
            with db:
                db.execute("SET LOCAL search_path=simus,pg_catalog")
                db.execute("SET LOCAL statement_timeout='10s'")
                db.execute("SET LOCAL lock_timeout='5s'")
                yield db
        except psycopg.errors.NoDataFound:
            raise Problem(409, '종료 시각 또는 종료 승인 전에 저장을 마치지 못해 선택을 취소했어요.') from None
        except psycopg.errors.UniqueViolation:
            raise Problem(409, '이미 처리된 요청이거나 진행 중인 회차가 있어요.') from None
        except (psycopg.errors.LockNotAvailable, psycopg.errors.QueryCanceled):
            raise Problem(503, '처리가 지연되고 있어요. 같은 요청 번호로 다시 시도해 주세요.') from None
        finally:
            if db is not None:
                db.close()  # Also close when a deferred trigger rejects COMMIT.

    @staticmethod
    def now(db):
        return db.execute('SELECT clock_timestamp() AS now').fetchone()['now']

    @staticmethod
    def gate(db, rid):
        db.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,0))', (str(rid),))

    def _admin(self, db):
        if not db.execute('SELECT 1 FROM admin_users WHERE id=%s AND is_active', (self.admin_id,)).fetchone():
            raise Problem(403, '활성 관리자 계정이 필요해요.')

    def _round(self, db, rid=None, lock=False):
        suffix = ' FOR NO KEY UPDATE' if lock else ''
        r = db.execute('SELECT * FROM simulation_sessions WHERE id=%s'+suffix, (ident(rid),)).fetchone() if rid else db.execute(
            "SELECT * FROM simulation_sessions WHERE status<>'DRAFT' ORDER BY starts_at DESC,id DESC LIMIT 1"+suffix).fetchone()
        if not r:
            raise Problem(404, '회차를 찾을 수 없어요.')
        return r

    def _visitor(self, db, token):
        row = db.execute('SELECT participant_id FROM participant_credentials WHERE token_hash=%s AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>clock_timestamp())', (token_hash(token),)).fetchone()
        if not row:
            raise Problem(401, '먼저 참여해 주세요. 인증이 만료되었을 수 있어요.')
        return row['participant_id']

    def _open(self, db, r, received=None):
        from datetime import timedelta
        now = self.now(db)
        if r['status'] != 'RUNNING' or (received or now) >= r['scheduled_end_at']-timedelta(seconds=5) or now >= r['scheduled_end_at'] or db.execute('SELECT 1 FROM session_closures WHERE session_id=%s',(r['id'],)).fetchone():
            raise Problem(409, '종료 준비 중으로 선택이 반영되지 않았어요.')

    def start(self, duration=300, scale=0.1):
        if isinstance(duration, bool) or not isinstance(duration, int) or not 10<=duration<=86400:
            raise Problem(400, '회차 길이는 정수 10초~24시간이어야 해요.')
        try:
            scale = Decimal(str(scale))
            if not scale.is_finite() or not 0<=scale<=1 or scale.as_tuple().exponent < -10:
                raise ValueError()
        except (InvalidOperation, ValueError):
            raise Problem(400, '보정 계수는 소수점 10자리 이내의 0~1이어야 해요.') from None
        self.tick()
        with self.tx() as db:
            self._admin(db)
            db.execute('SELECT pg_advisory_xact_lock(73918001)')
            if db.execute("SELECT 1 FROM simulation_sessions WHERE status IN ('RUNNING','CLOSING')").fetchone():
                raise Problem(409, '현재 회차를 먼저 종료해 주세요.')
            rid = db.execute("INSERT INTO simulation_sessions(name,scheduled_end_at,expected_participants,expected_answers_per_person,impact_scale,created_by_admin_id) VALUES('연결 테스트',clock_timestamp()+%s*interval '1 second',2,1,%s,%s) RETURNING id",(duration,scale,self.admin_id)).fetchone()['id']
            region = db.execute("INSERT INTO session_regions(session_id,code,name) VALUES(%s,'WEST_WASTE','학교 서쪽 · 분리배출함') RETURNING id",(rid,)).fetchone()['id']
            situation = db.execute("INSERT INTO session_situations(session_id,code,title,body) VALUES(%s,'WASTE','분리배출함 옆의 쓰레기','분리배출함 옆에 쓰레기가 흩어져 있습니다. 어떻게 행동할까요?') RETURNING id",(rid,)).fetchone()['id']
            a = db.execute("INSERT INTO session_choices(session_id,situation_id,label,importance,alignment_dx,alignment_dy,happiness_base,cleanliness_base,display_order) VALUES(%s,%s,'공동 분리배출 규칙에 맞춰 쓰레기를 정리한다.','NORMAL',1,1,3,5,1) RETURNING id",(rid,situation)).fetchone()['id']
            db.execute("INSERT INTO session_choices(session_id,situation_id,label,importance,display_order) VALUES(%s,%s,'쓰레기를 건드리지 않고 지나간다.','NORMAL',2)",(rid,situation))
            db.execute('INSERT INTO choice_region_effects VALUES(%s,%s,%s,%s,-5)',(rid,situation,a,region))
            db.execute('INSERT INTO city_states(session_id) VALUES(%s)',(rid,))
            db.execute('INSERT INTO region_states(session_id,region_id) VALUES(%s,%s)',(rid,region))
            # All content and initial rows are created before this transition.
            db.execute("UPDATE simulation_sessions SET status='RUNNING',starts_at=clock_timestamp(),scheduled_end_at=clock_timestamp()+%s*interval '1 second' WHERE id=%s",(duration,rid))
        return self.state(str(rid))['round']

    def approve_close(self, rid, manual=False):
        rid=ident(rid)
        with self.tx() as db:
            if manual:
                self._admin(db)
            self.gate(db,rid)
            r=self._round(db,rid)
            if r['status']=='DRAFT':
                raise Problem(409,'시작하지 않은 회차예요.')
            now=self.now(db)
            if not manual and now<r['scheduled_end_at']:
                return
            mode='AUTO' if now>=r['scheduled_end_at'] else 'MANUAL'
            db.execute('INSERT INTO session_closures VALUES(%s,%s,%s,%s) ON CONFLICT DO NOTHING',
                       (rid,now,mode,self.admin_id if mode=='MANUAL' else None))

    def _finalize(self, rid):
        with self.tx() as db:
            r=self._round(db,rid,lock=True)
            if r['status']=='FINALIZED':
                return
            closure=db.execute('SELECT * FROM session_closures WHERE session_id=%s',(rid,)).fetchone()
            if not closure:
                return
            db.execute("UPDATE simulation_sessions SET status='CLOSING',end_requested_at=%s,actual_ended_at=%s,end_mode=%s,ended_by_admin_id=%s WHERE id=%s",(closure['requested_at'],closure['requested_at'],closure['end_mode'],closure['admin_id'],rid))
            now=self.now(db)
            db.execute('''INSERT INTO session_results SELECT c.session_id,%s,c.version,c.happiness,c.safety,c.cleanliness,c.overall_pollution,s.rules_snapshot
                          FROM current_city c JOIN simulation_sessions s ON s.id=c.session_id WHERE c.session_id=%s''',(now,rid))
            db.execute('INSERT INTO region_results SELECT session_id,region_id,pollution FROM region_states WHERE session_id=%s',(rid,))
            members=db.execute('SELECT * FROM participant_alignments WHERE session_id=%s',(rid,)).fetchall()
            for m in members:
                label=classify(m['x_score'],m['y_score'])
                x_text = ('공통 규칙과 약속을 존중하는 선택' if m['x_score'] >= 3 else
                          '개인의 판단과 자율을 우선하는 선택' if m['x_score'] <= -3 else
                          '질서와 자율 중 한쪽으로 뚜렷하게 치우치지 않은 선택')
                y_text = ('타인과 공동체를 배려하는 선택' if m['y_score'] >= 3 else
                          '타인에게 줄 피해보다 자신의 이익을 우선하는 선택' if m['y_score'] <= -3 else
                          '배려와 자기 이익 중 한쪽으로 뚜렷하게 치우치지 않은 선택')
                explanation = f"{label}: {x_text}, {y_text}이 누적되었습니다. 전시 속 선택 경향이며 실제 인격에 대한 평가가 아닙니다."
                if not m['response_count']:
                    explanation+=' 참여한 선택 없음.'
                db.execute('''INSERT INTO participant_results(session_id,participant_id,x_score,y_score,response_count,interpretation,finalized_at)
                              VALUES(%s,%s,%s,%s,%s,%s,%s)''',(rid,m['participant_id'],m['x_score'],m['y_score'],m['response_count'],explanation,now))
            db.execute("UPDATE simulation_sessions SET status='FINALIZED',finalized_at=%s WHERE id=%s",(now,rid))

    def tick(self):
        with self.tx() as db:
            rows=db.execute("SELECT id FROM simulation_sessions WHERE status IN ('RUNNING','CLOSING') AND (scheduled_end_at<=clock_timestamp() OR EXISTS(SELECT 1 FROM session_closures WHERE session_id=id))").fetchall()
        for row in rows:
            self.approve_close(row['id'])
            self._finalize(row['id'])

    def finish(self, rid):
        rid=ident(rid)
        self.approve_close(rid,manual=True)
        self._finalize(rid)
        return self.state(rid)['round']

    def state(self, rid=None):
        self.tick()
        with self.tx() as db:
            db.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
            r=self._round(db,rid)
            if r['status']=='DRAFT':
                raise Problem(404,'아직 시작하지 않은 회차예요.')
            final=r['status']=='FINALIZED'
            c=db.execute('SELECT * FROM '+('session_results' if final else 'current_city')+' WHERE session_id=%s',(r['id'],)).fetchone()
            regions=db.execute('SELECT r.id,r.name,v.pollution FROM session_regions r JOIN '+('region_results' if final else 'region_states')+' v ON v.session_id=r.session_id AND v.region_id=r.id WHERE r.session_id=%s ORDER BY r.code',(r['id'],)).fetchall()
            from datetime import timedelta
            now=self.now(db)
            closed=bool(db.execute('SELECT 1 FROM session_closures WHERE session_id=%s',(r['id'],)).fetchone())
            version=c['final_state_version'] if final else c['version']
            result=dict(id=r['id'],name=r['name'],status=r['status'],started=r['starts_at'],ends=r['scheduled_end_at'],cutoff=r['scheduled_end_at']-timedelta(seconds=5),ended=r['actual_ended_at'],mode=r['end_mode'],version=version,responses=version,
                        accepting=r['status']=='RUNNING' and not closed and now<r['scheduled_end_at']-timedelta(seconds=5),
                        happiness=c['happiness'],safety=c['safety'],cleanliness=c['cleanliness'],pollution=c['overall_pollution'],regions=regions)
            return dict(round=result,server_time=now)

    def join(self, token, rid):
        rid=ident(rid)
        self.tick()
        with self.tx() as db:
            self.gate(db,rid)
            self._open(db,self._round(db,rid))
            try:
                visitor=self._visitor(db,token)
            except Problem:
                visitor=db.execute('INSERT INTO participants DEFAULT VALUES RETURNING id').fetchone()['id']
                token=secrets.token_urlsafe(32)
                db.execute("INSERT INTO participant_credentials(participant_id,token_hash,expires_at) VALUES(%s,%s,clock_timestamp()+interval '30 days')",(visitor,token_hash(token)))
            db.execute('INSERT INTO participant_sessions(session_id,participant_id) VALUES(%s,%s) ON CONFLICT DO NOTHING',(rid,visitor))
            db.execute('INSERT INTO participant_alignments(session_id,participant_id) VALUES(%s,%s) ON CONFLICT DO NOTHING',(rid,visitor))
        return token

    def me(self, token, rid):
        self.tick()
        with self.tx() as db:
            db.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
            rid=ident(rid)
            visitor=self._visitor(db,token)
            self._round(db,rid)
            history=db.execute("SELECT s.id,s.name FROM simulation_sessions s JOIN participant_sessions p ON p.session_id=s.id WHERE p.participant_id=%s AND s.status='FINALIZED' ORDER BY s.starts_at DESC",(visitor,)).fetchall()
            if not db.execute('SELECT 1 FROM participant_sessions WHERE session_id=%s AND participant_id=%s',(rid,visitor)).fetchone():
                return dict(joined=False,history=history)
            situations=db.execute('SELECT id,code,title,body FROM session_situations WHERE session_id=%s ORDER BY display_order,id',(rid,)).fetchall()
            for s in situations:
                s['choices']=db.execute('SELECT id,label FROM session_choices WHERE session_id=%s AND situation_id=%s ORDER BY display_order,id',(rid,s['id'])).fetchall()
            answers=db.execute('SELECT situation_id,choice_id FROM choice_records WHERE session_id=%s AND participant_id=%s ORDER BY state_version',(rid,visitor)).fetchall()
            result=db.execute('SELECT x_score AS x,y_score AS y,response_count AS count,alignment_code,interpretation FROM participant_results WHERE session_id=%s AND participant_id=%s',(rid,visitor)).fetchone()
            if result:
                result['alignment']=classify(result['x'],result['y'])
            return dict(joined=True,count=len(answers),answers=answers,situations=situations,history=history,result=result)

    def choose(self, token, rid, situation, choice, request, received=None, before_commit=None):
        rid,situation,choice,request=map(ident,(rid,situation,choice,request))
        # received is an internal test seam only. HTTP never accepts client timestamps.
        with self.tx() as db:
            received=received or self.now(db)  # Before waiting for the city row lock.
            visitor=self._visitor(db,token)
            r=self._round(db,rid,lock=True)
            previous=db.execute('SELECT situation_id,choice_id,state_version FROM choice_records WHERE session_id=%s AND participant_id=%s AND request_key=%s',(rid,visitor,request)).fetchone()
            if previous:
                if (previous['situation_id'],previous['choice_id'])!=(situation,choice):
                    raise Problem(409,'같은 요청 번호에 다른 선택을 보낼 수 없어요.')
                return dict(ok=True,version=previous['state_version'],replayed=True)
            self._open(db,r,received)
            if not db.execute('SELECT 1 FROM participant_sessions WHERE session_id=%s AND participant_id=%s',(rid,visitor)).fetchone():
                raise Problem(403,'이 회차에 먼저 참여해 주세요.')
            if db.execute('SELECT 1 FROM choice_records WHERE session_id=%s AND participant_id=%s AND situation_id=%s',(rid,visitor,situation)).fetchone():
                raise Problem(409,'이미 응답한 상황이에요. 선택은 변경할 수 없어요.')
            c=db.execute('SELECT * FROM session_choices WHERE session_id=%s AND situation_id=%s AND id=%s',(rid,situation,choice)).fetchone()
            if not c:
                raise Problem(400,'상황과 선택지가 일치하지 않아요.')
            city=db.execute('SELECT * FROM city_states WHERE session_id=%s',(rid,)).fetchone()
            fields=('happiness','safety','cleanliness')
            requested=[c[f+'_base']*r['impact_scale'] for f in fields]
            clamp=lambda n: min(Decimal(100),max(Decimal(0),n))
            values=[clamp(city[f]+delta) for f,delta in zip(fields,requested)]
            applied=[v-city[f] for f,v in zip(fields,values)]
            version=city['version']+1
            db.execute('UPDATE city_states SET happiness=%s,safety=%s,cleanliness=%s,version=%s,updated_at=clock_timestamp() WHERE session_id=%s',(*values,version,rid))
            db.execute('UPDATE participant_alignments SET x_score=x_score+%s,y_score=y_score+%s,response_count=response_count+1,updated_at=clock_timestamp() WHERE session_id=%s AND participant_id=%s',(c['alignment_dx'],c['alignment_dy'],rid,visitor))
            record=db.execute('''INSERT INTO choice_records(session_id,participant_id,situation_id,choice_id,request_key,received_at,alignment_dx,alignment_dy,scale_snapshot,happiness_requested,safety_requested,cleanliness_requested,happiness_applied,safety_applied,cleanliness_applied,state_version)
                         VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id''',(rid,visitor,situation,choice,request,received,c['alignment_dx'],c['alignment_dy'],r['impact_scale'],*requested,*applied,version)).fetchone()['id']
            effects=db.execute('SELECT e.region_id,e.pollution_base,s.pollution FROM choice_region_effects e JOIN region_states s ON s.session_id=e.session_id AND s.region_id=e.region_id WHERE e.session_id=%s AND e.situation_id=%s AND e.choice_id=%s',(rid,situation,choice)).fetchall()
            for e in effects:
                delta=e['pollution_base']*r['impact_scale']
                value=clamp(e['pollution']+delta)
                db.execute('UPDATE region_states SET pollution=%s,updated_at=clock_timestamp() WHERE session_id=%s AND region_id=%s',(value,rid,e['region_id']))
                db.execute('INSERT INTO choice_record_region_effects VALUES(%s,%s,%s,%s,%s)',(record,rid,e['region_id'],delta,value-e['pollution']))
            if before_commit:
                before_commit()  # Tests pause here to exercise real approval/commit races.
            # Deferred DB trigger acquires the commit gate and rejects expired/cancelled work.
        return dict(ok=True,version=version,replayed=False)
