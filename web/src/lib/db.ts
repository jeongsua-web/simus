import { Pool } from "pg";

const globalForPg = globalThis as unknown as {
  pool?: Pool;
};

export function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL이 설정되지 않았습니다.");
  }

  globalForPg.pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 5_000,
  });

  return globalForPg.pool;
}