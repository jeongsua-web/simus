import { NextRequest } from "next/server";
import { ApiError, handle, json, transaction, uuid } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_PUBLIC_GROUP = 5;
type CountRow = { department_id: string; count: string };
type ChoiceRow = { department_id: string; situation_id: string; choice_id: string; count: string };
type AlignmentRow = { department_id: string; alignment_code: string; count: string };

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const sessionId = uuid((await context.params).id, "session_id");
    const statistics = await transaction(async db => {
      const session = await db.query("SELECT status FROM simus.simulation_sessions WHERE id=$1", [sessionId]);
      if (!session.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "회차를 찾을 수 없습니다.");
      const finalized = session.rows[0].status === "FINALIZED";
      const departments = await db.query("SELECT id,faculty,name FROM simus.departments ORDER BY display_order");
      const participants = await db.query<CountRow>(`SELECT department_id,count(*)::text AS count
        FROM simus.participant_sessions WHERE session_id=$1 GROUP BY department_id`, [sessionId]);
      const responses = await db.query<CountRow>(`SELECT p.department_id,count(*)::text AS count
        FROM simus.choice_records r JOIN simus.participant_sessions p
          ON (p.session_id,p.participant_id)=(r.session_id,r.participant_id)
        WHERE r.session_id=$1 GROUP BY p.department_id`, [sessionId]);
      const situations = await db.query(`SELECT id,title,display_order FROM simus.session_situations
        WHERE session_id=$1 ORDER BY display_order,id`, [sessionId]);
      const choices = await db.query(`SELECT situation_id,id,label,display_order FROM simus.session_choices
        WHERE session_id=$1 ORDER BY situation_id,display_order,id`, [sessionId]);
      const answers = await db.query<ChoiceRow>(`SELECT p.department_id,r.situation_id,r.choice_id,count(*)::text AS count
        FROM simus.choice_records r JOIN simus.participant_sessions p
          ON (p.session_id,p.participant_id)=(r.session_id,r.participant_id)
        WHERE r.session_id=$1 GROUP BY p.department_id,r.situation_id,r.choice_id`, [sessionId]);
      const alignments = finalized ? await db.query<AlignmentRow>(`SELECT p.department_id,r.alignment_code,count(*)::text AS count
        FROM simus.participant_results r JOIN simus.participant_sessions p
          ON (p.session_id,p.participant_id)=(r.session_id,r.participant_id)
        WHERE r.session_id=$1 AND r.response_count>0 GROUP BY p.department_id,r.alignment_code`, [sessionId]) : null;

      const participantCounts = new Map(participants.rows.map(row => [row.department_id, Number(row.count)]));
      const responseCounts = new Map(responses.rows.map(row => [row.department_id, Number(row.count)]));
      const answerCounts = new Map(answers.rows.map(row => [`${row.department_id}:${row.situation_id}:${row.choice_id}`, Number(row.count)]));
      const situationCounts = new Map<string, number>();
      for (const row of answers.rows) {
        const key = `${row.department_id}:${row.situation_id}`;
        situationCounts.set(key, (situationCounts.get(key) ?? 0) + Number(row.count));
      }
      const alignmentCounts = new Map<string, number>();
      const respondedCounts = new Map<string, number>();
      for (const row of alignments?.rows ?? []) {
        alignmentCounts.set(`${row.department_id}:${row.alignment_code}`, Number(row.count));
        respondedCounts.set(row.department_id, (respondedCounts.get(row.department_id) ?? 0) + Number(row.count));
      }

      return {
        session_id: sessionId,
        status: session.rows[0].status,
        minimum_public_group: MIN_PUBLIC_GROUP,
        departments: departments.rows.map(department => {
          const participantCount = participantCounts.get(department.id) ?? 0;
          const respondedCount = respondedCounts.get(department.id) ?? 0;
          return {
            ...department,
            participant_count: participantCount,
            response_count: responseCounts.get(department.id) ?? 0,
            situations: situations.rows.map(situation => {
              const respondentCount = situationCounts.get(`${department.id}:${situation.id}`) ?? 0;
              return {
                id: situation.id,
                title: situation.title,
                respondent_count: respondentCount,
                suppressed: respondentCount < MIN_PUBLIC_GROUP,
                choices: respondentCount < MIN_PUBLIC_GROUP ? null : choices.rows
                  .filter(choice => choice.situation_id === situation.id)
                  .map(choice => {
                    const count = answerCounts.get(`${department.id}:${situation.id}:${choice.id}`) ?? 0;
                    return { id: choice.id, label: choice.label, count, ratio: count / respondentCount };
                  }),
              };
            }),
            alignment: !finalized ? null : {
              respondent_count: respondedCount,
              no_response_count: participantCount - respondedCount,
              suppressed: respondedCount < MIN_PUBLIC_GROUP,
              distribution: respondedCount < MIN_PUBLIC_GROUP ? null : Object.fromEntries(
                [...alignmentCounts].filter(([key]) => key.startsWith(`${department.id}:`))
                  .map(([key, count]) => [key.slice(department.id.length + 1), count]),
              ),
            },
          };
        }),
      };
    });
    return json(statistics);
  });
}
