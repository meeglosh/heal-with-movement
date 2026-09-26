import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuth } from "../server/auth.js";
import { checkOrigin, readJSON } from "../server/http.js";
const env = {
  APP_ORIGIN: "https://portal.example.invalid",
  NEON_AUTH_BASE_URL: "https://auth.example.invalid/neondb/auth",
  NEON_AUTH_COOKIE_SECRET: "test-secret-with-at-least-thirty-two-characters",
};
test("Neon adapter verifies upstream session and forwards fresh cookies", async () => {
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    return Response.json(
      {
        user: {
          id: "neon-user",
          email: "parent@example.invalid",
          emailVerified: true,
        },
        session: {
          id: "session",
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      },
      {
        headers: {
          "set-cookie":
            "__Secure-neon-auth.session_token=refreshed; Path=/; Secure; HttpOnly; SameSite=Lax",
        },
      },
    );
  };
  try {
    const request = new Request(env.APP_ORIGIN + "/api/portal/me", {
      headers: {
        cookie:
          "unrelated=do-not-forward; __Secure-neon-auth.session_token=opaque",
      },
    });
    const auth = createAuth(env, request);
    const session = await auth.api.getSession();
    assert.equal(session.user.id, "neon-user");
    assert.match(requests[0].url, /disableCookieCache=true/);
    assert.equal(requests[0].init.headers.Origin, env.APP_ORIGIN);
    assert.ok(!requests[0].init.headers.Cookie.includes("unrelated"));
    const response = auth.finish(Response.json({ ok: true }));
    assert.ok(
      response.headers
        .getSetCookie()
        .some((c) => c.includes("session_token=refreshed")),
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("auth proxy preserves method, path and body", async () => {
  const original = globalThis.fetch;
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url: String(url), init };
    return Response.json(
      { code: "INVALID_OTP", message: "Invalid OTP" },
      { status: 400 },
    );
  };
  try {
    const body = { email: "parent@example.invalid", otp: "000000" };
    const req = new Request(env.APP_ORIGIN + "/api/auth/sign-in/email-otp", {
      method: "POST",
      headers: { origin: env.APP_ORIGIN, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const response = await createAuth(env, req).handler(req);
    assert.equal(response.status, 400);
    assert.match(seen.url, /\/sign-in\/email-otp$/);
    assert.equal(seen.init.method, "POST");
    assert.deepEqual(JSON.parse(seen.init.body), body);
  } finally {
    globalThis.fetch = original;
  }
});
test("mutations require exact origin and bounded JSON bodies", async () => {
  assert.throws(
    () =>
      checkOrigin(
        new Request(env.APP_ORIGIN, {
          method: "POST",
          headers: { origin: "https://evil.invalid" },
        }),
        env.APP_ORIGIN,
      ),
    (e) => e.status === 403,
  );
  await assert.rejects(
    readJSON(
      new Request(env.APP_ORIGIN, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: "x".repeat(66000) }),
      }),
    ),
    (e) => e.status === 413,
  );
});
