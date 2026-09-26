// In-memory UI test server. Never deploy; no real users or Cal calls.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { portal } from "../server/portal.js";
const pg = new PGlite();
for (const file of [
  "001_portal.sql",
  "002_booking_seats.sql",
  "003_adult_intakes.sql",
])
  await pg.exec(
    await readFile(new URL("../migrations/" + file, import.meta.url), "utf8"),
  );
const env = {
  APP_ORIGIN: "http://localhost:8789",
  INTAKE_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64"),
  CAL_VERMONT_EVENT_ID: "1",
  CAL_VERMONT_CHILD_EVENT_ID: "2",
};
const user = {
  id: "fixture-parent",
  email: "parent@example.invalid",
  name: "Test Parent",
  emailVerified: true,
};
const start = new Date(Date.now() + 86400000);
start.setUTCHours(15, 0, 0, 0);
const db = { query: async (s, p) => (await pg.query(s, p)).rows };
const cal = {
  event: async () => ({
    confirmationPolicy: { type: "always", disabled: false },
  }),
  slots: async () => ({
    [start.toISOString().slice(0, 10)]: [{ start: start.toISOString() }],
  }),
  create: async () => ({ uid: crypto.randomUUID(), status: "pending" }),
  confirm: async () => ({ status: "accepted" }),
};
const root = resolve("public");
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, env.APP_ORIGIN);
    let response;
    if (url.pathname === "/api/auth/get-session")
      response = Response.json({ user, session: { id: "fixture" } });
    else if (url.pathname.startsWith("/api/portal/")) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks);
      const request = new Request(url, {
        method: req.method,
        headers: req.headers,
        ...(body.length ? { body } : {}),
      });
      response = await portal(request, env, {
        db,
        cal,
        auth: { api: { getSession: async () => ({ user }) } },
      });
    } else {
      const file = resolve(
        root,
        "." + url.pathname + (extname(url.pathname) ? "" : ".html"),
      );
      if (!file.startsWith(root + "/")) throw new Error("Invalid path");
      response = new Response(await readFile(file), {
        headers: {
          "content-type":
            {
              ".html": "text/html",
              ".js": "text/javascript",
              ".css": "text/css",
              ".svg": "image/svg+xml",
            }[extname(file)] || "application/octet-stream",
        },
      });
    }
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    res.writeHead(e.status || 500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: e.message }));
  }
}).listen(8789, "127.0.0.1", () =>
  console.log(
    "Synthetic UI test fixture ready on http://localhost:8789/book.html",
  ),
);
