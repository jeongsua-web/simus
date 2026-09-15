import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await getPool().query(`
      SELECT
        current_database() AS database,
        current_timestamp AS server_time,
        (
          SELECT count(*)::int
          FROM information_schema.tables
          WHERE table_schema = 'simus'
            AND table_type = 'BASE TABLE'
        ) AS table_count
    `);

    return NextResponse.json({
      status: "healthy",
      ...result.rows[0],
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        status: "unhealthy",
        message: "데이터베이스 연결에 실패했습니다.",
      },
      { status: 503 },
    );
  }
}