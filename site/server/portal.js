import { json, readJSON, checkOrigin, HttpError } from "./http.js";
import { encryptIntake, decryptIntake, verifySignature } from "./crypto.js";
import { eventId, validateEvent } from "./cal.js";
import {
  id,
  childInput,
  flowInput,
  intakeInput,
  bookingInput,
} from "./validation.js";
import { intakeForm } from "./intake-form.js";

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
    `SELECT f.*,c.name AS child_name,c.birth_date,i.completed_at FROM booking_flows f LEFT JOIN children c ON c.id=f.child_id LEFT JOIN intakes i ON i.child_id=f.child_id WHERE f.id=$1 AND f.user_id=$2 AND f.expires_at>now() AND (f.child_id IS NULL OR c.guardian_id=$2)`,
    [flowId, userId],
  );
  if (!flow)
    throw new HttpError(
      404,
      "This booking has expired or could not be found. Please start again.",
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
    needsIntake: !!f.child_id && !f.completed_at,
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
export async function portal(request, env, { db, auth, cal }) {
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
      "SELECT c.id,c.name,c.birth_date,i.completed_at FROM children c LEFT JOIN intakes i ON i.child_id=c.id WHERE c.guardian_id=$1 ORDER BY c.created_at",
      [user.id],
    );
    const bookings = await db.query(
      "SELECT b.*,c.name AS child_name FROM bookings b LEFT JOIN children c ON c.id=b.child_id WHERE b.user_id=$1 ORDER BY b.start_at DESC LIMIT 50",
      [user.id],
    );
    return json({
      user: { name: user.name, email: user.email },
      staff: isStaff(user, env),
      children: children.map((c) => ({
        id: c.id,
        name: c.name,
        birthDate: c.birth_date,
        intakeComplete: !!c.completed_at,
      })),
      bookings: bookings.map(publicBooking),
    });
  }
  if (path === "/children" && request.method === "POST") {
    const value = parse(childInput, await readJSON(request));
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
        "SELECT id FROM children WHERE id=$1 AND guardian_id=$2",
        [value.childId, user.id],
      );
      if (!child) throw new HttpError(404, "Child profile not found.");
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
      if (!flow.child_id)
        throw new HttpError(
          403,
          "Intake is only available while booking for a child.",
        );
      if (flow.completed_at)
        throw new HttpError(409, "Intake is already complete for this child.");
      if (request.method === "GET")
        return json({
          html: intakeForm,
          childName: flow.child_name,
          birthDate: flow.birth_date,
          email: user.email,
        });
      if (request.method === "POST") {
        const data = parse(intakeInput, await readJSON(request));
        // Identity belongs to the authenticated guardian and child record, never a submitted ID/email.
        data.clientName = flow.child_name;
        data.birthDate = String(flow.birth_date).slice(0, 10);
        data.email = user.email;
        if (data.signDate !== new Date().toISOString().slice(0, 10))
          throw new HttpError(
            400,
            "Please use today’s date for your signature.",
          );
        const encrypted = await encryptIntake(
          data,
          env.INTAKE_ENCRYPTION_KEY,
          flow.child_id,
        );
        const rows = await db.query(
          "INSERT INTO intakes(child_id,guardian_id,encrypted_payload) VALUES($1,$2,$3) ON CONFLICT(child_id) DO NOTHING RETURNING child_id",
          [flow.child_id, user.id, encrypted],
        );
        // A second tab cannot overwrite an intake already saved by the first.
        if (!rows.length)
          throw new HttpError(
            409,
            "Intake is already complete for this child.",
          );
        return json({ ok: true });
      }
    }
    if (["slots", "book"].includes(action)) {
      if (flow.child_id && !flow.completed_at)
        throw new HttpError(
          409,
          "Please complete your child’s intake before choosing a time.",
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
        const data = await cal.slots(eid, start, end, tz);
        return json({
          slots: data,
          duration: event.lengthInMinutes,
          title: event.title,
        });
      }
      if (action === "book" && request.method === "POST") {
        const input = parse(bookingInput, await readJSON(request));
        if (Date.parse(input.start) <= Date.now())
          throw new HttpError(400, "Please choose a future appointment.");
        const [existing] = await db.query(
          "SELECT * FROM bookings WHERE flow_id=$1 AND user_id=$2",
          [flow.id, user.id],
        );
        if (existing)
          return json(
            { booking: publicBooking(existing) },
            existing.status === "creating" ? 202 : 200,
          );
        const bookingId = crypto.randomUUID();
        const rows = await db.query(
          `INSERT INTO bookings(id,flow_id,user_id,child_id,service,event_type_id,start_at,time_zone) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(flow_id) DO NOTHING RETURNING *`,
          [
            bookingId,
            flow.id,
            user.id,
            flow.child_id,
            flow.service,
            eid,
            input.start,
            input.timeZone,
          ],
        );
        if (!rows.length)
          throw new HttpError(
            409,
            "This booking is already being processed. Check your appointments.",
          );
        // Durable creation claim prevents repeated clicks or network retries from double-booking.
        // An uncertain upstream response is retained for reconciliation, never blindly retried.
        let remote;
        try {
          remote = await cal.create({
            eventTypeId: eid,
            start: input.start,
            attendee: {
              name: input.name,
              email: user.email,
              timeZone: input.timeZone,
              language: "en",
            },
            metadata: { portalBookingId: bookingId },
          });
        } catch (error) {
          await db.query(
            "UPDATE bookings SET status='needs_review',updated_at=now() WHERE id=$1 AND cal_uid IS NULL",
            [bookingId],
          );
          throw error;
        }
        if (!remote?.uid) {
          await db.query(
            "UPDATE bookings SET status='needs_review' WHERE id=$1",
            [bookingId],
          );
          throw new HttpError(
            502,
            "Please check your appointments or contact Heidi before trying again.",
          );
        }
        await db.query(
          "UPDATE bookings SET cal_uid=$2,status=$3,cal_seat_uid=$4,updated_at=now() WHERE id=$1",
          [
            bookingId,
            remote.uid,
            remote.status || "pending",
            remote.seatUid || null,
          ],
        );
        if (flow.child_id && remote.status === "pending") {
          try {
            remote = await cal.confirm(remote.uid);
            await db.query(
              "UPDATE bookings SET status=$2,updated_at=now() WHERE id=$1",
              [bookingId, remote.status || "accepted"],
            );
          } catch {
            throw new HttpError(
              502,
              "Your request is saved and awaiting confirmation. Please do not book again; Heidi can review it.",
            );
          }
        }
        const [saved] = await db.query("SELECT * FROM bookings WHERE id=$1", [
          bookingId,
        ]);
        return json({ booking: publicBooking(saved) }, 201);
      }
    }
  }
  if (path === "/admin/intakes" && request.method === "GET") {
    if (!isStaff(user, env)) throw new HttpError(403, "Staff access required.");
    return json({
      intakes: await db.query(
        "SELECT c.id,c.name,i.completed_at,u.name AS guardian_name FROM intakes i JOIN children c ON c.id=i.child_id JOIN portal_users u ON u.id=i.guardian_id ORDER BY i.completed_at DESC LIMIT 100",
      ),
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
    });
  }
  throw new HttpError(404, "Not found.");
}

export async function calWebhook(request, env, { db, cal }) {
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
  for (const booking of candidates) {
    let current = booking.cal_seat_uid
      ? await cal.getSeat(booking.cal_seat_uid)
      : remote;
    // Follow a reschedule even when an older cancellation notification arrives last.
    for (let i = 0; i < 5 && current.rescheduledToUid; i++)
      current = await cal.get(current.rescheduledToUid);
    if (
      (current.eventType?.id || current.eventTypeId) !== booking.event_type_id
    )
      continue;
    const attendee = current.attendees?.find(
      (a) => a.email?.toLowerCase() === booking.email.toLowerCase(),
    );
    if (!attendee) continue;
    const status =
      attendee.status === "cancelled" ? "cancelled" : current.status;
    if (
      !["accepted", "pending", "cancelled", "rejected"].includes(status) ||
      !Number.isFinite(Date.parse(current.start))
    )
      continue;
    await db.query(
      "UPDATE bookings SET cal_uid=$2,status=$3,start_at=$4,updated_at=now() WHERE id=$1",
      [booking.id, current.uid, status, current.start],
    );
  }
  return json({ ok: true });
}
