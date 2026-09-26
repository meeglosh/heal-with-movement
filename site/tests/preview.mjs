// In-memory UI test server. Never deploy; no real users or Cal calls.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { encryptIntake } from "../server/crypto.js";
import { intakeInput, adultIntakeInput } from "../server/validation.js";
import { portal } from "../server/portal.js";
const pg = new PGlite();
for (const file of [
  "001_portal.sql",
  "002_booking_seats.sql",
  "003_adult_intakes.sql",
  "004_intake_reviews.sql",
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
if (process.env.INTAKE_REVIEW_FIXTURE === "1") {
  await db.query("INSERT INTO portal_users(id,name,email) VALUES($1,$2,$3)", [
    user.id,
    user.name,
    user.email,
  ]);
  const childId = crypto.randomUUID();
  await db.query(
    "INSERT INTO children(id,guardian_id,name,birth_date) VALUES($1,$2,'Test Child','2020-01-01')",
    [childId, user.id],
  );
  const base = {
    clientName: user.name,
    birthDate: "1980-01-01",
    address: "1 Test Street",
    city: "Test City",
    province: "VT",
    postalCode: "12345",
    email: user.email,
    preferredPhone: "cell",
    reason: "Synthetic saved history",
    signature: "Test Parent",
    signDate: "2025-01-01",
  };
  const adult = adultIntakeInput.parse({
    ...base,
    educationInitials: "TP",
    discomfortInitials: "TP",
    healthInitials: "TP",
    cancellationInitials: "TP",
    releasorName: "Test Parent",
    conditions: ["Arthritis", "Vision: Glasses"],
  });
  const child = intakeInput.parse({
    ...base,
    clientName: "Test Child",
    birthDate: "2020-01-01",
    guardianName: "Test Parent",
    consent: "on",
    hasTubes: "no",
  });
  await db.query(
    "INSERT INTO adult_intakes(user_id,encrypted_payload,reviewed_at) VALUES($1,$2,now()-interval '7 months')",
    [
      user.id,
      await encryptIntake(adult, env.INTAKE_ENCRYPTION_KEY, `adult:${user.id}`),
    ],
  );
  await db.query(
    "INSERT INTO intakes(child_id,guardian_id,encrypted_payload,reviewed_at) VALUES($1,$2,$3,now()-interval '7 months')",
    [
      childId,
      user.id,
      await encryptIntake(child, env.INTAKE_ENCRYPTION_KEY, childId),
    ],
  );
}
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
