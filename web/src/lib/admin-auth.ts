import { timingSafeEqual } from "node:crypto";
import { createLocalJWKSet, createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { NextRequest } from "next/server";
import type { PoolClient } from "pg";
import { ApiError } from "./api";

let keyResolver: JWTVerifyGetKey | undefined;
function configuredKeys(): JWTVerifyGetKey {
  if (keyResolver) return keyResolver;
  const local = process.env.ADMIN_JWKS_JSON;
  const remote = process.env.ADMIN_JWKS_URL;
  if (Boolean(local) === Boolean(remote)) throw new ApiError(503, "ADMIN_AUTH_NOT_CONFIGURED", "관리자 인증 키 설정이 필요합니다.");
  try {
    if (local) keyResolver = createLocalJWKSet(JSON.parse(local));
    else {
      const url = new URL(remote!);
      if (url.protocol !== "https:" || url.username || url.password) throw new Error("HTTPS JWKS URL required");
      keyResolver = createRemoteJWKSet(url, { timeoutDuration: 5_000 });
    }
  } catch {
    throw new ApiError(503, "ADMIN_AUTH_NOT_CONFIGURED", "관리자 인증 키 설정이 올바르지 않습니다.");
  }
  return keyResolver;
}
function bearer(request: NextRequest) {
  const value = request.headers.get("authorization");
  if (!value || !/^Bearer \S+$/i.test(value) || value.length > 16_384) throw new ApiError(401, "UNAUTHORIZED", "Bearer 인증이 필요합니다.");
  return value.slice(7);
}

export async function adminSubject(request: NextRequest): Promise<string> {
  const token = bearer(request);
  const issuer = process.env.ADMIN_TOKEN_ISSUER;
  const audience = process.env.ADMIN_TOKEN_AUDIENCE;
  if (!issuer || !audience) throw new ApiError(503, "ADMIN_AUTH_NOT_CONFIGURED", "관리자 발급자와 대상 설정이 필요합니다.");
  const keys = configuredKeys();
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer, audience, algorithms: ["RS256"], requiredClaims: ["sub", "exp", "iat"],
    });
    if (typeof payload.sub !== "string" || !payload.sub.trim() ||
      typeof payload.iat !== "number" || payload.iat > Date.now() / 1000 || payload.exp! <= payload.iat) throw new Error("Invalid identity");
    return payload.sub;
  } catch {
    throw new ApiError(401, "UNAUTHORIZED", "관리자 토큰이 유효하지 않습니다.");
  }
}

export async function requireAdmin(db: PoolClient, subject: string): Promise<string> {
  const result = await db.query("SELECT id FROM simus.admin_users WHERE auth_subject=$1 AND is_active FOR SHARE", [subject]);
  if (!result.rowCount) throw new ApiError(403, "ADMIN_REQUIRED", "활성 관리자 권한이 필요합니다.");
  return result.rows[0].id;
}

export function requireJobToken(request: NextRequest) {
  const expected = process.env.SESSION_JOB_TOKEN;
  if (!expected || expected.length < 32) throw new ApiError(503, "JOB_AUTH_NOT_CONFIGURED", "자동 종료 작업 인증 설정이 필요합니다.");
  const actual = Buffer.from(bearer(request));
  const secret = Buffer.from(expected);
  if (actual.length !== secret.length || !timingSafeEqual(actual, secret)) throw new ApiError(401, "UNAUTHORIZED", "작업 토큰이 유효하지 않습니다.");
}
