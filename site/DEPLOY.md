# Deploying Heal with Movement

This is a static site (no build step beyond the included generator) plus one
Cloudflare Pages Function for the intake form. It deploys to Cloudflare Pages.

**This has not been deployed yet.** These are the steps to run when Heidi/the
team is ready to go live.

## 0. Layout of this folder

```
site/
  build.mjs          generator — the only source of the HTML, run with plain `node build.mjs`
  wrangler.toml       pages_build_output_dir = "public"
  functions/          Pages Functions — must stay at this root, a sibling of public/
  public/             everything Cloudflare Pages serves: generated *.html, css/, js/,
                       assets/, icons/, favicon.ico, _headers, robots.txt, sitemap.xml,
                       site.webmanifest, 404.html
  PLACEHOLDERS.md, DEPLOY.md   docs, not deployed
```

`build.mjs` has no npm dependencies and needs none installed to run (plain
Node `fs`/`path`/`url`), and it never reads anything outside this repo. It
only writes the `*.html` files into `public/`; every other file under
`public/` (css, js, images, icons, etc.) is committed directly, there is no
separate asset-build step. Content lives in `build.mjs`, not hand-edited in
the `public/*.html` files (they're generated output, overwritten on every
run). After changing copy there:

```bash
cd site
node build.mjs
```

## 1. Cloudflare account

This project deploys to the **GAPCO LLC** Cloudflare account. The Pages
project name is fixed to `heal-with-movement` in `wrangler.toml`, and no
`account_id` is hardcoded in this repo on purpose (so the same repo can't
silently deploy to the wrong account for whoever runs it).

```bash
npx wrangler login
```

This opens a browser OAuth flow. Make sure the browser session/account you
authorize is the one with access to **GAPCO LLC**. If your Cloudflare login
has access to multiple accounts, `wrangler` will prompt you to pick one on
first deploy — choose **GAPCO LLC**. To skip the prompt on every run, find the
account ID for GAPCO LLC (`npx wrangler whoami` lists accounts you can access)
and export it for the session instead of editing `wrangler.toml`:

```bash
export CLOUDFLARE_ACCOUNT_ID=<gapco-llc-account-id>
```

## 2. First deploy

**Preferred: Git-connected build.** Cloudflare dashboard → Pages → Create
project → Connect to Git → pick this repo, under the GAPCO LLC account, with:

- **Root directory:** `site`
- **Build command:** `node build.mjs`
- **Build output directory:** `public`
- **Production branch:** `main`

Cloudflare's build image runs plain Node with no extra setup; `build.mjs` has
no devDependencies to install, so no "Install command" is needed. Pages
Functions in `site/functions/` are picked up automatically, since Cloudflare
looks for `functions/` as a sibling of the build output directory, at the
project root (`site/`), not inside `public/`.

**Manual/CLI deploy** (e.g. for a one-off preview before Git is connected),
from the `site/` directory:

```bash
node build.mjs
npx wrangler pages deploy public --project-name=heal-with-movement
```

## 3. Environment variables / secrets (Pages project settings)

Set these under **Pages project → Settings → Environment variables** for both
Production and Preview:

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | From resend.com → API Keys. Used by `functions/api/intake.js`. |
| `INTAKE_TO_EMAIL` | `heidi@healwithmovement.com` |
| `TURNSTILE_SECRET` | From the Cloudflare Turnstile widget (see below) — mark as **Secret**, not plaintext. |

Also update the **public** Turnstile site key (safe to commit) in two places:

- `site/public/intake.html` → `data-sitekey="{{TURNSTILE_SITE_KEY}}"`
- `site/public/js/config.js` → `turnstileSiteKey`

### Create the Turnstile widget

Dashboard → Turnstile → Add widget → domain `healwithmovement.com` (+ your
`*.pages.dev` preview domain) → Managed mode. Copy the site key and secret key
into the places above.

## 4. Custom domain

Pages project → Custom domains → add `healwithmovement.com` and `www`. Update
DNS if the domain isn't already on Cloudflare, or just proxy it if it is.

## 5. Cal.com setup

1. Create a Cal.com account (or team) for Heidi at `healwithmovement` (or
   update `public/js/config.js` if the real username differs).
2. Create three **event types**:
   - `vermont-private` — In-person private lesson, Chittenden County, VT
   - `montreal-private` — In-person private lesson, Montreal, QC
   - `virtual-group` — Virtual group class, enable **Seats per time slot**
     (Event type → Limits → "Offer seats") and set the seat count once Heidi
     confirms group size.
3. **Stripe**: Cal.com → Settings → Payments → connect Stripe account. On each
   event type, add a Payment step with the confirmed price (replace
   `{{PRICE}}` in `public/services.html` once known) and currency.
4. **Google Calendar sync**: Cal.com → Settings → My Availability →
   Conferencing/Calendars → connect Heidi's Google Calendar, both to check
   for conflicts and to write confirmed bookings.
5. **Reminder workflows**: Cal.com → Workflows → create a workflow attached to
   all three event types: email/SMS reminder 24h before, and a
   confirmation email immediately after booking.
6. **Cancellation policy text**: paste the finalized cancellation copy from
   `public/cancellation.html` into each event type's booking questions/description
   and into the confirmation email template, once `{{CANCELLATION_HOURS}}` is
   confirmed. Cal.com's own cancellation/reschedule policy field can also
   enforce the notice window automatically (Event type → Advanced → minimum
   notice for cancellation, if available on your plan).
7. **Route child bookings to the intake form**: the site links to
   `/intake.html` from the Book page notice and main navigation already. As a
   second layer, add a link to `https://healwithmovement.com/intake.html` in
   the confirmation email/page for any event type used for a child's first
   session, so parents who booked directly still get prompted. (See
   `PLACEHOLDERS.md` → "Booking → intake flow" for the full reasoning.)
8. Update `site/public/js/config.js` → `cal.calLink` with the real calLink slugs if
   they differ from the placeholders.

## 6. Resend setup (intake form email)

1. Create a Resend account, verify the `healwithmovement.com` sending domain
   (SPF/DKIM records — Resend gives you the DNS records; add them in
   Cloudflare DNS for the GAPCO LLC account's zone).
2. Generate an API key, add it as `RESEND_API_KEY` above.
3. The function sends from `intake@healwithmovement.com` — make sure that
   address is covered by the verified domain (it does not need to be a real
   inbox, just part of the verified sending domain).

## 7. Sanity checks before going live

- [ ] `node build.mjs` run after any copy change, generated `.html` committed
- [ ] All `{{PLACEHOLDER}}` tokens resolved — see `PLACEHOLDERS.md`
- [ ] Turnstile site key + secret set, test intake form submits and email
      arrives at heidi@healwithmovement.com
- [ ] Cal.com embed loads for all three locations on `/book.html`
- [ ] Hero is a still image (`public/assets/img/hero-1672.*` / `hero-1000.*`), not video. An earlier video pipeline was removed at the user's request; the encoded clips are kept for reference (not deployed) in `site/_unused/video/`.
- [ ] `sitemap.xml` / `robots.txt` domain matches the real domain
- [ ] Analytics snippet swapped from placeholder to real Plausible/Cloudflare
      Web Analytics site
