# Placeholders to resolve before launch

Every one of these must be filled in with real values from Heidi before the
site goes live. Search the codebase for the literal token to find every
occurrence.

## Pricing & scheduling (unknown at build time)

| Token | Where it appears | Needed |
|---|---|---|
| `{{PRICE}}` | services.html (x3), JSON-LD `priceRange` | Session price for Vermont private, Montreal private, virtual group |
| `{{DURATION}}` | services.html (x3) | Session length per service |
| `{{GROUP_SEATS}}` | services.html | Max seats per virtual group class (for Cal.com "seats" config) |
| `{{CANCELLATION_HOURS}}` | services.html, cancellation.html, intake.html | Notice window in hours. **Note:** the original intake form doc states "24 hours" for missed/cancelled appointments — this has been used as the working default in copy, but confirm it applies to every service (private VT/Montreal, virtual group) before removing the placeholder. |

## Contact & legal

| Token | Where it appears | Needed |
|---|---|---|
| `{{PHONE}}` | contact.html | Public phone number, if any |
| `{{STUDIO_ADDRESS}}` | faq.html | Street address / neighborhood detail for in-person sessions, if Heidi wants it public |
| `{{INSURANCE_INFO}}` | faq.html | Whether sessions are covered by insurance / HSA-eligible |
| `{{GOVERNING_LAW_JURISDICTION}}` | terms.html | Which jurisdiction's law governs the Terms (VT, QC, or both) |
| `{{GROUP_CANCELLATION_TERMS}}` | cancellation.html | Any different cancellation terms for group classes vs. private sessions |
| `{{LEGAL_DATE}}` | privacy.html, terms.html, cancellation.html, disclaimer.html | "Last updated" date once reviewed |

## Integrations

| Token | Where it appears | Needed |
|---|---|---|
| `healwithmovement/vermont-private`, `healwithmovement/montreal-private`, `healwithmovement/virtual-group` | `js/config.js` | Real Cal.com event type calLinks once created |
| `{{TURNSTILE_SITE_KEY}}` | intake.html, `js/config.js` | Cloudflare Turnstile **site key** (public) |
| `TURNSTILE_SECRET` env var | `functions/api/intake.js` | Cloudflare Turnstile **secret key**, set in Pages project settings |
| `RESEND_API_KEY` env var | `functions/api/intake.js` | Resend API key, set in Pages project settings |
| `INTAKE_TO_EMAIL` env var | `functions/api/intake.js` | Defaults to heidi@healwithmovement.com if unset — confirm |
| Plausible/Cloudflare Web Analytics snippet | every page `<head>` (via `build.mjs`) | Currently a placeholder Plausible script tag (`data-placeholder="true"`) pointing at `healwithmovement.com` — swap for the real analytics snippet or remove |
| Newsletter form | footer, every page | Currently a non-functional placeholder (`onsubmit="return false;"`) — wire to Mailchimp/Buttondown/ConvertKit etc. |
| Contact form | contact.html | Currently a non-functional placeholder — wire to a Pages Function (mirror `functions/api/intake.js`) or a form service |

## Content

| Item | Where | Needed |
|---|---|---|
| Heidi's personal bio / training history / certification dates / headshot | about.html | The source docx did not include a first-person biography — only the ABM method description. Replace the "Placeholder for Heidi's review" block. |
| Hero image | `public/assets/img/hero-1672.*`, `hero-1000.*` | Real photography is already in place (a licensed still, not a placeholder). An earlier hero-video pipeline was removed at the user's request; the encoded clips are kept for reference only in `site/_unused/video/` (not deployed). |
| `favicon.ico` | `public/favicon.ico` | Resolved — regenerated as a proper multi-size (16/32/48/64px) .ico from the brand mark. |
| French translations | all pages | The EN/FR toggle in the header is a functional scaffold (persists choice, swaps `lang` attribute) but no French copy exists yet — see `js/main.js` |

## Booking → intake flow (decision made, documented here per task instructions)

**Approach chosen:** the Book page links to the intake form from a visible
notice ("Booking for a child? Complete the intake form first...") shown once a
location is selected, and the main nav / hero always offer a direct "Child
Intake" link alongside "Book a Session." This was chosen over gating the
Cal.com embed behind the form because Cal.com's own post-booking confirmation
page/email is also a natural place to add the intake link — once the real
Cal.com event types exist, add the intake URL to each event type's
confirmation page redirect or a custom email step (see DEPLOY.md → Cal.com
setup) so parents who skip the notice still get prompted after booking.
