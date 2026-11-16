import { NextRequest } from 'next/server';
import { ApiError, authenticate, body, checkOrigin, handle, json, transaction, uuid } from '@/lib/api';
import { confirmLocalEvent } from '@/lib/routes/v003-local-event';
export const runtime = 'nodejs';
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    return handle(async () => {
        checkOrigin(request); const input = await body(request);
        const sid = uuid((await context.params).id, 'session_id');
        const eid = uuid(input.event_id, 'event_id');
        return json(await transaction(async db => {
            const pid = await authenticate(db, request);
            if (!pid) throw new ApiError(401, 'UNAUTHORIZED', '먼저 입장해주세요.');
            const session = await db.query('SELECT id FROM simus.simulation_sessions WHERE id=$1 FOR UPDATE', [sid]);
            if (!session.rowCount) throw new ApiError(404, 'SESSION_NOT_FOUND', '회차가 없습니다.');
            return confirmLocalEvent(db, sid, pid, eid);
        }));
    });
}
