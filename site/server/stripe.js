import { HttpError } from "./http.js";
import { verifySignature } from "./crypto.js";

// Prices are owned by the website, not Stripe Products, so the restricted key
// only needs Checkout Session and Refund write access.
export const PRICES = {
  virtual_private: {
    amount: 4000,
    currency: "cad",
    name: "Virtual private lesson (60 minutes)",
  },
  group_credits: {
    amount: 9000,
    currency: "usd",
    credits: 6,
    name: "Virtual group classes — 6-class package",
  },
};

// Stripe expects nested form fields: line_items[0][price_data][currency]=cad.
function form(value, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export function stripe(env, fetcher = fetch) {
  async function request(path, { method = "GET", body, idempotencyKey } = {}) {
    if (!env.STRIPE_SECRET_KEY)
      throw new HttpError(
        503,
        "Online payment is not available yet. Please contact Heidi.",
      );
    let response;
    try {
      response = await fetcher(`https://api.stripe.com/v1${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: body ? form(body) : undefined,
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new HttpError(
        502,
        "The payment service did not respond. Please try again.",
      );
    }
    const result = await response.json().catch(() => null);
    if (!response.ok || !result)
      throw new HttpError(
        502,
        "The payment could not be started. Please try again later.",
      );
    return result;
  }
  return {
    createSession: (body, idempotencyKey) =>
      request("/checkout/sessions", { method: "POST", body, idempotencyKey }),
    getSession: (id) => request(`/checkout/sessions/${encodeURIComponent(id)}`),
    refund: (paymentIntent, idempotencyKey) =>
      request("/refunds", {
        method: "POST",
        body: { payment_intent: paymentIntent },
        idempotencyKey,
      }),
  };
}

// Stripe-Signature: t=<unix>,v1=<hex>[,v1=<hex>] signs `${t}.${raw}`.
export async function verifyStripeSignature(
  raw,
  header,
  secret,
  now = Date.now(),
) {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  if (!/^\d+$/.test(t || "") || Math.abs(now / 1000 - Number(t)) > 300)
    return false;
  for (const [k, v] of parts)
    if (k === "v1" && (await verifySignature(`${t}.${raw}`, v, secret)))
      return true;
  return false;
}
