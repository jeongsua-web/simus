// Server-only policy: never expose the switch through NEXT_PUBLIC_*.
export function localAdminBypass(headers: Pick<Headers, "get">): boolean {
  if (process.env.NODE_ENV !== "development" || process.env.SIMUS_LOCAL_ADMIN_BYPASS !== "1") return false;
  const isLocal = (host: string | null) => {
    if (!host) return false;
    return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
  };
  return isLocal(headers.get("host")) &&
    (!headers.get("x-forwarded-host") || isLocal(headers.get("x-forwarded-host")));
}
