// Cloudflare Pages Function: POST /api/intake
// Validates the child intake form, verifies Cloudflare Turnstile, and emails
// Heidi via Resend. Requires these environment variables/secrets, set in the
// Cloudflare Pages project settings (see /DEPLOY.md):
//   RESEND_API_KEY   - Resend API key
//   INTAKE_TO_EMAIL  - destination inbox, e.g. heidi@healwithmovement.com
//   TURNSTILE_SECRET - Cloudflare Turnstile secret key

const REQUIRED_FIELDS = [
  "clientName",
  "birthDate",
  "guardianName",
  "address",
  "city",
  "province",
  "postalCode",
  "email",
  "preferredPhone",
  "reason",
  "hasTubes",
  "consent",
  "signature",
  "signDate",
];

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

async function verifyTurnstile(token, secret, ip) {
  if (!secret) return { success: false, reason: "not-configured" };
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token || "");
  if (ip) body.append("remoteip", ip);
  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  return resp.json();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  // Honeypot / basic shape check
  if (typeof data !== "object" || data === null) {
    return json({ ok: false, error: "Invalid submission." }, 400);
  }

  // Required field validation
  const missing = REQUIRED_FIELDS.filter((f) => {
    const v = data[f];
    return v === undefined || v === null || String(v).trim() === "";
  });
  if (missing.length) {
    return json({ ok: false, error: `Missing required fields: ${missing.join(", ")}` }, 400);
  }
  if (!isValidEmail(data.email)) {
    return json({ ok: false, error: "Please provide a valid email address." }, 400);
  }
  if (data.consent !== "on" && data.consent !== true && data.consent !== "true") {
    return json({ ok: false, error: "Consent is required to submit this form." }, 400);
  }

  // Turnstile verification
  const secret = env.TURNSTILE_SECRET;
  const ip = request.headers.get("CF-Connecting-IP");
  const turnstileResult = await verifyTurnstile(data.turnstileToken, secret, ip);
  if (!turnstileResult.success) {
    return json({ ok: false, error: "Bot verification failed. Please reload the form and try again." }, 403);
  }

  const toEmail = env.INTAKE_TO_EMAIL || "heidi@healwithmovement.com";
  const resendKey = env.RESEND_API_KEY;
  if (!resendKey) {
    return json({ ok: false, error: "Email service is not configured. Please contact us directly." }, 500);
  }

  const rows = Object.entries(data)
    .filter(([k]) => k !== "turnstileToken")
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;font-weight:600;vertical-align:top;">${escapeHtml(k)}</td><td style="padding:4px 0;">${escapeHtml(v)}</td></tr>`)
    .join("");

  const html = `
    <h2>New child intake form submission</h2>
    <p>Submitted via healwithmovement.com/intake.html</p>
    <table>${rows}</table>
  `;

  try {
    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Heal with Movement <intake@healwithmovement.com>",
        to: [toEmail],
        reply_to: data.email,
        subject: `New intake form: ${data.clientName}`,
        html,
      }),
    });
    if (!resendResp.ok) {
      const detail = await resendResp.text();
      console.error("Resend error", detail);
      return json({ ok: false, error: "Could not send the form right now. Please email us directly." }, 502);
    }
  } catch (err) {
    console.error("Resend fetch failed", err);
    return json({ ok: false, error: "Could not send the form right now. Please email us directly." }, 502);
  }

  return json({ ok: true });
}

export async function onRequestGet() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
