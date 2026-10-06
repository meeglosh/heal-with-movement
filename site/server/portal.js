import { isAdult, easternDate } from "./age.js";
import { json, readJSON, checkOrigin, HttpError } from "./http.js";
import { encryptIntake, decryptIntake, verifySignature } from "./crypto.js";
import { eventId, validateEvent } from "./cal.js";
import { PRICES, stripe, verifyStripeSignature } from "./stripe.js";
import {
  id,
  childInput,
  flowInput,
  intakeInput,
  adultIntakeInput,
  bookingInput,
  creditCheckoutInput,
  checkoutCompleteInput,
} from "./validation.js";
import { adultIntakeForm } from "./adult-intake-form.js";
import { intakeForm } from "./intake-form.js";

// Heidi's group classes start on this date; Cal.com's weekly schedule
// would otherwise offer earlier weeks.
export const GROUP_FIRST_CLASS = "2026-10-13";
const firstClass = (env) => env.GROUP_FIRST_CLASS || GROUP_FIRST_CLASS;
function groupDays(slots, env) {
  return Object.fromEntries(
    Object.entries(slots).filter(([day]) => day >= firstClass(env)),
  );
}
// Heidi needs intake before in-person sessions only; virtual sessions skip it.
const needsIntake = (f) =>
  ["montreal", "vermont"].includes(f.service) &&
  (!f.completed_at || !!f.review_due);
function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new HttpError(400, "Please check the form fields and try again.");
  return result.data;
}
export function isStaff(user, env) {
  return (
    user.emailVerified &&
    String(env.STAFF_EMAILS || "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
      .includes(user.email.toLowerCase())
  );
}
export async function limit(db, key, max = 60) {
  const [row] = await db.query(
    `INSERT INTO api_limits(key,count,expires_at) VALUES($1,1,now()+interval '1 minute') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN api_limits.expires_at<now() THEN 1 ELSE api_limits.count+1 END, expires_at=CASE WHEN api_limits.expires_at<now() THEN now()+interval '1 minute' ELSE api_limits.expires_at END RETURNING count`,
    [key],
  );
  if (row.count > max)
    throw new HttpError(429, "Please wait a minute before trying again.");
}
export async function ownedFlow(db, userId, flowId) {
  parse(id, flowId);
  const [flow] = await db.query(
    `SELECT f.*,c.name AS child_name,c.birth_date::text AS birth_date,CASE WHEN f.child_id IS NULL THEN a.completed_at ELSE i.completed_at END AS completed_at,CASE WHEN f.child_id IS NULL THEN a.reviewed_at ELSE i.reviewed_at END AS reviewed_at,CASE WHEN f.child_id IS NULL THEN a.version ELSE i.version END AS intake_version,CASE WHEN f.child_id IS NULL THEN a.reviewed_at ELSE i.reviewed_at END + interval '6 months' <= now() AS review_due FROM booking_flows f LEFT JOIN children c ON c.id=f.child_id LEFT JOIN intakes i ON i.child_id=f.child_id LEFT JOIN adult_intakes a ON a.user_id=f.user_id WHERE f.id=$1 AND f.user_id=$2 AND f.expires_at>now() AND (f.child_id IS NULL OR c.guardian_id=$2)`,
    [flowId, userId],
  );
  if (!flow)
    throw new HttpError(
      404,
      "This booking has expired or could not be found. Please start again.",
    );
  if (flow.child_id && isAdult(flow.birth_date))
    throw new HttpError(
      403,
      "At 18, clients must use their own account, complete adult intake, and book for themselves.",
    );
  return flow;
}
function publicFlow(f) {
  return {
    id: f.id,
    service: f.service,
    childId: f.child_id,
    childName: f.child_name,
    birthDate: f.birth_date ? String(f.birth_date).slice(0, 10) : null,
    needsIntake: needsIntake(f),
    reviewDue: !!f.review_due,
  };
}
function publicBooking(b) {
  return {
    id: b.id,
    service: b.service,
    childName: b.child_name || null,
    start: b.start_at,
    status: b.status,
  };
}
export async function portal(
  request,
  env,
  { db, auth, cal, pay = stripe(env) },
) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/portal/, "");
  checkOrigin(request, env.APP_ORIGIN);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.emailVerified)
    throw new HttpError(401, "Please sign in to continue.");
  const user = session.user;
  await db.query(
    "INSERT INTO portal_users(id,name,email) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email",
    [user.id, user.name || "", user.email],
  );
  await limit(db, user.id, request.method === "GET" ? 120 : 30);
  if (path === "/me" && request.method === "GET") {
    const children = await db.query(
      "SELECT c.id,c.name,c.birth_date::text AS birth_date,i.completed_at FROM children c LEFT JOIN intakes i ON i.child_id=c.id WHERE c.guardian_id=$1 ORDER BY c.created_at",
      [user.id],
    );
    const bookings = await db.query(
      "SELECT b.*,c.name AS child_name FROM bookings b LEFT JOIN children c ON c.id=b.child_id WHERE b.user_id=$1 ORDER BY b.start_at DESC LIMIT 50",
      [user.id],
    );
    // Refresh recent active appointments even before a production webhook is connected.
    // A calendar outage must not prevent the parent from opening their account.
    await Promise.all(
      bookings
        .filter((b) => b.cal_uid && ["pending", "accepted"].includes(b.status))
        .slice(0, 10)
        .map(async (booking) => {
          try {
            await refreshBooking(
              db,
              cal,
              { ...booking, email: user.email },
              undefined,
              booking,
              pay,
            );
          } catch {
            /* Keep the last known status when Cal.com is temporarily unavailable. */
          }
        }),
    );
    const reviews = await db.query(
      "SELECT c.id::text,c.name,'child' AS kind,i.reviewed_at + interval '6 months' AS due_at FROM intakes i JOIN children c ON c.id=i.child_id WHERE c.guardian_id=$1 AND i.reviewed_at + interval '6 months' <= now() UNION ALL SELECT a.user_id,u.name,'adult' AS kind,a.reviewed_at + interval '6 months' AS due_at FROM adult_intakes a JOIN portal_users u ON u.id=a.user_id WHERE a.user_id=$1 AND a.reviewed_at + interval '6 months' <= now()",
      [user.id],
    );
    const [credit] = await db.query(
      "SELECT balance FROM credit_balances WHERE user_id=$1",
      [user.id],
    );
    return json({
      credits: credit?.balance || 0,
      reviews: reviews.filter(
        (r) =>
          r.kind === "adult" ||
          !isAdult(children.find((c) => c.id === r.id).birth_date),
      ),
      user: { name: user.name, email: user.email },
      staff: isStaff(user, env),
      children: children.map((c) => ({
        id: c.id,
        name: c.name,
        birthDate: c.birth_date,
        intakeComplete: !!c.completed_at,
        adultAccountRequired: isAdult(c.birth_date),
      })),
      bookings: bookings.map(publicBooking),
    });
  }
  if (path === "/children" && request.method === "POST") {
    const value = parse(childInput, await readJSON(request));
    if (isAdult(value.birthDate))
      throw new HttpError(
        400,
        "Clients aged 18 or older must create their own account and book for themselves.",
      );
    const [child] = await db.query(
      `INSERT INTO children(id,guardian_id,name,birth_date) VALUES($1,$2,$3,$4) ON CONFLICT(guardian_id,name,birth_date) DO UPDATE SET name=EXCLUDED.name RETURNING id,name,birth_date`,
      [crypto.randomUUID(), user.id, value.name, value.birthDate],
    );
    return json({ child }, 201);
  }
  if (path === "/flows" && request.method === "POST") {
    const value = parse(flowInput, await readJSON(request));
    if (value.childId) {
      const [child] = await db.query(
        "SELECT id,birth_date::text AS birth_date FROM children WHERE id=$1 AND guardian_id=$2",
        [value.childId, user.id],
      );
      if (!child) throw new HttpError(404, "Child profile not found.");
      if (isAdult(child.birth_date))
        throw new HttpError(
          403,
          "This client is now 18 or older and must book through their own account with adult intake.",
        );
    }
    const [flow] = await db.query(
      "INSERT INTO booking_flows(id,user_id,child_id,service) VALUES($1,$2,$3,$4) RETURNING id",
      [crypto.randomUUID(), user.id, value.childId, value.service],
    );
    return json(publicFlow(await ownedFlow(db, user.id, flow.id)), 201);
  }
  const match = path.match(/^\/flows\/([^/]+)(?:\/(intake|slots|book))?$/);
  if (match) {
    const flow = await ownedFlow(db, user.id, match[1]);
    const action = match[2];
    if (!action && request.method === "GET") return json(publicFlow(flow));
    if (action === "intake") {
      if (flow.completed_at && !flow.review_due)
        throw new HttpError(409, "Intake is already complete.");
      const scope = flow.child_id || `adult:${user.id}`;
      const table = flow.child_id ? "intakes" : "adult_intakes";
      const key = flow.child_id ? "child_id" : "user_id";
      const subject = flow.child_id || user.id;
      if (request.method === "GET") {
        const [saved] = flow.review_due
          ? await db.query(
              `SELECT encrypted_payload,version FROM ${table} WHERE ${key}=$1`,
              [subject],
            )
          : [];
        return json({
          reviewVersion: saved?.version,
          answers: saved
            ? await decryptIntake(
                saved.encrypted_payload,
                env.INTAKE_ENCRYPTION_KEY,
                scope,
              )
            : null,
          html: flow.child_id ? intakeForm : adultIntakeForm,
          adultName: user.name,
          childName: flow.child_name,
          birthDate: flow.birth_date,
          email: user.email,
        });
      }
      if (request.method === "POST") {
        const body = await readJSON(request);
        const { reviewVersion, unchanged, ...answers } = body;
        if (
          flow.review_due &&
          (!Number.isInteger(reviewVersion) ||
            reviewVersion !== flow.intake_version)
        )
          throw new HttpError(
            409,
            "This intake has been updated. Please reload it.",
          );
        if (unchanged !== undefined && unchanged !== true)
          throw new HttpError(400, "Invalid review confirmation.");
        if (unchanged && !flow.review_due)
          throw new HttpError(
            400,
            "Complete intake before confirming a review.",
          );
        if (unchanged && Object.keys(answers).length)
          throw new HttpError(400, "Choose confirmation or updated answers.");
        if (flow.review_due && unchanged) {
          const rows = await db.query(
            `UPDATE ${table} SET reviewed_at=now(),version=version+1 WHERE ${key}=$1 AND version=$2 AND reviewed_at + interval '6 months' <= now() RETURNING version`,
            [subject, reviewVersion],
          );
          if (!rows.length)
            throw new HttpError(409, "This intake has already been reviewed.");
          await db.query(
            "INSERT INTO audit_events(id,actor_id,action,child_id,subject_user_id) VALUES($1,$2,$3,$4,$5)",
            [
              crypto.randomUUID(),
              user.id,
              "intake.review.unchanged",
              flow.child_id,
              flow.child_id ? null : user.id,
            ],
          );
          return json({ ok: true });
        }
        const data = parse(
          flow.child_id ? intakeInput : adultIntakeInput,
          answers,
        );
        // Identity belongs to the authenticated guardian and child record, never a submitted ID/email.
        if (flow.child_id) {
          data.clientName = flow.child_name;
          data.birthDate = String(flow.birth_date).slice(0, 10);
        }
        data.email = user.email;
        if (data.signDate !== new Date().toISOString().slice(0, 10))
          throw new HttpError(
            400,
            "Please use today’s date for your signature.",
          );
        const encrypted = await encryptIntake(
          data,
          env.INTAKE_ENCRYPTION_KEY,
          flow.child_id || `adult:${user.id}`,
        );
        if (flow.review_due) {
          // Lock, archive the previous signed form, and replace it atomically.
          const rows = await db.query(
            `WITH previous AS (SELECT * FROM ${table} WHERE ${key}=$1 AND version=$2 AND reviewed_at + interval '6 months' <= now() FOR UPDATE), archived AS (INSERT INTO intake_review_history(id,actor_id,child_id,subject_user_id,encrypted_payload,version,reviewed_at) SELECT $4,$5,$6,$7,encrypted_payload,version,reviewed_at FROM previous RETURNING id) UPDATE ${table} SET encrypted_payload=$3,reviewed_at=now(),version=${table}.version+1 WHERE ${key}=$1 AND version=$2 AND EXISTS(SELECT 1 FROM archived) RETURNING version`,
            [
              subject,
              reviewVersion,
              encrypted,
              crypto.randomUUID(),
              user.id,
              flow.child_id,
              flow.child_id ? null : user.id,
            ],
          );
          if (!rows.length)
            throw new HttpError(409, "This intake has already been reviewed.");
          return json({ ok: true });
        }
        const rows = flow.child_id
          ? await db.query(
              "INSERT INTO intakes(child_id,guardian_id,encrypted_payload) VALUES($1,$2,$3) ON CONFLICT(child_id) DO NOTHING RETURNING child_id",
              [flow.child_id, user.id, encrypted],
            )
          : await db.query(
              "INSERT INTO adult_intakes(user_id,encrypted_payload) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING RETURNING user_id",
              [user.id, encrypted],
            );
        // A second tab cannot overwrite an intake already saved by the first.
        if (!rows.length)
          throw new HttpError(409, "Intake is already complete.");
        return json({ ok: true });
      }
    }
    if (["slots", "book"].includes(action)) {
      if (needsIntake(flow))
        throw new HttpError(
          409,
          "Please complete or review intake before choosing a time.",
        );
      const eid = eventId(env, flow.service, !!flow.child_id);
      const event = await cal.event(eid);
      validateEvent(event, !!flow.child_id);
      if (action === "slots" && request.method === "GET") {
        const start = url.searchParams.get("start"),
          end = url.searchParams.get("end"),
          tz = url.searchParams.get("timeZone") || "America/New_York";
        if (
          !start ||
          !end ||
          !Number.isFinite(Date.parse(start)) ||
          !Number.isFinite(Date.parse(end)) ||
          Date.parse(end) <= Date.parse(start) ||
          Date.parse(end) - Date.parse(start) > 15 * 86400000
        )
          throw new HttpError(400, "Choose a date range of up to two weeks.");
        let data = await cal.slots(eid, start, end, tz);
        if (flow.service === "virtual") data = groupDays(data, env);
        return json({
          slots: flow.child_id
            ? Object.fromEntries(
                Object.entries(data).map(([day, slots]) => [
                  day,
                  slots.filter(
                    (slot) =>
                      !isAdult(
                        flow.birth_date,
                        easternDate(new Date(slot.start)),
                      ),
                  ),
                ]),
              )
            : data,
          duration: event.lengthInMinutes,
          title: event.title,
        });
      }
      if (action === "book" && request.method === "POST") {
        const input = parse(bookingInput, await readJSON(request));
        if (
          flow.child_id &&
          isAdult(flow.birth_date, easternDate(new Date(input.start)))
        )
          throw new HttpError(
            403,
            "Appointments on or after the 18th birthday must be booked by the adult through their own account.",
          );
        if (Date.parse(input.start) <= Date.now())
          throw new HttpError(400, "Please choose a future appointment.");
        const virtual = ["virtual", "virtual_private"].includes(flow.service);
        // Virtual sessions skip intake, so the client agrees to the disclaimer instead.
        if (virtual && input.agreed !== true)
          throw new HttpError(
            400,
            "Please agree to the Medical Disclaimer and Cancellation Policy to continue.",
          );
        if (
          flow.service === "virtual" &&
          easternDate(new Date(input.start)) < firstClass(env)
        )
          throw new HttpError(400, "Group classes begin October 13, 2026.");
        const [existing] = await db.query(
          "SELECT * FROM bookings WHERE flow_id=$1 AND user_id=$2",
          [flow.id, user.id],
        );
        if (existing)
          return json(
            { booking: publicBooking(existing) },
            existing.status === "creating" ? 202 : 200,
          );
        if (virtual)
          await db.query(
            "INSERT INTO audit_events(id,actor_id,action,child_id,subject_user_id) VALUES($1,$2,$3,$4,$5)",
            [
              crypto.randomUUID(),
              user.id,
              "disclaimer.accepted",
              flow.child_id,
              flow.child_id ? null : user.id,
            ],
          );
        if (flow.service === "virtual_private")
          return json({
            checkoutUrl: await startLessonCheckout(db, pay, env, {
              flow,
              user,
              input,
            }),
          });
        const usesCredit = flow.service === "virtual";
        const bookingId = crypto.randomUUID();
        const values = [
          bookingId,
          flow.id,
          user.id,
          flow.child_id,
          flow.service,
          eid,
          input.start,
          input.timeZone,
        ];
        // Claim the booking and spend one class credit in a single statement, so
        // retries and concurrent tabs can never spend a credit twice.
        const rows = usesCredit
          ? await db.query(
              `WITH b AS (INSERT INTO bookings(id,flow_id,user_id,child_id,service,event_type_id,start_at,time_zone,uses_credit) VALUES($1,$2,$3,$4,$5,$6,$7,$8,true) ON CONFLICT(flow_id) DO NOTHING RETURNING *), d AS (UPDATE credit_balances SET balance=balance-1 WHERE user_id=$3 AND balance>=1 AND EXISTS(SELECT 1 FROM b) RETURNING user_id), l AS (INSERT INTO credit_ledger(id,user_id,delta,reason,booking_id) SELECT $9,user_id,-1,'booking',$1 FROM d) SELECT b.*,EXISTS(SELECT 1 FROM d) AS debited FROM b`,
              [...values, crypto.randomUUID()],
            )
          : await db.query(
              `INSERT INTO bookings(id,flow_id,user_id,child_id,service,event_type_id,start_at,time_zone) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(flow_id) DO NOTHING RETURNING *`,
              values,
            );
        if (!rows.length)
          throw new HttpError(
            409,
            "This booking is already being processed. Check your appointments.",
          );
        if (usesCredit && !rows[0].debited) {
          await db.query("DELETE FROM bookings WHERE id=$1", [bookingId]);
          throw new HttpError(
            402,
            "You have no class credits left. Buy a class package to book.",
          );
        }
        const saved = await sendToCalendar(db, cal, pay, rows[0], {
          name: input.name,
          email: user.email,
          timeZone: input.timeZone,
        });
        return json({ booking: publicBooking(saved) }, 201);
      }
    }
  }
  if (path === "/credits/checkout" && request.method === "POST") {
    const { flowId } = parse(creditCheckoutInput, await readJSON(request));
    if (flowId) await ownedFlow(db, user.id, flowId);
    const price = PRICES.group_credits;
    const paymentId = crypto.randomUUID();
    await db.query(
      "INSERT INTO payments(id,user_id,kind,amount,currency,credits) VALUES($1,$2,'group_credits',$3,$4,$5)",
      [paymentId, user.id, price.amount, price.currency, price.credits],
    );
    const back = flowId
      ? `/book.html?flow=${encodeURIComponent(flowId)}`
      : "/account.html";
    return json({
      checkoutUrl: await openCheckout(db, pay, env, {
        paymentId,
        user,
        price,
        back,
      }),
    });
  }
  if (path === "/checkout/complete" && request.method === "POST") {
    const { sessionId } = parse(checkoutCompleteInput, await readJSON(request));
    const [payment] = await db.query(
      "SELECT * FROM payments WHERE stripe_session_id=$1 AND user_id=$2",
      [sessionId, user.id],
    );
    if (!payment) throw new HttpError(404, "Payment not found.");
    const result = await settle(
      { db, cal, pay, env },
      payment,
      await pay.getSession(sessionId),
    );
    const [credit] = await db.query(
      "SELECT balance FROM credit_balances WHERE user_id=$1",
      [user.id],
    );
    return json({
      kind: payment.kind,
      paid: result.paid,
      credits: credit?.balance || 0,
      booking: result.booking ? publicBooking(result.booking) : null,
    });
  }
  if (path === "/admin/intakes" && request.method === "GET") {
    if (!isStaff(user, env)) throw new HttpError(403, "Staff access required.");
    return json({
      intakes: await db.query(
        "SELECT c.id::text,c.name,i.completed_at,u.name AS guardian_name, 'child' AS kind FROM intakes i JOIN children c ON c.id=i.child_id JOIN portal_users u ON u.id=i.guardian_id UNION ALL SELECT a.user_id,u.name,a.completed_at,NULL AS guardian_name,'adult' AS kind FROM adult_intakes a JOIN portal_users u ON u.id=a.user_id ORDER BY completed_at DESC LIMIT 100",
      ),
    });
  }
  const adultAdmin = path.match(/^\/admin\/adult-intakes\/([^/]+)$/);
  if (adultAdmin && request.method === "GET") {
    if (!isStaff(user, env)) throw new HttpError(403, "Staff access required.");
    const subject = decodeURIComponent(adultAdmin[1]);
    const [row] = await db.query(
      "SELECT * FROM adult_intakes WHERE user_id=$1",
      [subject],
    );
    if (!row) throw new HttpError(404, "Intake not found.");
    await db.query(
      "INSERT INTO audit_events(id,actor_id,action,subject_user_id) VALUES($1,$2,$3,$4)",
      [crypto.randomUUID(), user.id, "adult_intake.read", subject],
    );
    return json({
      intake: await decryptIntake(
        row.encrypted_payload,
        env.INTAKE_ENCRYPTION_KEY,
        `adult:${subject}`,
      ),
      completedAt: row.completed_at,
      reviewedAt: row.reviewed_at,
    });
  }
  const admin = path.match(/^\/admin\/intakes\/([^/]+)$/);
  if (admin && request.method === "GET") {
    if (!isStaff(user, env)) throw new HttpError(403, "Staff access required.");
    parse(id, admin[1]);
    const [row] = await db.query("SELECT * FROM intakes WHERE child_id=$1", [
      admin[1],
    ]);
    if (!row) throw new HttpError(404, "Intake not found.");
    await db.query(
      "INSERT INTO audit_events(id,actor_id,action,child_id) VALUES($1,$2,$3,$4)",
      [crypto.randomUUID(), user.id, "intake.read", admin[1]],
    );
    return json({
      intake: await decryptIntake(
        row.encrypted_payload,
        env.INTAKE_ENCRYPTION_KEY,
        admin[1],
      ),
      completedAt: row.completed_at,
      reviewedAt: row.reviewed_at,
    });
  }
  throw new HttpError(404, "Not found.");
}

export async function calWebhook(request, env, { db, cal, pay = stripe(env) }) {
  if (request.method !== "POST")
    throw new HttpError(405, "Method not allowed.");
  const data = await readJSON(request.clone());
  const raw = await request.text();
  if (
    !(await verifySignature(
      raw,
      request.headers.get("x-cal-signature-256"),
      env.CAL_WEBHOOK_SECRET,
    ))
  )
    throw new HttpError(401, "Invalid webhook signature.");
  const payload = data.payload;
  if (!payload?.uid) return json({ ok: true });
  // Signed events are notifications; current Cal state is the source of truth.
  let remote = await cal.get(payload.uid);
  const previous = remote.rescheduledFromUid || null;
  const candidates = await db.query(
    "SELECT b.*,u.email FROM bookings b JOIN portal_users u ON u.id=b.user_id WHERE b.cal_uid=$1 OR b.cal_uid=$2",
    [payload.uid, previous],
  );
  for (const booking of candidates)
    await refreshBooking(db, cal, booking, remote, undefined, pay);
  return json({ ok: true });
}

async function refreshBooking(db, cal, booking, remote, target, pay) {
  let current = booking.cal_seat_uid
    ? await cal.getSeat(booking.cal_seat_uid)
    : remote || (await cal.get(booking.cal_uid));
  // Follow a reschedule even when an older cancellation notification arrives last.
  for (let i = 0; i < 5 && current.rescheduledToUid; i++)
    current = await cal.get(current.rescheduledToUid);
  if ((current.eventType?.id || current.eventTypeId) !== booking.event_type_id)
    return;
  const attendee = current.attendees?.find(
    (a) => a.email?.toLowerCase() === booking.email.toLowerCase(),
  );
  if (!attendee) return;
  const status = attendee.status === "cancelled" ? "cancelled" : current.status;
  if (
    !["accepted", "pending", "cancelled", "rejected"].includes(status) ||
    !Number.isFinite(Date.parse(current.start))
  )
    return;
  await db.query(
    "UPDATE bookings SET cal_uid=$2,status=$3,start_at=$4,updated_at=now() WHERE id=$1",
    [booking.id, current.uid, status, current.start],
  );
  // Cancellations with 24 hours' notice, and Heidi's rejections, return the
  // payment or class credit. Later cancellations forfeit it unless Heidi waives.
  const ended = ["cancelled", "rejected"];
  if (
    !ended.includes(booking.status) &&
    (status === "rejected" ||
      (status === "cancelled" &&
        Date.parse(current.start) - Date.now() >= 24 * 3600000))
  )
    await compensate(db, pay, booking);

  if (target)
    Object.assign(target, {
      cal_uid: current.uid,
      status,
      start_at: current.start,
    });
}

async function sendToCalendar(db, cal, pay, booking, attendee) {
  // Durable creation claim prevents repeated clicks or network retries from double-booking.
  // An uncertain upstream response is retained for reconciliation, never blindly retried.
  let remote;
  try {
    remote = await cal.create({
      eventTypeId: booking.event_type_id,
      start: new Date(booking.start_at).toISOString(),
      attendee: { ...attendee, language: "en" },
      metadata: { portalBookingId: booking.id },
    });
  } catch (error) {
    if (error instanceof HttpError && error.status === 409) {
      // Cal.com definitively refused the time, so nothing was booked.
      await db.query(
        "UPDATE bookings SET status='unavailable',updated_at=now() WHERE id=$1",
        [booking.id],
      );
      await compensate(db, pay, booking);
    } else
      await db.query(
        "UPDATE bookings SET status='needs_review',updated_at=now() WHERE id=$1 AND cal_uid IS NULL",
        [booking.id],
      );
    throw error;
  }
  if (!remote?.uid) {
    await db.query("UPDATE bookings SET status='needs_review' WHERE id=$1", [
      booking.id,
    ]);
    throw new HttpError(
      502,
      "Please check your appointments or contact Heidi before trying again.",
    );
  }
  // Leave pending requests for Heidi to accept or reject in Cal.com.
  const [saved] = await db.query(
    "UPDATE bookings SET cal_uid=$2,status=$3,cal_seat_uid=$4,updated_at=now() WHERE id=$1 RETURNING *",
    [
      booking.id,
      remote.uid,
      remote.status || "pending",
      remote.seatUid || null,
    ],
  );
  return saved;
}

async function compensate(db, pay, booking) {
  if (booking.uses_credit)
    await db.query(
      "WITH l AS (INSERT INTO credit_ledger(id,user_id,delta,reason,booking_id) VALUES($1,$2,1,'restore',$3) ON CONFLICT (booking_id) WHERE reason='restore' DO NOTHING RETURNING user_id) UPDATE credit_balances SET balance=balance+1 WHERE user_id IN (SELECT user_id FROM l)",
      [crypto.randomUUID(), booking.user_id, booking.id],
    );
  if (booking.payment_id) await refundPayment(db, pay, booking.payment_id);
}

async function refundPayment(db, pay, paymentId) {
  const [payment] = await db.query(
    "SELECT * FROM payments WHERE id=$1 AND status='paid'",
    [paymentId],
  );
  if (!payment?.stripe_payment_intent) return;
  // The idempotency key makes a repeated refund request a no-op at Stripe.
  await pay.refund(payment.stripe_payment_intent, `refund-${paymentId}`);
  await db.query(
    "UPDATE payments SET status='refunded',updated_at=now() WHERE id=$1",
    [paymentId],
  );
}

async function openCheckout(db, pay, env, { paymentId, user, price, back }) {
  const join = back.includes("?") ? "&" : "?";
  const session = await pay.createSession(
    {
      mode: "payment",
      customer_email: user.email,
      client_reference_id: paymentId,
      success_url: `${env.APP_ORIGIN}${back}${join}checkout={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_ORIGIN}${back}${join}checkout=cancelled`,
      // Stripe's minimum; keeps an unpaid lesson from lingering.
      expires_at: Math.floor(Date.now() / 1000) + 1800,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: price.currency,
            unit_amount: price.amount,
            product_data: { name: price.name },
          },
        },
      ],
      metadata: { payment_id: paymentId },
      payment_intent_data: { metadata: { payment_id: paymentId } },
    },
    `checkout-${paymentId}`,
  );
  if (!session?.id || !session.url)
    throw new HttpError(502, "The payment could not be started.");
  await db.query(
    "UPDATE payments SET stripe_session_id=$2,updated_at=now() WHERE id=$1",
    [paymentId, session.id],
  );
  return session.url;
}

async function startLessonCheckout(db, pay, env, { flow, user, input }) {
  const price = PRICES.virtual_private;
  const paymentId = crypto.randomUUID();
  await db.query(
    "INSERT INTO payments(id,user_id,kind,flow_id,start_at,time_zone,attendee_name,amount,currency) VALUES($1,$2,'private_lesson',$3,$4,$5,$6,$7,$8)",
    [
      paymentId,
      user.id,
      flow.id,
      input.start,
      input.timeZone,
      input.name,
      price.amount,
      price.currency,
    ],
  );
  return openCheckout(db, pay, env, {
    paymentId,
    user,
    price,
    back: `/book.html?flow=${encodeURIComponent(flow.id)}`,
  });
}

// Applies a Checkout Session to local state. Safe to run repeatedly, from the
// browser return and the Stripe webhook alike.
async function settle({ db, cal, pay, env }, payment, session) {
  if (
    session?.id !== payment.stripe_session_id &&
    session?.metadata?.payment_id !== payment.id
  )
    throw new HttpError(400, "Payment does not match.");
  if (session.payment_status !== "paid") {
    if (session.status === "expired")
      await db.query(
        "UPDATE payments SET status='expired',updated_at=now() WHERE id=$1 AND status='open'",
        [payment.id],
      );
    return { paid: false };
  }
  const intent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (payment.kind === "group_credits") {
    await db.query(
      "WITH p AS (UPDATE payments SET status='paid',stripe_payment_intent=$2,stripe_session_id=$3,updated_at=now() WHERE id=$1 AND status IN ('open','expired') RETURNING id,user_id,credits), l AS (INSERT INTO credit_ledger(id,user_id,delta,reason,payment_id) SELECT $4,user_id,credits,'purchase',id FROM p RETURNING user_id,delta) INSERT INTO credit_balances(user_id,balance) SELECT user_id,delta FROM l ON CONFLICT(user_id) DO UPDATE SET balance=credit_balances.balance+EXCLUDED.balance",
      [payment.id, intent, session.id, crypto.randomUUID()],
    );
    return { paid: true };
  }
  await db.query(
    "UPDATE payments SET status='paid',stripe_payment_intent=$2,stripe_session_id=$3,updated_at=now() WHERE id=$1 AND status IN ('open','expired')",
    [payment.id, intent, session.id],
  );
  const [flow] = await db.query(
    "SELECT f.*,u.email FROM booking_flows f JOIN portal_users u ON u.id=f.user_id WHERE f.id=$1 AND f.user_id=$2",
    [payment.flow_id, payment.user_id],
  );
  const [claimed] = await db.query(
    "INSERT INTO bookings(id,flow_id,user_id,child_id,service,event_type_id,start_at,time_zone,payment_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(flow_id) DO NOTHING RETURNING *",
    [
      crypto.randomUUID(),
      flow.id,
      flow.user_id,
      flow.child_id,
      flow.service,
      eventId(env, flow.service, !!flow.child_id),
      payment.start_at,
      payment.time_zone,
      payment.id,
    ],
  );
  if (!claimed) {
    const [existing] = await db.query(
      "SELECT * FROM bookings WHERE flow_id=$1",
      [flow.id],
    );
    // A second paid checkout for the same booking (another tab) is refunded.
    if (existing.payment_id !== payment.id)
      await refundPayment(db, pay, payment.id);
    return { paid: true, booking: existing };
  }
  try {
    return {
      paid: true,
      booking: await sendToCalendar(db, cal, pay, claimed, {
        name: payment.attendee_name,
        email: flow.email,
        timeZone: payment.time_zone,
      }),
    };
  } catch (error) {
    const [booking] = await db.query("SELECT * FROM bookings WHERE id=$1", [
      claimed.id,
    ]);
    if (booking.status === "unavailable") return { paid: true, booking };
    throw error;
  }
}

export async function stripeWebhook(
  request,
  env,
  { db, cal, pay = stripe(env) },
) {
  if (request.method !== "POST")
    throw new HttpError(405, "Method not allowed.");
  const raw = await request.text();
  if (
    !(await verifyStripeSignature(
      raw,
      request.headers.get("stripe-signature"),
      env.STRIPE_WEBHOOK_SECRET,
    ))
  )
    throw new HttpError(401, "Invalid webhook signature.");
  const event = JSON.parse(raw);
  const handled = [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.expired",
  ];
  if (!handled.includes(event.type)) return json({ ok: true });
  const session = event.data?.object;
  const [payment] = await db.query(
    "SELECT * FROM payments WHERE stripe_session_id=$1 OR id::text=$2",
    [session?.id, String(session?.metadata?.payment_id || "")],
  );
  if (!payment) return json({ ok: true });
  try {
    await settle({ db, cal, pay, env }, payment, session);
  } catch (error) {
    // The booking is recorded for review; Stripe retrying would not help.
    if (!(error instanceof HttpError)) throw error;
  }
  return json({ ok: true });
}

// Group times are public so visitors can see them before signing in.
export async function publicGroupTimes(request, env, { db, cal }) {
  if (request.method !== "GET") throw new HttpError(405, "Method not allowed.");
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ip),
  );
  await limit(
    db,
    "public:" +
      Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join(""),
    30,
  );
  const start = new Date();
  const end = new Date(start.getTime() + 60 * 86400000);
  const data = groupDays(
    await cal.slots(
      eventId(env, "virtual", false),
      start.toISOString(),
      end.toISOString(),
      "America/New_York",
    ),
    env,
  );
  return json({
    classes: Object.values(data)
      .flat()
      .map((slot) => ({
        start: new Date(
          typeof slot === "string" ? slot : slot.start,
        ).toISOString(),
        full: typeof slot === "object" && slot.seatsRemaining === 0,
      })),
  });
}
