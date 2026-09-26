import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { portal, calWebhook } from "../server/portal.js";
import {
  encryptIntake,
  decryptIntake,
  verifySignature,
} from "../server/crypto.js";
import { validateEvent } from "../server/cal.js";
const env = {
  APP_ORIGIN: "https://test.invalid",
  INTAKE_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  CAL_VERMONT_EVENT_ID: "1",
  CAL_VERMONT_CHILD_EVENT_ID: "2",
  STAFF_EMAILS: "staff@example.invalid",
};
const pg = new PGlite();
const db = { query: async (s, p) => (await pg.query(s, p)).rows };
const user = {
  id: "parent",
  email: "parent@example.invalid",
  name: "Parent",
  emailVerified: true,
};
let calls = 0;
const cal = {
  event: async () => ({
    confirmationPolicy: { type: "always", disabled: false },
  }),
  slots: async () => ({}),
  create: async () => {
    calls++;
    return { uid: "cal-" + calls, status: "pending" };
  },
  confirm: async () => ({ status: "accepted" }),
};
async function request(path, body, who = user, extra = {}) {
  return portal(
    new Request(env.APP_ORIGIN + "/api/portal" + path, {
      method: body ? "POST" : "GET",
      headers: { origin: env.APP_ORIGIN, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }),
    env,
    {
      db,
      auth: { api: { getSession: async () => (who ? { user: who } : null) } },
      cal,
      ...extra,
    },
  );
}
async function data(path, body, who) {
  return (await request(path, body, who)).json();
}
before(async () => {
  for (const file of ["001_portal.sql", "002_booking_seats.sql"])
    await pg.exec(
      await readFile(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
});
after(() => pg.close());
test("unauthenticated and unverified clients cannot read records", async () => {
  await assert.rejects(
    request("/me", undefined, null),
    (e) => e.status === 401,
  );
  await assert.rejects(
    request("/me", undefined, { ...user, emailVerified: false }),
    (e) => e.status === 401,
  );
});
test("child intake only exists inside owned first-child booking and persists across flows", async () => {
  const { child } = await data("/children", {
    name: "Child",
    birthDate: "2020-01-01",
  });
  const flow = await data("/flows", { service: "vermont", childId: child.id });
  assert.equal(flow.needsIntake, true);
  await assert.rejects(
    request(`/flows/${flow.id}`, undefined, { ...user, id: "stranger" }),
    (e) => e.status === 404,
  );
  await assert.rejects(
    request(
      "/flows",
      { service: "vermont", childId: child.id },
      { ...user, id: "stranger" },
    ),
    (e) => e.status === 404,
  );
  await assert.rejects(
    request(`/flows/${flow.id}/slots`),
    (e) => e.status === 409,
  );
  const form = await data(`/flows/${flow.id}/intake`);
  assert.match(form.html, /intake-form/);
  const values = {
    clientName: "Forged",
    birthDate: "2019-01-01",
    guardianName: "Parent",
    address: "1 Main",
    city: "City",
    province: "VT",
    postalCode: "12345",
    email: "forged@example.invalid",
    preferredPhone: "cell",
    reason: "Test intake",
    hasTubes: "no",
    consent: "on",
    signature: "Parent",
    signDate: new Date().toISOString().slice(0, 10),
  };
  await data(`/flows/${flow.id}/intake`, values);
  await assert.rejects(
    request(`/flows/${flow.id}/intake`, values),
    (e) => e.status === 409,
  );
  await assert.rejects(
    request(`/flows/${flow.id}/intake`),
    (e) => e.status === 409,
  );
  const [saved] = await db.query("SELECT * FROM intakes WHERE child_id=$1", [
    child.id,
  ]);
  assert.ok(!saved.encrypted_payload.includes("Test intake"));
  const plain = await decryptIntake(
    saved.encrypted_payload,
    env.INTAKE_ENCRYPTION_KEY,
    child.id,
  );
  assert.equal(plain.clientName, "Child");
  assert.equal(plain.email, user.email);
  const next = await data("/flows", { service: "vermont", childId: child.id });
  assert.equal(next.needsIntake, false);
  const input = {
    start: new Date(Date.now() + 86400000).toISOString(),
    timeZone: "America/New_York",
    name: "Parent",
  };
  const first = await data(`/flows/${flow.id}/book`, input);
  const second = await data(`/flows/${flow.id}/book`, input);
  assert.equal(first.booking.id, second.booking.id);
  assert.equal(first.booking.status, "accepted");
  assert.equal(calls, 1);
  await assert.rejects(request("/admin/intakes"), (e) => e.status === 403);
  const staff = {
    id: "staff",
    email: "staff@example.invalid",
    emailVerified: true,
    name: "Heidi",
  };
  const view = await data("/admin/intakes/" + child.id, undefined, staff);
  assert.equal(view.intake.reason, "Test intake");
  assert.equal((await db.query("SELECT * FROM audit_events")).length, 1);
});
test("adult booking cannot expose intake", async () => {
  const flow = await data("/flows", { service: "vermont", childId: null });
  await assert.rejects(
    request(`/flows/${flow.id}/intake`),
    (e) => e.status === 403,
  );
});
test("uncertain Cal creation is retained and never retried", async () => {
  const flow = await data("/flows", { service: "vermont", childId: null });
  let attempts = 0;
  const uncertain = {
    ...cal,
    create: async () => {
      attempts++;
      throw new Error("timeout");
    },
  };
  const input = {
    start: new Date(Date.now() + 86400000).toISOString(),
    timeZone: "UTC",
    name: "Parent",
  };
  await assert.rejects(
    request(`/flows/${flow.id}/book`, input, user, { cal: uncertain }),
  );
  const retry = await request(`/flows/${flow.id}/book`, input, user, {
    cal: uncertain,
  });
  assert.equal((await retry.json()).booking.status, "needs_review");
  assert.equal(attempts, 1);
});
test("encryption binds data to child and detects tampering", async () => {
  const encrypted = await encryptIntake(
    { private: "health" },
    env.INTAKE_ENCRYPTION_KEY,
    "a",
  );
  await assert.rejects(
    decryptIntake(encrypted, env.INTAKE_ENCRYPTION_KEY, "b"),
  );
  assert.equal(await verifySignature("body", "invalid", "secret"), false);
});
test("child event requires approval and no second login", () => {
  assert.throws(() => validateEvent({}, true));
  assert.throws(() =>
    validateEvent(
      {
        confirmationPolicy: { type: "always" },
        requiresBookerEmailVerification: true,
      },
      true,
    ),
  );
  assert.doesNotThrow(() =>
    validateEvent(
      {
        confirmationPolicy: { type: "always" },
        bookingRequiresAuthentication: true,
      },
      true,
    ),
  );
  assert.doesNotThrow(() =>
    validateEvent(
      { confirmationPolicy: { type: "always", disabled: false } },
      true,
    ),
  );
});
test("webhooks reject forged signatures and follow reschedules using authoritative state", async () => {
  const [booking] = await db.query(
    "SELECT * FROM bookings WHERE cal_uid IS NOT NULL LIMIT 1",
  );
  const raw = JSON.stringify({ payload: { uid: booking.cal_uid } });
  env.CAL_WEBHOOK_SECRET = "test-webhook";
  const unsigned = new Request("https://test.invalid/api/cal/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw,
  });
  await assert.rejects(
    calWebhook(unsigned, env, { db, cal }),
    (e) => e.status === 401,
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.CAL_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = Buffer.from(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)),
  ).toString("hex");
  const start = new Date(Date.now() + 172800000).toISOString();
  const remote = {
    uid: "rescheduled",
    eventTypeId: booking.event_type_id,
    status: "accepted",
    start,
    attendees: [{ email: user.email }],
  };
  const signed = new Request("https://test.invalid/api/cal/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-cal-signature-256": signature,
    },
    body: raw,
  });
  await calWebhook(signed, env, {
    db,
    cal: {
      get: async (uid) =>
        uid === booking.cal_uid
          ? {
              ...remote,
              uid: booking.cal_uid,
              status: "cancelled",
              rescheduledToUid: "rescheduled",
            }
          : remote,
    },
  });
  const [saved] = await db.query("SELECT * FROM bookings WHERE id=$1", [
    booking.id,
  ]);
  assert.equal(saved.cal_uid, "rescheduled");
  assert.equal(saved.status, "accepted");
});
test("Cal offset slots normalize to UTC and child group requires authenticated API", async () => {
  const { bookingInput } = await import("../server/validation.js");
  assert.equal(
    bookingInput.parse({
      start: "2026-09-28T10:00:00.000-04:00",
      timeZone: "America/New_York",
      name: "Parent",
    }).start,
    "2026-09-28T14:00:00.000Z",
  );
  assert.doesNotThrow(() =>
    validateEvent(
      {
        seats: { seatsPerTimeSlot: 1000, disabled: false },
        bookingRequiresAuthentication: true,
      },
      true,
    ),
  );
  assert.throws(() =>
    validateEvent(
      {
        seats: { seatsPerTimeSlot: 1000, disabled: false },
        bookingRequiresAuthentication: false,
      },
      true,
    ),
  );
});
