import test from 'node:test';
import assert from 'node:assert/strict';
import { localAdminBypass } from '../src/lib/auth/local-admin.ts';

test('local bypass requires development, explicit opt-in, and loopback host', () => {
  const originalMode = process.env.NODE_ENV;
  const originalSwitch = process.env.SIMUS_LOCAL_ADMIN_BYPASS;
  try {
    for (const mode of ['development', 'production', 'test']) {
      for (const flag of ['1', '0', '']) {
        process.env.NODE_ENV = mode;
        process.env.SIMUS_LOCAL_ADMIN_BYPASS = flag;
        for (const host of ['localhost:3000', '127.0.0.1:3000', '[::1]:3000', 'example.com', 'localhost.evil.com', '']) {
          const headers = new Headers(host ? { host } : {});
          const expected = mode === 'development' && flag === '1' && ['localhost:3000', '127.0.0.1:3000', '[::1]:3000'].includes(host);
          assert.equal(localAdminBypass(headers), expected, `${mode}/${flag}/${host}`);
          headers.set('x-forwarded-host', 'public.trycloudflare.com');
          assert.equal(localAdminBypass(headers), false);
        }
      }
    }
  } finally {
    if (originalMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalMode;
    if (originalSwitch === undefined) delete process.env.SIMUS_LOCAL_ADMIN_BYPASS; else process.env.SIMUS_LOCAL_ADMIN_BYPASS = originalSwitch;
  }
});
