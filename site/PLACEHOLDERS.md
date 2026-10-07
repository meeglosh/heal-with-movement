# Placeholders

As of October 7, 2026 the live site has no `{{TOKEN}}` placeholders. Prices,
schedules, the cancellation policy, insurance wording, governing law and the
legal pages' "Last updated" date come from Heidi's answers
(see `docs/launch-decisions.md`). Heidi approved the legal pages without a
lawyer's review. The contact page links to email instead of a form; there is
no newsletter form and no analytics script.

Check before each release:

```sh
grep -o "{{[A-Z_]*}}" public/*.html server/*.js
```

## Content

| Item | Where | Needed |
|---|---|---|
| Heidi's personal bio / training history / certification dates | about.html | The source docx did not include a first-person biography — only the ABM method description. Add Heidi's training history and certification details when available; her portrait is now in place. |
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
