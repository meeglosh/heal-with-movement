import { HttpError } from "./http.js";
export function eventId(env, service, isChild) {
  const id = Number(
    env[`CAL_${service.toUpperCase()}${isChild ? "_CHILD" : ""}_EVENT_ID`],
  );
  if (!Number.isSafeInteger(id) || id < 1)
    throw new HttpError(
      503,
      "This service is not available for online booking yet. Please contact Heidi.",
    );
  return id;
}
export function validateEvent(event, isChild) {
  const seated =
    !event.seats?.disabled &&
    Number(event.seats?.seatsPerTimeSlot || event.seatsPerTimeSlot) > 0;
  if (isChild && seated && !event.bookingRequiresAuthentication)
    throw new HttpError(
      503,
      "Child group booking is temporarily unavailable. Please contact Heidi.",
    );
  if (
    isChild &&
    !seated &&
    (!event.confirmationPolicy ||
      event.confirmationPolicy.disabled ||
      event.confirmationPolicy.type !== "always")
  )
    throw new HttpError(
      503,
      "Child booking is temporarily unavailable. Please contact Heidi.",
    );
  // bookingRequiresAuthentication protects the API using Heidi’s server key; it does not require a parent Cal.com login.
  if (event.requiresBookerEmailVerification)
    throw new HttpError(
      503,
      "This calendar needs to be configured for website booking. Please contact Heidi.",
    );
  if (event.price > 0)
    throw new HttpError(
      503,
      "Online payment for this service is not enabled on the website yet. Please contact Heidi.",
    );
}
export function calendar(env, fetcher = fetch) {
  async function request(
    path,
    { method = "GET", body, version = "2026-02-25" } = {},
  ) {
    if (!env.CAL_API_KEY)
      throw new HttpError(
        503,
        "Online scheduling is not available yet. Please contact Heidi.",
      );
    let response;
    try {
      response = await fetcher(`https://api.cal.com/v2${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${env.CAL_API_KEY}`,
          "cal-api-version": version,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new HttpError(
        502,
        "The calendar did not respond. Check your appointments before trying again.",
      );
    }
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.status !== "success")
      throw new HttpError(
        response.status === 409 ? 409 : 502,
        response.status === 409
          ? "That time is no longer available. Please choose another."
          : "The calendar could not complete the request. Please try again later.",
      );
    return result.data;
  }
  return {
    event: (id) => request(`/event-types/${id}`, { version: "2026-06-12" }),
    slots: (id, start, end, timeZone) =>
      request(
        "/slots?" +
          new URLSearchParams({
            eventTypeId: String(id),
            start,
            end,
            timeZone,
            format: "range",
          }),
        { version: "2024-09-04" },
      ),
    create: (body) => request("/bookings", { method: "POST", body }),
    getSeat: (uid) => request(`/bookings/by-seat/${encodeURIComponent(uid)}`),
    get: (uid) => request(`/bookings/${encodeURIComponent(uid)}`),
  };
}
