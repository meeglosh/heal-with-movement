# Booking portal deployment

The website runs on Cloudflare Pages with Pages Functions. Neon manages Postgres and Better Auth. Parents sign in on the website with an email code; only Heidi needs a Cal.com account.

## Local development

```sh
cd site
npm ci
npm run build
npm test
npm run dev -- --port 8788
```

Open http://localhost:8788/book. A plain static server cannot run the booking API.

The linked Neon project is `billowing-river-83678674`. `neon.ts` enables managed authentication. `neon deploy` deploys Neon configuration, not the website. The `dev-client-booking` branch is isolated from production and currently expires October 3, 2026; extend or recreate it before then.

The development connection was pulled into ignored `site/.env.development`. Runtime secrets belong in ignored `site/.dev.vars`. Never commit either file. To apply the portal schema to a selected branch:

```sh
node --env-file=.env.development scripts/migrate.mjs
```

The migration is atomic and recorded in `portal_migrations`. It creates application tables without modifying Neon-managed auth tables. `portal_users.id` is the verified Neon Auth user ID.

## Runtime configuration

Set these in Cloudflare Pages settings, separately for Preview and Production. Use a development Neon branch for previews.

| Variable | Purpose |
| --- | --- |
| `APP_ORIGIN` | Exact origin, such as `https://healwithmovement.com`; no trailing slash |
| `DATABASE_URL` | Neon connection, stored as a secret |
| `NEON_AUTH_BASE_URL` | Managed auth endpoint for the same Neon branch |
| `NEON_AUTH_COOKIE_SECRET` | Random secret of at least 32 characters; store as a secret |
| `INTAKE_ENCRYPTION_KEY` | 32 random bytes encoded as base64; store as a secret and back it up securely |
| `STAFF_EMAILS` | Comma-separated verified staff emails allowed to read intake |
| `CAL_API_KEY` | Heidi’s Cal.com API key, stored as a secret |
| `CAL_WEBHOOK_SECRET` | Random secret shared with Cal.com webhook configuration |
| `CAL_VERMONT_EVENT_ID` | Adult Vermont event type ID |
| `CAL_VERMONT_CHILD_EVENT_ID` | Child Vermont event type ID |
| `CAL_MONTREAL_EVENT_ID` | Adult Montreal event type ID |
| `CAL_MONTREAL_CHILD_EVENT_ID` | Child Montreal event type ID |
| `CAL_VIRTUAL_EVENT_ID` | Adult virtual class event type ID |
| `CAL_VIRTUAL_CHILD_EVENT_ID` | Child virtual class event type ID, if offered |

Generate encryption keys using `openssl rand -base64 32`. Keep the production intake key stable: replacing it makes existing intake unreadable unless records are migrated with the old key. Never use the development key in production.

## Neon Auth

Allow the exact production domain in Neon Auth trusted domains. Localhost is enabled on the development branch. Configure a verified custom email sender in Neon Auth for production; the development branch currently uses Neon’s shared sender. Verify email-code delivery and sign-out in the deployed environment before launch. All authorization is checked server-side against a fresh managed session; the client cannot choose its user ID.

## Cal.com

Connect Heidi’s calendar, set the correct time zone, availability, location, session durations, and booking notice. Use separate adult and child event types. Private child events must use **always require confirmation**, with that policy enabled. The website creates a pending child request after checking that the authenticated parent owns the child and intake is on file. Heidi accepts or rejects the request in Cal.com; the website never automatically confirms it. Do not manually approve direct Cal.com child requests without checking intake in the portal.

Enable `bookingRequiresAuthentication` on website events: this protects API booking with Heidi’s backend key, without requiring a Cal.com account for parents. Disable `requiresBookerEmailVerification`; Neon already verifies the parent. The shared virtual class uses 1,000 seats (Cal.com’s maximum), with attendee details and capacity hidden. Adult and child virtual IDs both point to that same event. Cal.com forbids confirmation on seated events; these use server-side intake gating and owner-authenticated API booking instead. Keep direct Cal.com links out of the website. Public Cal.com pages are outside the portal’s intake enforcement. Payments are not implemented in this version; paid Cal.com event types fail closed until a checkout flow is added.

Create a webhook pointing to `https://healwithmovement.com/api/cal/webhook`, with the same `CAL_WEBHOOK_SECRET`, for booking creation, confirmation, cancellation, rejection and rescheduling. Requests must have a valid `x-cal-signature-256`; the handler reads the current booking from Cal.com before updating local state. Never include intake answers or diagnoses in Cal.com fields or metadata.

## Website release

Use the GAPCO LLC Cloudflare account and Pages project `heal-with-movement`. Git build settings: root `site`, build command `npm run build`, output `public`, production branch `main`. Install npm dependencies including build dependencies. `nodejs_compat` is configured in `wrangler.toml`.

Before publishing, apply migrations to the production database using its connection, add runtime secrets, configure trusted domains and the webhook, and resolve the existing legal/pricing placeholders. Run the tests and Worker bundle check:

```sh
npm test
npm run build
npm run bundle:check
npx wrangler pages deploy public --project-name=heal-with-movement
```

## Behavior and operational checks

- Intake is available only after sign-in and starting a booking. Adult bookings require the adult form per account; child bookings require the child form per child. Saved intake is reviewed every six calendar months. Both availability and booking creation are blocked server-side until the relevant intake is complete. The old `/intake` and `/intake.html` routes redirect to booking.
- Intake is encrypted with AES-GCM and bound to its child ID or adult account ID. A unique database key prevents duplicate initial submissions. Due reviews use version checks to prevent stale tabs from overwriting newer reviews. It remains completed after abandoned or cancelled bookings.
- One parent account can own multiple child profiles. Sharing a child between parent accounts is not implemented.
- Heidi reads intake from **My account → Review intake**, with server-side staff authorization and an access audit record. Intake is not sent by email.
- One booking flow creates at most one remote booking attempt. If Cal.com times out, the request is marked `needs_review`; check Cal.com before asking the client to try a new booking.
- Cancellation/rescheduling currently use Cal.com confirmation-email links. Do not cancel group bookings with the organizer API without a seat-specific implementation.
- Before launch, test two children, a repeat booking, an adult booking, cancellation, rescheduling, unavailable slots, and staff access with real event configurations. Local tests use a calendar stub and do not send calendar invitations.

## Configured Cal.com resources

Schedule `2416901`: Monday–Friday, 10:00–17:00, America/New_York. All sessions are 60 minutes. Existing Apple Calendar remains the destination/conflict calendar.

| Event | ID |
| --- | --- |
| Vermont adult | 7233085 |
| Vermont child | 7233086 |
| Montreal adult | 7233087 |
| Montreal child | 7233088 |
| Virtual group, adult and child | 7233098 |

Event types are hidden from the public Cal.com profile. Hidden does not make a known direct URL inaccessible. Precise private-session meeting addresses still need Heidi’s confirmation.

Adult intake uses `003_adult_intakes.sql`, encrypted with the existing intake key and bound to the authenticated adult account. Completion persists even if the booking is abandoned or cancelled. Existing adults with no saved intake must complete it at their next booking. The original form is in `docs/Original website copy/ABM Intake form (Adult).pdf`; health answers and the four initialed acknowledgments are preserved. Staff reads are audited by adult account ID.

## Six-month intake reviews

Apply `004_intake_reviews.sql` before deploying this update. Existing records use their original completion date as the initial review date. Each adult and child has a separate `reviewed_at` timestamp; a review is due six calendar months later. Account-page prompts let users review without booking, and overdue intake blocks new availability/booking requests until reviewed. Prompts appear in the portal; no automatic reminder emails are sent.

Due forms show saved answers. Users can save edits with a current signature date, or confirm no changes after paging through the form. Either action resets the six-month clock. No-change confirmations preserve the signed answers and create an audit entry; edits archive the previous encrypted payload in `intake_review_history` atomically. Staff can see the last-reviewed date. Run `INTAKE_REVIEW_FIXTURE=1 node tests/preview.mjs` for isolated synthetic adult and child review UI testing.

## Transition at age 18

At the 18th birthday (Eastern business date), child booking flows and parent intake reviews are blocked even when intake is current. Parents see an account notice directing the adult to create their own account, complete adult intake, and book independently. Availability excludes appointments on or after that birthday; booking creation enforces the same rule. February 29 birthdays use February 28 in the non-leap transition year. Historical child intake remains available to authorized staff; records are not automatically linked or disclosed to a newly created adult account. Existing appointments are not cancelled.
