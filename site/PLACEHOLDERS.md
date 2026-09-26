# Placeholders to resolve before launch

Every one of these must be filled in with real values from Heidi before the
site goes live. Search the codebase for the literal token to find every
occurrence.

## Pricing & scheduling (unknown at build time)

| Token | Where it appears | Needed |
|---|---|---|
| `{{PRICE}}` | services.html (x3), JSON-LD `priceRange` | Session price for Vermont private, Montreal private, virtual group |
| `{{CANCELLATION_HOURS}}` | services.html, cancellation.html, protected intake form | Notice window in hours. **Note:** the original intake form doc states "24 hours" for missed/cancelled appointments — this has been used as the working default in copy, but confirm it applies to every service (private VT/Montreal, virtual group) before removing the placeholder. |

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
| Booking backend | Pages runtime secrets | Neon Auth, encryption key, Cal.com API key and event IDs; see DEPLOY.md |
| Plausible/Cloudflare Web Analytics snippet | every page `<head>` (via `build.mjs`) | Currently a placeholder Plausible script tag (`data-placeholder="true"`) pointing at `healwithmovement.com` — swap for the real analytics snippet or remove |
| Newsletter form | footer, every page | Currently a non-functional placeholder (`onsubmit="return false;"`) — wire to Mailchimp/Buttondown/ConvertKit etc. |
| Contact form | contact.html | Currently a non-functional placeholder — wire to a Pages Function or a form service |

## Content

| Item | Where | Needed |
|---|---|---|
| Heidi's personal bio / training history / certification dates / headshot | about.html | The source docx did not include a first-person biography — only the ABM method description. Replace the "Placeholder for Heidi's review" block. |
| Hero image | `public/assets/img/hero-1672.*`, `hero-1000.*` | Real photography is already in place (a licensed still, not a placeholder). An earlier hero-video pipeline was removed at the user's request; the encoded clips are kept for reference only in `site/_unused/video/` (not deployed). |
| `favicon.ico` | `public/favicon.ico` | Resolved — regenerated as a proper multi-size (16/32/48/64px) .ico from the brand mark. |
| French translations | all pages | The EN/FR toggle has been removed from the visible header (desktop and mobile menu) at the user's request, since there's no French copy yet. The underlying scaffold is still in the codebase, just unreferenced: `public/js/main.js` still has the `data-lang` click handler (persists choice to `localStorage`, swaps the `lang` attribute), and `.lang-toggle`/`.lang-toggle button` styles are still in `public/css/styles.css`. **Re-enable later** by adding the `.lang-toggle` markup back into `header()` in `build.mjs` (was in both `.nav-actions` and the mobile `.nav-mobile-only` block) once French copy exists. |

## Third-party assets

**Icons**: the nine card icons on the home page (Freedom from Pain & Injury,
Reduce Stress & Improve Sleep, Increase Mobility & Better Brain Function) and
the ABM page ("Who benefits from this practice") are [Phosphor
Icons](https://phosphoricons.com) (Thin weight), © Phosphor Icons, [MIT
licensed](https://github.com/phosphor-icons/core/blob/main/LICENSE). SVG path
data was downloaded once from the `@phosphor-icons/core` package via jsdelivr
and inlined directly in `build.mjs` (`PHOSPHOR_PATHS`), so the site has no
runtime dependency on an icon font or package.

## Booking and child intake

Parents sign in once on the website. The server exposes intake only inside a child booking flow, once for each child. Completed intake remains on file for future bookings. Direct intake routes redirect to booking; do not add public intake links or email intake answers. See DEPLOY.md for Neon, staff access, and Cal.com configuration.
