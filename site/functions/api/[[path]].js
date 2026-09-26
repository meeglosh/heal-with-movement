import { createAuth } from "../../server/auth.js";
import { database } from "../../server/db.js";
import { calendar } from "../../server/cal.js";
import { portal, calWebhook, limit } from "../../server/portal.js";
import { HttpError, json, checkOrigin, readJSON } from "../../server/http.js";
export async function onRequest(context) {
  const { request, env } = context;
  const path = new URL(request.url).pathname;
  try {
    if (!env.APP_ORIGIN || !env.DATABASE_URL)
      return json(
        {
          error:
            "Online booking is being prepared. Please contact Heidi to arrange a session.",
        },
        503,
      );
    const db = database(env),
      cal = calendar(env);
    if (path === "/api/cal/webhook")
      return await calWebhook(request, env, { db, cal });
    const auth = createAuth(env, request);
    if (path.startsWith("/api/auth/")) {
      checkOrigin(request, env.APP_ORIGIN);
      const allowed = [
        "/api/auth/email-otp/send-verification-otp",
        "/api/auth/sign-in/email-otp",
        "/api/auth/get-session",
        "/api/auth/sign-out",
      ];
      if (!allowed.includes(path)) throw new HttpError(404, "Not found.");
      const expected = path.endsWith("/get-session") ? "GET" : "POST";
      if (request.method !== expected)
        throw new HttpError(405, "Method not allowed.");
      if (expected === "POST") {
        await readJSON(request.clone());
        const ip = request.headers.get("cf-connecting-ip") || "local";
        const digest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(ip),
        );
        const key = Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
        await limit(db, "auth:" + key, 10);
      }

      const response = await auth.handler(request);
      const secure = new Response(response.body, response);
      secure.headers.set("Cache-Control", "no-store");
      return secure;
    }
    if (path.startsWith("/api/portal/"))
      return auth.finish(await portal(request, env, { db, auth, cal }));
    throw new HttpError(404, "Not found.");
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    // Never log intake values, emails, OTPs, connection strings, or raw upstream errors.
    console.error(JSON.stringify({ event: "portal_request_failed", path }));
    return json(
      {
        error:
          "We could not complete that request. Please try again or contact Heidi.",
      },
      500,
    );
  }
}
