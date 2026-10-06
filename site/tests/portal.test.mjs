import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  portal,
  calWebhook,
  stripeWebhook,
  publicGroupTimes,
} from "../server/portal.js";
import { PRICES, verifyStripeSignature } from "../server/stripe.js";
import {
  encryptIntake,
  decryptIntake,
  verifySignature,
} from "../server/crypto.js";
import { eventId, validateEvent } from "../server/cal.js";
const env = {
  APP_ORIGIN: "https://test.invalid",
  INTAKE_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  CAL_VERMONT_EVENT_ID: "1",
  CAL_VERMONT_CHILD_EVENT_ID: "2",
  CAL_VIRTUAL_EVENT_ID: "100",
  CAL_VIRTUAL_CHILD_EVENT_ID: "100",
  CAL_VIRTUAL_PRIVATE_EVENT_ID: "101",
  CAL_VIRTUAL_PRIVATE_CHILD_EVENT_ID: "102",
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
let observedEventId;
let observedSlotEventId;
let observedBookingEventId;
const cal = {
  event: async (id) => {
    observedEventId = id;
    return ({
    confirmationPolicy: { type: "always", disabled: false },
    });
  },
  slots: async (id) => {
    observedSlotEventId = id;
    return {};
  },
  create: async (booking) => {
    calls++;
    observedBookingEventId = booking.eventTypeId;
    return { uid: "cal-" + calls, status: "pending" };
  },
  confirm: async () => {
    assert.fail("Website must never auto-confirm Heidi’s pending requests");
  },
};
let sessionCount = 0;
const sessions = new Map();
const refunds = [];
const createdSessions = [];
const pay = {
  createSession: async (body, key) => {
    const id = "cs_test_" + ++sessionCount;
    createdSessions.push({ id, body, key });
    sessions.set(id, {
      id,
      metadata: body.metadata,
      payment_status: "unpaid",
      status: "open",
    });
    return { id, url: "https://checkout.stripe.test/" + id };
  },
  getSession: async (id) => sessions.get(id),
  refund: async (paymentIntent, key) => {
    refunds.push({ paymentIntent, key });
    return { id: "re_" + refunds.length };
  },
};
function markPaid(url) {
  const id = url.split("/").pop();
  Object.assign(sessions.get(id), {
    payment_status: "paid",
    status: "complete",
    payment_intent: "pi_" + id,
  });
  return id;
}
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
      pay,
      ...extra,
    },
  );
}
async function data(path, body, who) {
  return (await request(path, body, who)).json();
}
before(async () => {
  for (const file of [
    "001_portal.sql",
    "002_booking_seats.sql",
    "003_adult_intakes.sql",
    "004_intake_reviews.sql",
    "005_virtual_private.sql",
    "006_payments.sql",
  ])
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
  assert.equal(first.booking.status, "pending");
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
test("adult intake is required once, private, encrypted, and separate from child intake", async () => {
  const flow = await data("/flows", { service: "vermont", childId: null });
  assert.equal(flow.needsIntake, true);
  const booking = {
    start: new Date(Date.now() + 86400000).toISOString(),
    timeZone: "UTC",
    name: "Parent",
  };
  await assert.rejects(
    request(`/flows/${flow.id}/slots`),
    (e) => e.status === 409,
  );
  await assert.rejects(
    request(`/flows/${flow.id}/book`, booking),
    (e) => e.status === 409,
  );
  await assert.rejects(
    request(`/flows/${flow.id}/intake`, undefined, {
      ...user,
      id: "another-adult",
    }),
    (e) => e.status === 404,
  );
  const form = await data(`/flows/${flow.id}/intake`);
  assert.match(form.html, /Release of liability/);
  assert.doesNotMatch(form.html, /guardianName/);
  const values = {
    clientName: "Adult Name",
    birthDate: "1980-01-01",
    address: "1 Main",
    city: "City",
    province: "VT",
    postalCode: "12345",
    email: "forged@example.invalid",
    preferredPhone: "cell",
    reason: "Synthetic adult history",
    conditions: ["Arthritis", "Vision: Glasses"],
    educationInitials: "AN",
    discomfortInitials: "AN",
    healthInitials: "AN",
    cancellationInitials: "AN",
    releasorName: "Adult Name",
    signature: "Adult Name",
    signDate: new Date().toISOString().slice(0, 10),
  };
  await assert.rejects(
    request(`/flows/${flow.id}/intake`, { ...values, healthInitials: "" }),
    (e) => e.status === 400,
  );
  await data(`/flows/${flow.id}/intake`, values);
  await assert.rejects(
    request(`/flows/${flow.id}/intake`, values),
    (e) => e.status === 409,
  );
  await assert.rejects(
    request(`/flows/${flow.id}/intake`),
    (e) => e.status === 409,
  );
  const [saved] = await db.query(
    "SELECT * FROM adult_intakes WHERE user_id=$1",
    [user.id],
  );
  assert.ok(!saved.encrypted_payload.includes(values.reason));
  const plain = await decryptIntake(
    saved.encrypted_payload,
    env.INTAKE_ENCRYPTION_KEY,
    `adult:${user.id}`,
  );
  assert.equal(plain.email, user.email);
  assert.deepEqual(plain.conditions, values.conditions);
  await assert.rejects(
    decryptIntake(
      saved.encrypted_payload,
      env.INTAKE_ENCRYPTION_KEY,
      "adult:another-adult",
    ),
  );
  const next = await data("/flows", { service: "montreal", childId: null });
  assert.equal(next.needsIntake, false);
  const other = await data(
    "/flows",
    { service: "vermont", childId: null },
    { ...user, id: "another-adult" },
  );
  assert.equal(other.needsIntake, true);
  const { child } = await data("/children", {
    name: "Another Child",
    birthDate: "2020-02-01",
  });
  assert.equal(
    (await data("/flows", { service: "vermont", childId: child.id }))
      .needsIntake,
    true,
  );
  await assert.rejects(
    request("/admin/adult-intakes/parent"),
    (e) => e.status === 403,
  );
  const staff = {
    id: "staff",
    email: "staff@example.invalid",
    emailVerified: true,
    name: "Heidi",
  };
  const list = await data("/admin/intakes", undefined, staff);
  assert.ok(list.intakes.some((i) => i.kind === "adult" && i.id === user.id));
  const view = await data("/admin/adult-intakes/parent", undefined, staff);
  assert.equal(view.intake.reason, values.reason);
  assert.equal(
    (
      await db.query("SELECT * FROM audit_events WHERE subject_user_id=$1", [
        user.id,
      ])
    ).length,
    1,
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

test("virtual private adult and child events share the correct IDs and intake gate", async () => {
  assert.equal(eventId(env, "virtual_private", false), 101);
  assert.equal(eventId(env, "virtual_private", true), 102);
  assert.equal(eventId(env, "virtual", false), 100);
  assert.equal(eventId(env, "virtual", true), 100);
  const { flowInput } = await import("../server/validation.js");
  assert.equal(
    flowInput.parse({ service: "virtual_private", childId: null }).service,
    "virtual_private",
  );
  assert.throws(() => flowInput.parse({ service: "unlisted", childId: null }));

  const virtualUser = {
    id: "virtual-private-parent",
    email: "virtual-parent@example.invalid",
    name: "Virtual Parent",
    emailVerified: true,
  };

  const { child } = await data("/children", {
    name: "Virtual Child",
    birthDate: "2020-01-01",
  }, virtualUser);
  const flow = await data("/flows", {
    service: "virtual_private",
    childId: child.id,
  }, virtualUser);
  assert.equal(flow.service, "virtual_private");
  assert.equal(flow.needsIntake, true);
  const values = {
    clientName: "Forged",
    birthDate: "2019-01-01",
    guardianName: "Parent",
    address: "1 Main",
    city: "City",
    province: "QC",
    postalCode: "H0H 0H0",
    email: "forged@example.invalid",
    preferredPhone: "cell",
    reason: "Virtual private lesson intake",
    hasTubes: "no",
    consent: "on",
    signature: "Parent",
    signDate: new Date().toISOString().slice(0, 10),
  };
  await data(`/flows/${flow.id}/intake`, values, virtualUser);
  const repeat = await data("/flows", {
    service: "virtual_private",
    childId: child.id,
  }, virtualUser);
  assert.equal(repeat.needsIntake, false);

  const start = new Date(Date.now() + 172800000).toISOString();
  const end = new Date(Date.now() + 345600000).toISOString();
  await data(
    `/flows/${flow.id}/slots?${new URLSearchParams({
      start,
      end,
      timeZone: "America/New_York",
    })}`,
    undefined,
    virtualUser,
  );
  assert.equal(observedEventId, 102);
  assert.equal(observedSlotEventId, 102);
  const callsBeforeCheckout = calls;
  const pending = await data(`/flows/${flow.id}/book`, {
    start,
    timeZone: "America/New_York",
    name: virtualUser.name,
  }, virtualUser);
  // Payment comes first: nothing is booked until Stripe reports it paid.
  assert.match(pending.checkoutUrl, /^https:\/\/checkout\.stripe\.test\//);
  assert.equal(calls, callsBeforeCheckout);
  const lessonSession = createdSessions.at(-1);
  assert.equal(lessonSession.body.line_items[0].price_data.unit_amount, 4000);
  assert.equal(lessonSession.body.line_items[0].price_data.currency, "cad");
  assert.equal(lessonSession.body.customer_email, virtualUser.email);
  const unpaid = await data(
    "/checkout/complete",
    { sessionId: lessonSession.id },
    virtualUser,
  );
  assert.equal(unpaid.paid, false);
  assert.equal(unpaid.booking, null);
  const result = await data(
    "/checkout/complete",
    { sessionId: markPaid(pending.checkoutUrl) },
    virtualUser,
  );
  assert.equal(result.booking.service, "virtual_private");
  assert.equal(result.booking.status, "pending");
  assert.equal(observedBookingEventId, 102);

  await db.query(
    "INSERT INTO portal_users(id,name,email) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING",
    [virtualUser.id, virtualUser.name, virtualUser.email],
  );
  await assert.rejects(
    db.query(
      "INSERT INTO booking_flows(id,user_id,service) VALUES($1,$2,$3)",
      [crypto.randomUUID(), virtualUser.id, "unexpected"],
    ),
    (error) => error.code === "23514",
  );
  const oldGroup = await data("/flows", { service: "virtual", childId: null }, virtualUser);
  assert.equal(oldGroup.service, "virtual");

  const adultFlow = await data("/flows", {
    service: "virtual_private",
    childId: null,
  }, virtualUser);
  const adultValues = {
    clientName: virtualUser.name,
    birthDate: "1980-01-01",
    address: "1 Main",
    city: "City",
    province: "QC",
    postalCode: "H0H 0H0",
    email: virtualUser.email,
    preferredPhone: "cell",
    reason: "Virtual private adult intake",
    signature: virtualUser.name,
    signDate: new Date().toISOString().slice(0, 10),
    educationInitials: "VP",
    discomfortInitials: "VP",
    healthInitials: "VP",
    cancellationInitials: "VP",
    releasorName: virtualUser.name,
    conditions: [],
  };
  await data(`/flows/${adultFlow.id}/intake`, adultValues, virtualUser);
  await data(
    `/flows/${adultFlow.id}/slots?${new URLSearchParams({ start, end, timeZone: "America/New_York" })}`,
    undefined,
    virtualUser,
  );
  assert.equal(observedEventId, 101);
  assert.equal(observedSlotEventId, 101);
  const adultCheckout = await data(`/flows/${adultFlow.id}/book`, {
    start,
    timeZone: "America/New_York",
    name: virtualUser.name,
  }, virtualUser);
  const adultBooking = await data(
    "/checkout/complete",
    { sessionId: markPaid(adultCheckout.checkoutUrl) },
    virtualUser,
  );
  // Completing again (browser return plus webhook) never books twice.
  const again = await data(
    "/checkout/complete",
    { sessionId: adultCheckout.checkoutUrl.split("/").pop() },
    virtualUser,
  );
  assert.equal(again.booking.id, adultBooking.booking.id);
  assert.equal(adultBooking.booking.service, "virtual_private");
  assert.equal(observedBookingEventId, 101);
});

test("Heidi’s rejection updates the account and booking retries cannot confirm it", async () => {
  const [booking] = await db.query(
    "SELECT * FROM bookings WHERE cal_uid IS NOT NULL LIMIT 1",
  );
  await db.query("UPDATE bookings SET status='pending' WHERE id=$1", [
    booking.id,
  ]);
  const rejectingCalendar = {
    ...cal,
    get: async () => ({
      uid: booking.cal_uid,
      eventTypeId: booking.event_type_id,
      status: "rejected",
      start: new Date(booking.start_at).toISOString(),
      attendees: [{ email: user.email }],
    }),
  };
  const response = await request("/me", undefined, user, {
    cal: rejectingCalendar,
  });
  const account = await response.json();
  assert.equal(
    account.bookings.find((b) => b.id === booking.id).status,
    "rejected",
  );
  const attempts = calls;
  const retry = await request(
    `/flows/${booking.flow_id}/book`,
    {
      start: new Date(booking.start_at).toISOString(),
      timeZone: "UTC",
      name: "Parent",
    },
    user,
    { cal: rejectingCalendar },
  );
  assert.equal((await retry.json()).booking.status, "rejected");
  assert.equal(calls, attempts);
});

test("adult and child reviews recur after six calendar months and cannot bypass ownership or overwrite a newer review", async () => {
  const [child] = await db.query(
    "SELECT child_id FROM intakes WHERE guardian_id=$1 LIMIT 1",
    [user.id],
  );
  for (const [table, key, subject, childId] of [
    ["adult_intakes", "user_id", user.id, null],
    ["intakes", "child_id", child.child_id, child.child_id],
  ]) {
    await db.query("DELETE FROM api_limits");
    const flow = await data("/flows", { service: "vermont", childId });
    assert.equal(flow.needsIntake, false);
    await db.query(
      `UPDATE ${table} SET reviewed_at=now()-interval '6 months'+interval '1 day' WHERE ${key}=$1`,
      [subject],
    );
    assert.equal((await data(`/flows/${flow.id}`)).reviewDue, false);
    await db.query(
      `UPDATE ${table} SET reviewed_at=now()-interval '6 months' WHERE ${key}=$1`,
      [subject],
    );
    assert.equal((await data(`/flows/${flow.id}`)).reviewDue, true);
    const account = await data("/me");
    assert.ok(account.reviews.some((r) => r.id === subject));
    await assert.rejects(
      request(`/flows/${flow.id}/slots`),
      (e) => e.status === 409,
    );
    await assert.rejects(
      request(`/flows/${flow.id}/book`, {
        start: new Date(Date.now() + 86400000).toISOString(),
        timeZone: "UTC",
        name: "Parent",
      }),
      (e) => e.status === 409,
    );
    await assert.rejects(
      request(`/flows/${flow.id}/intake`, undefined, {
        ...user,
        id: "stranger",
      }),
      (e) => e.status === 404,
    );
    const form = await data(`/flows/${flow.id}/intake`);
    assert.ok(form.answers.reason);
    await assert.rejects(
      request(`/flows/${flow.id}/intake`, {
        unchanged: true,
        reviewVersion: form.reviewVersion + 1,
      }),
      (e) => e.status === 409,
    );
    const [before] = await db.query(`SELECT * FROM ${table} WHERE ${key}=$1`, [
      subject,
    ]);
    await data(`/flows/${flow.id}/intake`, {
      unchanged: true,
      reviewVersion: form.reviewVersion,
    });
    const [confirmed] = await db.query(
      `SELECT *,reviewed_at + interval '6 months' > now() AS current FROM ${table} WHERE ${key}=$1`,
      [subject],
    );
    assert.equal(confirmed.encrypted_payload, before.encrypted_payload);
    assert.equal(confirmed.version, before.version + 1);
    assert.equal(confirmed.current, true);
    assert.equal((await data(`/flows/${flow.id}`)).needsIntake, false);
    await assert.rejects(
      request(`/flows/${flow.id}/intake`, {
        unchanged: true,
        reviewVersion: form.reviewVersion,
      }),
      (e) => e.status === 409,
    );
    // A later review can edit health answers, while preserving the previous signed form.
    await db.query(
      `UPDATE ${table} SET reviewed_at=now()-interval '7 months' WHERE ${key}=$1`,
      [subject],
    );
    const review = await data(`/flows/${flow.id}/intake`);
    const edited = {
      ...review.answers,
      reason: "Updated synthetic history",
      signDate: new Date().toISOString().slice(0, 10),
      reviewVersion: review.reviewVersion,
    };
    await data(`/flows/${flow.id}/intake`, edited);
    const [saved] = await db.query(`SELECT * FROM ${table} WHERE ${key}=$1`, [
      subject,
    ]);
    const scope = childId || `adult:${user.id}`;
    assert.equal(
      (
        await decryptIntake(
          saved.encrypted_payload,
          env.INTAKE_ENCRYPTION_KEY,
          scope,
        )
      ).reason,
      edited.reason,
    );
    const [history] = await db.query(
      "SELECT * FROM intake_review_history WHERE child_id=$1 OR subject_user_id=$2",
      [childId, childId ? null : user.id],
    );
    assert.equal(
      (
        await decryptIntake(
          history.encrypted_payload,
          env.INTAKE_ENCRYPTION_KEY,
          scope,
        )
      ).reason,
      review.answers.reason,
    );
    assert.equal((await data(`/flows/${flow.id}`)).reviewDue, false);
  }
});

test("turning 18 overrides a current child intake and requires an independent adult account", async () => {
  await db.query("DELETE FROM api_limits");
  const { isAdult, adultBirthday, easternDate } =
    await import("../server/age.js");
  assert.equal(isAdult("2008-09-26", "2026-09-25"), false);
  assert.equal(isAdult("2008-09-26", "2026-09-26"), true);
  assert.equal(adultBirthday("2008-02-29"), "2026-02-28");
  assert.equal(easternDate(new Date("2026-09-26T03:59:00Z")), "2026-09-25");
  const [child] = await db.query(
    "SELECT child_id FROM intakes WHERE guardian_id=$1 LIMIT 1",
    [user.id],
  );
  const flow = await data("/flows", {
    service: "vermont",
    childId: child.child_id,
  });
  const [date] = await db.query(
    "SELECT ((now() AT TIME ZONE 'America/New_York')::date - interval '18 years')::date::text AS birthday",
  );
  await db.query("UPDATE children SET birth_date=$2 WHERE id=$1", [
    child.child_id,
    date.birthday,
  ]);
  for (const action of ["", "/intake", "/slots"])
    await assert.rejects(
      request(`/flows/${flow.id}${action}`),
      (e) => e.status === 403,
    );
  await assert.rejects(
    request(`/flows/${flow.id}/intake`, { unchanged: true, reviewVersion: 1 }),
    (e) => e.status === 403,
  );
  await assert.rejects(
    request(`/flows/${flow.id}/book`, {
      start: new Date(Date.now() + 86400000).toISOString(),
      timeZone: "UTC",
      name: "Parent",
    }),
    (e) => e.status === 403,
  );
  await assert.rejects(
    request("/flows", { service: "vermont", childId: child.child_id }),
    (e) => e.status === 403,
  );
  await assert.rejects(
    request("/children", { name: "Adult", birthDate: date.birthday }),
    (e) => e.status === 400,
  );
  const account = await data("/me");
  assert.equal(
    account.children.find((c) => c.id === child.child_id).adultAccountRequired,
    true,
  );
  assert.ok(!account.reviews.some((r) => r.id === child.child_id));
  // Their own verified account starts with adult intake, independent of the parent's records.
  const adult = {
    id: "new-adult",
    name: "Adult",
    email: "adult@example.invalid",
    emailVerified: true,
  };
  const own = await data(
    "/flows",
    { service: "vermont", childId: null },
    adult,
  );
  assert.equal(own.needsIntake, true);
  const form = await data(`/flows/${own.id}/intake`, undefined, adult);
  assert.match(form.html, /Release of liability/);
  assert.equal(form.answers, null);
});

test("parents cannot reserve child appointments on or after a future eighteenth birthday", async () => {
  await db.query("DELETE FROM api_limits");
  const [child] = await db.query(
    "SELECT child_id FROM intakes WHERE guardian_id=$1 LIMIT 1",
    [user.id],
  );
  const [dates] = await db.query(
    "SELECT ((now() AT TIME ZONE 'America/New_York')::date+1-interval '18 years')::date::text AS birth, ((now() AT TIME ZONE 'America/New_York')::date+1)::text AS birthday",
  );
  await db.query("UPDATE children SET birth_date=$2 WHERE id=$1", [
    child.child_id,
    dates.birth,
  ]);
  const flow = await data("/flows", {
    service: "vermont",
    childId: child.child_id,
  });
  const start = dates.birthday + "T16:00:00Z";
  const query = new URLSearchParams({
    start: new Date().toISOString(),
    end: new Date(Date.now() + 7 * 86400000).toISOString(),
  });
  const slots = await request(
    `/flows/${flow.id}/slots?${query}`,
    undefined,
    user,
    { cal: { ...cal, slots: async () => ({ [dates.birthday]: [{ start }] }) } },
  );
  assert.deepEqual((await slots.json()).slots[dates.birthday], []);
  await assert.rejects(
    request(`/flows/${flow.id}/book`, {
      start,
      timeZone: "America/New_York",
      name: "Parent",
    }),
    (e) => e.status === 403,
  );
});

async function groupUser(id) {
  const who = {
    id,
    email: `${id}@example.invalid`,
    name: "Group Client",
    emailVerified: true,
  };
  const flow = await data("/flows", { service: "virtual", childId: null }, who);
  await data(
    `/flows/${flow.id}/intake`,
    {
      clientName: who.name,
      birthDate: "1980-01-01",
      address: "1 Main",
      city: "City",
      province: "QC",
      postalCode: "H0H 0H0",
      email: who.email,
      preferredPhone: "cell",
      reason: "Group class",
      signature: who.name,
      signDate: new Date().toISOString().slice(0, 10),
      educationInitials: "GC",
      discomfortInitials: "GC",
      healthInitials: "GC",
      cancellationInitials: "GC",
      releasorName: who.name,
      conditions: [],
    },
    who,
  );
  return { who, flow };
}
// Booking tests run relative to today, so they ignore the launch date.
env.GROUP_FIRST_CLASS = "2000-01-01";
const later = (days) => ({
  start: new Date(Date.now() + days * 86400000).toISOString(),
  timeZone: "UTC",
  name: "Group Client",
});

test("group classes need a credit, and a paid package adds six credits exactly once", async () => {
  const { who, flow } = await groupUser("group-buyer");
  await assert.rejects(
    request(`/flows/${flow.id}/book`, later(3), who),
    (e) => e.status === 402,
  );
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM bookings WHERE flow_id=$1", [flow.id]))[0].n,
    0,
  );
  const { checkoutUrl } = await data("/credits/checkout", { flowId: flow.id }, who);
  const session = createdSessions.at(-1);
  assert.equal(session.body.line_items[0].price_data.unit_amount, PRICES.group_credits.amount);
  assert.equal(session.body.line_items[0].price_data.currency, "usd");
  assert.match(session.body.success_url, new RegExp(`/book\\.html\\?flow=${flow.id}&checkout=`));
  const id = markPaid(checkoutUrl);
  assert.equal((await data("/checkout/complete", { sessionId: id }, who)).credits, 6);
  assert.equal((await data("/checkout/complete", { sessionId: id }, who)).credits, 6);
  // Another client cannot claim someone else’s checkout.
  await assert.rejects(
    request("/checkout/complete", { sessionId: id }, user),
    (e) => e.status === 404,
  );
  const booked = await data(`/flows/${flow.id}/book`, later(3), who);
  assert.equal(booked.booking.service, "virtual");
  // A repeated click returns the same booking without spending another credit.
  await data(`/flows/${flow.id}/book`, later(3), who);
  assert.equal((await data("/me", undefined, who)).credits, 5);
});

test("timely cancellations return the credit; late ones forfeit it", async () => {
  const { who } = await groupUser("group-canceller");
  const { checkoutUrl } = await data("/credits/checkout", { flowId: null }, who);
  await data("/checkout/complete", { sessionId: markPaid(checkoutUrl) }, who);
  async function bookAndCancel(days) {
    const flow = await data("/flows", { service: "virtual", childId: null }, who);
    const { booking } = await data(`/flows/${flow.id}/book`, later(days), who);
    const [row] = await db.query("SELECT * FROM bookings WHERE id=$1", [booking.id]);
    const cancelling = {
      ...cal,
      get: async () => ({
        uid: row.cal_uid,
        eventTypeId: row.event_type_id,
        status: "cancelled",
        start: new Date(row.start_at).toISOString(),
        attendees: [{ email: who.email }],
      }),
    };
    await request("/me", undefined, who, { cal: cancelling });
    await request("/me", undefined, who, { cal: cancelling });
    return (await data("/me", undefined, who)).credits;
  }
  assert.equal(await bookAndCancel(3), 6);
  assert.equal(await bookAndCancel(0.5), 5);
});

test("a taken time refunds the lesson, and a second paid checkout is refunded", async () => {
  const { who } = await groupUser("lesson-client");
  const flow = await data("/flows", { service: "virtual_private", childId: null }, who);
  const first = await data(`/flows/${flow.id}/book`, later(4), who);
  const second = await data(`/flows/${flow.id}/book`, later(4), who);
  const taken = {
    ...cal,
    create: async () => {
      const { HttpError } = await import("../server/http.js");
      throw new HttpError(409, "That time is no longer available.");
    },
  };
  const firstId = markPaid(first.checkoutUrl);
  const response = await request("/checkout/complete", { sessionId: firstId }, who, { cal: taken });
  assert.equal((await response.json()).booking.status, "unavailable");
  assert.deepEqual(refunds.at(-1), { paymentIntent: "pi_" + firstId, key: `refund-${(await db.query("SELECT id FROM payments WHERE stripe_session_id=$1", [firstId]))[0].id}` });
  const secondId = markPaid(second.checkoutUrl);
  const before = refunds.length;
  await data("/checkout/complete", { sessionId: secondId }, who);
  assert.equal(refunds.length, before + 1);
  assert.equal(refunds.at(-1).paymentIntent, "pi_" + secondId);
  const statuses = await db.query("SELECT status FROM payments WHERE flow_id=$1", [flow.id]);
  assert.deepEqual(statuses.map((p) => p.status), ["refunded", "refunded"]);
});

test("Stripe webhooks require a fresh valid signature and settle the payment", async () => {
  const { who } = await groupUser("webhook-client");
  const { checkoutUrl } = await data("/credits/checkout", { flowId: null }, who);
  const id = markPaid(checkoutUrl);
  env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  const raw = JSON.stringify({
    type: "checkout.session.completed",
    data: { object: sessions.get(id) },
  });
  async function sign(t, body = raw) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const v1 = Buffer.from(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`)),
    ).toString("hex");
    return `t=${t},v1=${v1}`;
  }
  const now = Math.floor(Date.now() / 1000);
  assert.equal(await verifyStripeSignature(raw, await sign(now - 600), env.STRIPE_WEBHOOK_SECRET), false);
  assert.equal(await verifyStripeSignature(raw + " ", await sign(now), env.STRIPE_WEBHOOK_SECRET), false);
  const post = async (signature) =>
    stripeWebhook(
      new Request("https://test.invalid/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": signature },
        body: raw,
      }),
      env,
      { db, cal, pay },
    );
  await assert.rejects(post("t=1,v1=00"), (e) => e.status === 401);
  await post(await sign(now));
  await post(await sign(now));
  assert.equal((await data("/me", undefined, who)).credits, 6);
});

test("group times are public, start October 13, and mark full classes", async () => {
  delete env.GROUP_FIRST_CLASS;
  const slots = {
    "2026-10-07": [{ start: "2026-10-07T12:00:00.000-04:00", seatsRemaining: 50 }],
    "2026-10-13": [{ start: "2026-10-13T19:00:00.000-04:00", seatsRemaining: 0 }],
    "2026-10-14": [{ start: "2026-10-14T12:00:00.000-04:00", seatsRemaining: 12 }],
  };
  let requested;
  const groupCal = {
    ...cal,
    slots: async (id, start, end) => {
      requested = { id, start, end };
      return slots;
    },
  };
  const response = await publicGroupTimes(
    new Request("https://test.invalid/api/public/group-times"),
    env,
    { db, cal: groupCal },
  );
  assert.equal(requested.id, 100);
  assert.ok(Date.parse(requested.end) - Date.parse(requested.start) >= 59 * 86400000);
  assert.deepEqual((await response.json()).classes, [
    { start: "2026-10-13T23:00:00.000Z", full: true },
    { start: "2026-10-14T16:00:00.000Z", full: false },
  ]);
  const { who, flow } = await groupUser("group-viewer");
  const portalSlots = await (
    await request(
      `/flows/${flow.id}/slots?${new URLSearchParams({
        start: new Date().toISOString(),
        end: new Date(Date.now() + 7 * 86400000).toISOString(),
      })}`,
      undefined,
      who,
      { cal: groupCal },
    )
  ).json();
  assert.deepEqual(Object.keys(portalSlots.slots), ["2026-10-13", "2026-10-14"]);
});

