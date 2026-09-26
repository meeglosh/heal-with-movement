# Heal with Movement

Website and client booking portal for Heidi Rood, ABM practitioner.

The site runs on Cloudflare Pages; Neon provides Postgres and managed Better Auth. Clients use one website sign-in, with Cal.com handling availability and appointments behind the scenes.

```sh
npm --prefix site ci
npm run build
npm test
npm run dev -- --port 8788
```

See [deployment and booking setup](site/DEPLOY.md) for runtime secrets, migrations, Cal.com configuration, and launch checks. HTML is generated from `site/build.mjs`; portal UI source is `site/client/portal.js`.
