# Handoff

Last updated October 6, 2026. Start here when picking the project back up.
Heidi's decisions live in [docs/launch-decisions.md](docs/launch-decisions.md);
deployment and configuration details live in [site/DEPLOY.md](site/DEPLOY.md).

## Live now (healwithmovement.com)

A real payment, cancellation and refund were tested end to end on October 6, 2026.

- **Payments (Stripe, live mode).** Virtual private lessons cost CAD $40,
  group drop-ins USD $20, and six-class group packages USD $90; all are paid by
  card. Prices are in `site/server/stripe.js`, not in Stripe Products. A private
  lesson or drop-in is booked in Cal.com only after Stripe confirms payment.
  The Stripe webhook is `/api/stripe/webhook`.
- **Refunds and credits.** Refunds and credit returns are automatic when the
  time is taken, a checkout is paid twice, the client cancels at least 24 hours
  ahead, or Heidi rejects the booking. Later cancellations forfeit the payment
  or credit.
- **Group classes.** They run Tuesdays 7–8 p.m. and Wednesdays noon–1 p.m.
  Eastern, from October 13, 2026, with up to 50 seats on Cal.com schedule
  `2464427`. Upcoming times are public at `/api/public/group-times` and listed
  on the sign-in screen. Nothing before October 13 is shown or bookable
  (`GROUP_FIRST_CLASS`).
- **Intake.** In-person sessions (Montreal, Vermont) still require intake.
  Virtual sessions skip it; instead the client ticks a box agreeing to the
  Medical Disclaimer and Cancellation Policy, which the server enforces and
  logs as `disclaimer.accepted` in `audit_events`.
- **Cancellation policy.** The 24-hour policy is published on the services,
  FAQ and cancellation pages.

- **Schedules.** In-person lessons run Monday–Friday 10 a.m.–5 p.m. Eastern:
  Vermont on days 1–7 of each month, Montreal on the other days (filtered by
  the site). Virtual private lessons run 10 a.m.–7 p.m. (Cal.com schedule
  `2469485`).
- **Child approval.** Only a child's first private booking needs Heidi's
  approval; later ones use the "(returning)" event types.
- **Staff tools.** Heidi signs in and sees "Review intake" and "Return class
  credits" on her account page.

## Environments and secrets

No secret values are in git. They live in these places:

| Where | What |
| --- | --- |
| Cloudflare Pages `heal-with-movement` (GAPCO LLC) | Production runtime secrets, including live `STRIPE_SECRET_KEY` (restricted `rk_live_`) and `STRIPE_WEBHOOK_SECRET` |
| `site/.env.production` (ignored, mode 600, **JSON**) | Local backup of production values |
| `site/.dev.vars` (ignored) | Local development, with a **test** Stripe key and the `dev-client-booking` database |
| `site/.env.development` (ignored) | Development database URL for migrations |

The Neon project has two branches:

- `production`: migrations 001–007 are applied.
- `dev-client-booking`: created October 6, 2026 with no expiry; migrations
  001–007 are applied.

## Common tasks

Run these from `site/`.

```sh
npm test && npm run build && npm run bundle:check
npx wrangler pages deploy public --project-name=heal-with-movement --branch=main

# Migrations: development, then production. .env.production is JSON, so pass
# its DATABASE_URL explicitly.
node --env-file=.env.development scripts/migrate.mjs
DATABASE_URL_UNPOOLED=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(".env.production","utf8")).DATABASE_URL)') node scripts/migrate.mjs
```

Apply a migration to production **before** deploying code that depends on it.
Cloudflare secrets take effect at the next deploy.

## Open items

- The newsletter is on hold (Heidi, October 7, 2026).
- Reset the development database password when convenient, then update
  `site/.dev.vars` and `site/.env.development`.
