// Static site generator for Heal with Movement.
// Run: node build.mjs   (writes .html files into this directory)
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_URL = "https://healwithmovement.com"; // update at deploy if domain differs

const NAV = [
  ["/about.html", "About"],
  ["/abm.html", "ABM"],
  ["/services.html", "Services"],
  ["/testimonials.html", "Stories"],
  ["/faq.html", "FAQ"],
  ["/contact.html", "Contact"],
];

function head({ title, description, path, ogImage = "/assets/img/og-image.jpg", jsonLd = "" }) {
  const url = SITE_URL + path;
  return `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE_URL}${ogImage}">
<meta property="og:site_name" content="Heal with Movement">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${SITE_URL}${ogImage}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#3D2447">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,300..600,0..100,0..1;1,9..144,300..600,0..100,0..1&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/styles.css">
${jsonLd}
<!-- Privacy-friendly analytics placeholder: swap data-domain / src for your Plausible or Cloudflare Web Analytics snippet -->
<script defer data-domain="healwithmovement.com" src="https://plausible.io/js/script.js" data-placeholder="true"></script>
`;
}

const LOCAL_BUSINESS_JSONLD = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HealthAndBeautyBusiness",
  "name": "Heal with Movement",
  "description": "Anat Baniel Method NeuroMovement practitioner Heidi Rood offers in-person private lessons in Chittenden County, VT and Montreal, QC, and virtual group classes.",
  "url": "${SITE_URL}",
  "logo": "${SITE_URL}/icons/icon-512.png",
  "image": "${SITE_URL}/assets/img/og-image.jpg",
  "email": "heidi@healwithmovement.com",
  "areaServed": [
    {"@type":"AdministrativeArea","name":"Chittenden County, VT"},
    {"@type":"City","name":"Montreal, QC"}
  ],
  "priceRange": "{{PRICE}}",
  "founder": {"@type":"Person","name":"Heidi Rood","jobTitle":"Anat Baniel Method NeuroMovement Practitioner"},
  "sameAs": []
}
</script>`;

function svgLogo() {
  return `<img src="/assets/brand/logo.svg" alt="" width="168" height="30">`;
}

function header(active) {
  const links = NAV.map(([href, label]) => {
    const isActive = active === href;
    return `<li><a href="${href}"${isActive ? ' aria-current="page"' : ""}>${label}</a></li>`;
  }).join("\n        ");
  return `<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/" aria-label="Heal with Movement, home">
      ${svgLogo()}
      <span class="visually-hidden">Heal with Movement</span>
    </a>
    <nav aria-label="Primary">
      <ul class="nav-links" id="nav-links">
        ${links}
        <li class="nav-mobile-only">
          <div class="lang-toggle" role="group" aria-label="Language">
            <button type="button" data-lang="en" aria-pressed="true">EN</button>
            <button type="button" data-lang="fr" aria-pressed="false">FR</button>
          </div>
          <a class="btn btn-ghost btn-small" href="/intake.html">Child Intake</a>
          <a class="btn btn-primary btn-small" href="/book.html">Book a Session</a>
        </li>
      </ul>
    </nav>
    <div class="nav-actions">
      <div class="lang-toggle" role="group" aria-label="Language">
        <button type="button" data-lang="en" aria-pressed="true">EN</button>
        <button type="button" data-lang="fr" aria-pressed="false">FR</button>
      </div>
      <a class="btn btn-primary btn-small" href="/book.html">Book a Session</a>
    </div>
    <button class="nav-toggle" aria-expanded="false" aria-controls="nav-links" aria-label="Open menu">
      <span></span><span></span><span></span>
    </button>
  </div>
</header>`;
}

function footer() {
  return `<footer class="site-footer">
  <div class="footer-close">
    <div class="wrap">
      <p class="eyebrow">Heal with Movement</p>
      <h2>Small movements. Real change.</h2>
      <div class="hero-cta">
        <a class="btn btn-primary" href="/book.html">Book a Session</a>
        <a class="btn btn-ghost" href="/intake.html" style="color:#F3ECF5; border-color:rgba(243,236,245,.4)">Child Intake Form</a>
      </div>
    </div>
  </div>
  <div class="footer-main">
    <div class="wrap">
      <div class="footer-grid">
        <div>
          <div class="footer-brand">
            <img src="/assets/brand/logo-mark-dark.svg" alt="" width="28" height="28">
            <span style="font-family:var(--font-display); font-size:1.05rem;">Heal with Movement</span>
          </div>
          <p style="opacity:.75; max-width:34ch;">Anat Baniel Method NeuroMovement with Heidi Rood, gentle, precise movement work for children and adults, in Chittenden County VT, Montreal QC, and online.</p>
          <form class="newsletter" action="#" method="post" onsubmit="return false;" aria-label="Newsletter signup">
            <label class="visually-hidden" for="newsletter-email">Email address</label>
            <input type="email" id="newsletter-email" placeholder="you@email.com" required>
            <button class="btn btn-primary btn-small" type="submit">Sign up</button>
          </form>
          <p class="hint" style="opacity:.6; font-size:.78rem; margin-top:8px;">Newsletter is a placeholder, connect to Mailchimp/Buttondown before launch.</p>
        </div>
        <div>
          <h4>Explore</h4>
          <ul>
            <li><a href="/about.html">About Heidi</a></li>
            <li><a href="/abm.html">What is ABM</a></li>
            <li><a href="/services.html">Services &amp; Pricing</a></li>
            <li><a href="/testimonials.html">Testimonials</a></li>
            <li><a href="/faq.html">FAQ</a></li>
          </ul>
        </div>
        <div>
          <h4>Get started</h4>
          <ul>
            <li><a href="/book.html">Book a session</a></li>
            <li><a href="/intake.html">Child intake form</a></li>
            <li><a href="/contact.html">Contact</a></li>
          </ul>
        </div>
        <div>
          <h4>Legal</h4>
          <ul>
            <li><a href="/privacy.html">Privacy Policy</a></li>
            <li><a href="/terms.html">Terms of Service</a></li>
            <li><a href="/cancellation.html">Cancellation Policy</a></li>
            <li><a href="/disclaimer.html">Medical Disclaimer</a></li>
          </ul>
        </div>
      </div>
    </div>
  </div>
  <div class="wrap">
    <div class="footer-bottom">
      <span>&copy; ${new Date().getFullYear()} Heal with Movement · Heidi Rood · <a href="mailto:heidi@healwithmovement.com">heidi@healwithmovement.com</a></span>
      <span>Chittenden County, VT &amp; Montreal, QC</span>
    </div>
  </div>
</footer>`;
}

function scripts() {
  return `<script src="/js/config.js"></script>\n<script src="/js/main.js" defer></script>`;
}

function page({ path, title, description, active, body, jsonLd = "", ogImage, extraHead = "", extraScripts = "" }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
${head({ title, description, path, jsonLd, ogImage })}${extraHead}
</head>
<body>
${header(active)}
<main id="main">
${body}
</main>
${footer()}
${scripts()}
${extraScripts}
</body>
</html>
`;
}

// ---------- shared bits ----------

// The spiral path shared by the brand mark and the hero foreground plane /
// signature sequence, so the "drawn line" always reads as the same brand
// gesture wherever it appears.
const SPIRAL_PATH = "M8 40 C 8 24, 22 12, 34 12 C 48 12, 56 22, 56 32 C 56 40, 50 45, 43 45 C 37 45, 33 41, 33 36 C 33 32, 36 29, 40 29";

function heroSection({ eyebrow, h1, sub, ctas, pinned = false }) {
  const heroMarkup = `<section class="hero" id="hero">
  <div class="hero-media">
    <picture>
      <source type="image/avif" srcset="/assets/img/hero-1000.avif 1000w, /assets/img/hero-1672.avif 1672w" sizes="100vw">
      <source type="image/webp" srcset="/assets/img/hero-1000.webp 1000w, /assets/img/hero-1672.webp 1672w" sizes="100vw">
      <img id="hero-image" src="/assets/img/hero-1672.jpg" srcset="/assets/img/hero-1000.jpg 1000w, /assets/img/hero-1672.jpg 1672w" sizes="100vw" width="1672" height="941" alt="Heidi Rood's studio: warm afternoon light across a plaster wall and linen bench, where NeuroMovement sessions take place" fetchpriority="high" decoding="async">
    </picture>
  </div>
  <div class="hero-grade" aria-hidden="true"></div>
  <div class="hero-scrim"></div>
  ${pinned ? `<div class="hero-darken" id="hero-darken" aria-hidden="true"></div>
  <div class="hero-fg" id="hero-fg" aria-hidden="true">
    <svg viewBox="0 0 64 64" preserveAspectRatio="xMidYMid meet"><path d="${SPIRAL_PATH}" fill="none" stroke="#F3ECF5" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 4) scale(0.9)"/></svg>
  </div>` : ""}
  <div class="wrap hero-inner">
    <p class="eyebrow">${eyebrow}</p>
    <h1>${h1}</h1>
    <p class="hero-sub">${sub}</p>
    <div class="hero-cta">${ctas}</div>
  </div>
</section>`;
  if (!pinned) return heroMarkup;
  return `<div class="hero-pin-spacer" id="hero-pin-spacer">\n${heroMarkup}\n</div>`;
}

// The signature move: the brand's continuous spiral line draws itself,
// scrubbed by scroll, while three short statements about the ABM idea
// (small movement -> new pathway -> real change) cross-fade in step with
// the line's travel. Pinned, scroll-scrubbed, and the page's emotional
// peak. Desktop and mobile share the same mechanism but mobile gets a
// shorter pin distance and smaller type so it doesn't overstay its welcome
// on a slower scroll wheel (touch).
function signatureSequence() {
  return `<div class="signature-pin-spacer" id="sig-pin-spacer">
  <section class="signature">
    <div class="signature-pin" id="sig-pin">
      <p class="eyebrow signature-eyebrow">The idea behind ABM</p>
      <svg class="signature-svg" viewBox="0 0 64 64" aria-hidden="true">
        <path id="sig-path" d="${SPIRAL_PATH}"/>
      </svg>
      <div class="signature-stage is-active" data-stage="1"><h3>Small movements.</h3></div>
      <div class="signature-stage" data-stage="2"><h3>New neural pathways.</h3></div>
      <div class="signature-stage" data-stage="3"><h3>Real, lasting change.</h3></div>
    </div>
  </section>
</div>`;
}

function quote(text, attr) {
  return `<blockquote class="quote-card settle"><q>${text}</q><p class="quote-attr">${attr}</p></blockquote>`;
}

// Five of the shortest, strongest testimonials, verbatim from the source
// copy (Paul W.'s is a single verbatim sentence lifted from his longer
// quote, not reworded). Shared by the pinned home-page sequence and the
// data below stays in sync with testimonials.html by hand since the full
// testimonials page keeps its own longer-form versions.
const TESTIMONIAL_STOPS = [
  { text: "After Heidi's class last night I had the best night's sleep in months! I look forward to more classes!", attr: "Judy M." },
  { text: "I love this work. Heidi was very patient, clear and thorough. This was a wonderful experience!", attr: "Eryn T." },
  { text: "Heidi is a truly gifted teacher of movement and somatic body experience. Her lessons are skillfully communicated through space and time to establish unity within our own bodies as well as community with each other!", attr: "Keri S." },
  { text: "My sciatica is gone after three classes, and my hips feel even for the first time in years. I'm moving easier, not overcompensating, and pleasantly surprised when I'm anticipating pain and it's not there.", attr: "Linda S." },
  { text: "The treatments are seemingly incredibly subtle, but after each session there was a definite increase in neck/shoulder flexibility and decrease in pain.", attr: "Paul W." },
];

// Testimonials as scroll-craft stops: a second pinned, scroll-scrubbed
// sequence, deliberately built differently from the signature section so
// it doesn't read as a repeat of the same device: light lilac canvas (not
// dark), a large quote with attribution and a dot index off to the side
// (not centered), and no drawn line. Each stop settles in, holds, and
// hands off to the next as the visitor scrolls; a small dot row tracks
// position instead of a "01/05" counter (the skill bans numbered section
// counters outright).
function testimonialSequence() {
  const dots = TESTIMONIAL_STOPS.map((_, i) => `<span class="testimonial-dot${i === 0 ? " is-active" : ""}" data-dot="${i}"></span>`).join("");
  const stages = TESTIMONIAL_STOPS.map((t, i) => {
    // Quotes over ~180 characters get a smaller fixed size so none of the
    // five stops runs past ~7 lines at the 680px desktop quote width.
    const longClass = t.text.length > 180 ? " is-long" : "";
    return `<div class="testimonial-stage${i === 0 ? " is-active" : ""}" data-stage="${i}">
        <blockquote class="testimonial-quote${longClass}">
          <q>${t.text}</q>
          <p class="quote-attr">${t.attr}</p>
        </blockquote>
      </div>`;
  }).join("\n      ");
  return `<div class="testimonial-pin-spacer" id="testimonial-pin-spacer">
  <section class="testimonial-scroll">
    <div class="testimonial-pin" id="testimonial-pin">
      <div class="wrap testimonial-grid">
        <div class="testimonial-content">
          <div class="testimonial-col">
            <p class="eyebrow">What clients say</p>
            <div class="testimonial-stage-wrap">
              ${stages}
            </div>
          </div>
          <div class="testimonial-index" aria-hidden="true">${dots}</div>
        </div>
        <div class="testimonial-visual" aria-hidden="true">
          <svg class="testimonial-visual-svg" id="testimonial-visual-svg" viewBox="0 0 64 64">
            <path d="${SPIRAL_PATH}"/>
          </svg>
        </div>
      </div>
    </div>
  </section>
</div>`;
}

// ---------- HOME ----------
const home = page({
  path: "/",
  title: "Heal with Movement | Anat Baniel Method NeuroMovement with Heidi Rood",
  description: "Freedom from pain and injury, reduced stress, better sleep, and improved mobility through Anat Baniel Method NeuroMovement. Private lessons in Chittenden County VT, Montreal QC, and virtual group classes.",
  active: "/",
  jsonLd: LOCAL_BUSINESS_JSONLD,
  body: `
${heroSection({
  eyebrow: "Heal with Movement · Heidi Rood",
  h1: "Freedom from pain, through your body's own <em>intelligence</em>.",
  sub: "Gentle Anat Baniel Method lessons for children and adults, in Vermont, Montreal, and online.",
  ctas: `<a class="btn btn-primary breathe" href="/book.html">Book a Session</a><a class="btn btn-ghost" href="/abm.html" style="color:#fff; border-color:rgba(255,255,255,.55)">What is ABM?</a>`,
  pinned: true,
}) }

<section class="section">
  <div class="wrap">
    <div class="grid grid-3">
      <div class="card settle">
        <h3>Freedom from Pain &amp; Injury</h3>
        <p>Slow, small, varied movements help the nervous system find new, easier ways to move, often where pushing harder hasn't worked.</p>
      </div>
      <div class="card settle">
        <h3>Reduce Stress &amp; Improve Sleep</h3>
        <p>Sessions are unhurried by design. Many clients notice a calmer nervous system and deeper sleep after just a few lessons.</p>
      </div>
      <div class="card settle">
        <h3>Increase Mobility &amp; Better Brain Function</h3>
        <p>Because movement and the brain are inseparable, this work supports clearer thinking alongside greater ease of motion.</p>
      </div>
    </div>
  </div>
</section>

${signatureSequence()}

<section class="section alt">
  <div class="wrap grid grid-2" style="align-items:center;">
    <div class="settle">
      <p class="eyebrow">The science</p>
      <h2>Movement is how the brain organizes itself.</h2>
      <p>Based on the Feldenkrais Method, the Anat Baniel Method NeuroMovement (ABMNM) uses movement and touch to upgrade brain function, leading to improved thinking, reduced pain, and better stress management. Neuroplasticity means this capacity to grow and improve is available at any age.</p>
      <a class="btn btn-ghost" href="/abm.html">Learn how ABM works</a>
    </div>
    <div class="media-overlap settle">
      <img class="media-main" src="/assets/img/fuu-j-r2nJPbEYuSQ-unsplash.jpg" alt="A moment of openness and ease, arms outstretched in warm light" loading="lazy">
      <img class="media-inset" src="/assets/img/haley-phelps-S-llxYh3GzI-unsplash.jpg" alt="Floating calmly in still water" loading="lazy">
    </div>
  </div>
</section>

${testimonialSequence()}

<section class="section" style="text-align:center;">
  <div class="wrap">
    <a class="btn btn-ghost" href="/testimonials.html">Read more stories</a>
  </div>
</section>

<section class="section alt">
  <div class="wrap grid grid-2" style="align-items:center;">
    <div class="settle">
      <p class="eyebrow">Locations</p>
      <h2>In person, or from anywhere.</h2>
      <p>Private lessons are offered in Chittenden County, Vermont and in Montreal, Quebec. Virtual group classes meet online, wherever you are.</p>
      <a class="btn btn-primary" href="/services.html">See services &amp; pricing</a>
    </div>
    <div class="card settle">
      <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:1em;">
        <li><strong>Chittenden County, VT</strong>, in-person private lessons</li>
        <li><strong>Montreal, QC</strong>, in-person private lessons</li>
        <li><strong>Virtual</strong>, live group classes, anywhere</li>
      </ul>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap" style="text-align:center;">
    <h2>Ready to move differently?</h2>
    <p style="max-width:50ch; margin:0 auto 1.6em;">Choose a location and find a time that works, or start with the child intake form if you're booking for your child.</p>
    <div class="hero-cta" style="justify-content:center;">
      <a class="btn btn-primary" href="/book.html">Book a Session</a>
      <a class="btn btn-ghost" href="/intake.html">Child Intake Form</a>
    </div>
  </div>
</section>
`,
  extraHead: `<link rel="preload" as="image" href="/assets/img/hero-1672.jpg" imagesrcset="/assets/img/hero-1000.jpg 1000w, /assets/img/hero-1672.jpg 1672w" imagesizes="100vw" fetchpriority="high">
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>`,
  extraScripts: `<script src="/js/scroll-craft.js" defer></script>`,
});

// ---------- ABOUT ----------
const about = page({
  path: "/about.html",
  title: "About Heidi Rood | Heal with Movement",
  description: "Heidi Rood is an Anat Baniel Method NeuroMovement practitioner serving Chittenden County VT, Montreal QC, and clients online.",
  active: "/about.html",
  body: `
<section class="section">
  <div class="wrap grid grid-2" style="align-items:center;">
    <div class="settle">
      <p class="eyebrow">About</p>
      <h1>Heidi Rood</h1>
      <p>Heidi Rood is an Anat Baniel Method NeuroMovement (ABMNM) practitioner working with children and adults in Chittenden County, Vermont; Montreal, Quebec; and virtually with clients everywhere.</p>
      <p>Her approach is quiet, attentive, and precise: small, varied movements that give the brain new information to work with, rather than force or repetition. Clients describe her sessions as gentle, professional, and genuinely transformative.</p>
      <div class="skip-note">
        <strong>Placeholder for Heidi's review:</strong> this page currently uses the biography language supplied in the ABM copy document. Add Heidi's personal training history, certification details, years of practice, and a personal photo before launch. <span class="placeholder-tag">PLACEHOLDER</span>
      </div>
    </div>
    <div class="settle" style="aspect-ratio:4/5; border:1px dashed var(--c-line); border-radius:2px; background:var(--c-canvas-alt); display:flex; align-items:center; justify-content:center; text-align:center; padding:2em;">
      <div>
        <img src="/assets/brand/logo-mark.svg" alt="" width="40" height="40" style="margin:0 auto 12px;">
        <p style="margin:0; color:var(--c-ink-soft); font-size:.9rem;">Heidi's portrait goes here<br><span class="placeholder-tag" style="margin-top:8px; display:inline-block;">PLACEHOLDER</span></p>
      </div>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="wrap grid grid-2">
    <div class="settle">
      <h2>Why this work</h2>
      <p>"Heidi creates a friendly, caring and professional atmosphere. The treatments are seemingly incredibly subtle, but after each session there was a definite increase in flexibility and decrease in pain." <strong>Paul W.</strong></p>
      <p>"Heidi is a truly gifted teacher of movement and somatic body experience." <strong>Keri S.</strong></p>
    </div>
    <div class="settle">
      <h2>How sessions work</h2>
      <p>Every lesson meets you (or your child) exactly where you are. There's no forcing a "correct" movement, instead, Heidi guides attention toward what's already possible, so the nervous system can discover an easier way on its own.</p>
      <a class="btn btn-ghost" href="/abm.html">Read about the ABM method</a>
    </div>
  </div>
</section>
`,
});

// ---------- ABM ----------
const abm = page({
  path: "/abm.html",
  title: "What is Anat Baniel Method NeuroMovement? | Heal with Movement",
  description: "How ABM NeuroMovement uses movement and touch to support neuroplasticity, for children with special needs, adults recovering from injury, and anyone seeking greater vitality.",
  active: "/abm.html",
  body: `
<section class="section">
  <div class="wrap">
    <p class="eyebrow">The method</p>
    <h1 style="max-width:20ch;">Movement and touch that upgrade brain function.</h1>
    <p style="max-width:64ch; font-size:1.15rem; color:var(--c-ink-soft);">Based on the Feldenkrais Method, the Anat Baniel Method NeuroMovement (ABMNM) uses movement and touch to upgrade brain function, leading to improved thinking, reduced pain, and better stress management.</p>
  </div>
</section>

<section class="section alt">
  <div class="wrap grid grid-2" style="align-items:center;">
    <div class="settle">
      <h2>The science of neuroplasticity</h2>
      <p>In recent decades, scientists have come to understand that the brain has an amazing capacity to heal. This ability to change in response to our experiences, called neuroplasticity, allows the brain to grow and improve at any age.</p>
      <p>The body and brain are not separate: while we depend on the brain to organize the body's action, our movements give the brain the information it needs to grow and organize itself. This mind-body connection is crucial to a child's development, and to continued vitality as we age.</p>
    </div>
    <div class="settle">
      <img src="/assets/img/timo-volz-ZlFKIG6dApg-unsplash.jpg" alt="A slow, deliberate stretch, unhurried and easy" loading="lazy" style="border-radius:2px;">
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <h2>The theory behind ABMNM</h2>
    <p style="max-width:70ch;">ABMNM functions on the key concepts of neuroplasticity, that given the right tools and circumstances, the brain can grow and improve. Touch and movement can create new neural pathways, leading to enhanced performance, recovery from injury and stroke, and overall better cognitive function.</p>
    <p style="max-width:70ch;">A somatic approach to healing, ABMNM has been a valuable tool for people in rehabilitation, with debilitating diseases, cognitive issues, and anyone else seeking more wellness and longevity.</p>
  </div>
</section>

<section class="section alt">
  <div class="wrap">
    <h2>Who benefits from this practice</h2>
    <div class="grid grid-3" style="margin-top:1.5em;">
      <div class="card settle">People recovering from stroke or brain trauma</div>
      <div class="card settle">Children with developmental disabilities and special needs</div>
      <div class="card settle">People with chronic conditions such as Parkinson's and multiple sclerosis</div>
      <div class="card settle">High performers, musicians, dancers, athletes</div>
      <div class="card settle">People with back, neck, and joint pain</div>
      <div class="card settle">People with movement limitations, or anyone seeking increased vitality and cognitive function</div>
    </div>
  </div>
</section>

<section class="section" style="text-align:center;">
  <div class="wrap">
    <h2>Curious what a lesson feels like?</h2>
    <div class="hero-cta" style="justify-content:center;">
      <a class="btn btn-primary" href="/services.html">See services &amp; pricing</a>
      <a class="btn btn-ghost" href="/book.html">Book a session</a>
    </div>
  </div>
</section>
`,
});

// ---------- TESTIMONIALS ----------
const testimonials = page({
  path: "/testimonials.html",
  title: "Testimonials | Heal with Movement",
  description: "Hear from clients about their experience with Anat Baniel Method NeuroMovement lessons with Heidi Rood.",
  active: "/testimonials.html",
  body: `
<section class="section">
  <div class="wrap">
    <p class="eyebrow">In their words</p>
    <h1>Testimonials</h1>
    <div class="grid grid-2" style="margin-top:2em;">
      ${quote("Heidi's ABMNM Transformational Movement class was an adjustment for me, as I am used to pushing myself in yoga and stretching, sometimes to injury. She guides you through the concept of small movements, and reminds you if you're going too far or fast. My sciatica is gone after 3 classes, and my hips feel even for the first time in years. I'm moving easier, not overcompensating, and I'm pleasantly surprised when I'm anticipating pain and it's not there!", "Linda S.")}
      ${quote("Heidi creates a friendly, caring and professional atmosphere. The inquiries she had about my issues (neck and shoulder) made me confident she was on a clear path to assessing the approach she wanted to take in addressing my pain. The treatments are seemingly incredibly subtle, but after each session there was a definite increase in neck/shoulder flexibility and decrease in pain.", "Paul W.")}
      ${quote("Heidi is a truly gifted teacher of movement and somatic body experience. Her lessons are skillfully communicated through space and time to establish unity within our own bodies as well as community with each other!", "Keri S.")}
      ${quote("After Heidi's class last night I had the best night's sleep in months! I look forward to more classes!", "Judy M.")}
      ${quote("By chance I stumbled upon Heidi's class, and what a blessing that was! I had been suffering from pains that wouldn't go away with any visit to physiotherapists, osteopaths or massages, and then the miracle happened: a couple of classes with Heidi helped my general well-being enormously. And we did it online!", "Ana B.")}
      ${quote("I love this work. Heidi was very patient, clear and thorough. This was a wonderful experience!", "Eryn T.")}
    </div>
    <div class="quote-card settle" style="margin-top:2em;">
      <q>I've taken two sessions of six weeks with Heidi since the pandemic and I'm always surprised at the change after a session. I suffer from chronic pain and have a tendency to injure myself easily, but Heidi's classes have exposed me to a new way of healing and moving that doesn't involve pushing myself to my limit or pain. I recommend trying it!</q>
      <p class="quote-attr">Linda S.</p>
    </div>
  </div>
</section>
<section class="section alt" style="text-align:center;">
  <div class="wrap">
    <h2>Ready to feel the difference?</h2>
    <a class="btn btn-primary" href="/book.html">Book a Session</a>
  </div>
</section>
`,
});

// ---------- SERVICES ----------
const services = page({
  path: "/services.html",
  title: "Services & Pricing | Heal with Movement",
  description: "Private ABM NeuroMovement lessons in Chittenden County VT and Montreal QC, plus virtual group classes. Pricing to be confirmed with Heidi Rood.",
  active: "/services.html",
  body: `
<section class="section">
  <div class="wrap">
    <p class="eyebrow">Services &amp; pricing</p>
    <h1>Choose the way you'd like to work together.</h1>
    <p style="max-width:60ch; color:var(--c-ink-soft);">All prices, session durations, and the cancellation notice window below are placeholders pending confirmation from Heidi, see <a href="/PLACEHOLDERS.md">PLACEHOLDERS.md</a> for the full list.</p>
  </div>
</section>

<section class="section alt">
  <div class="wrap">
    <div class="grid grid-3">
      <div class="card settle">
        <h3>Vermont Private Lesson</h3>
        <p>In-person, one-on-one, Chittenden County, VT.</p>
        <p class="stat">{{PRICE}}</p>
        <p class="hint">Session length: {{DURATION}}</p>
        <a class="btn btn-primary btn-small" href="/book.html?location=vermont">Book Vermont</a>
      </div>
      <div class="card settle">
        <h3>Montreal Private Lesson</h3>
        <p>In-person, one-on-one, Montreal, QC.</p>
        <p class="stat">{{PRICE}}</p>
        <p class="hint">Session length: {{DURATION}}</p>
        <a class="btn btn-primary btn-small" href="/book.html?location=montreal">Book Montreal</a>
      </div>
      <div class="card settle">
        <h3>Virtual Group Class</h3>
        <p>Live online group session, seats limited.</p>
        <p class="stat">{{PRICE}}</p>
        <p class="hint">Session length: {{DURATION}} · Seats: {{GROUP_SEATS}}</p>
        <a class="btn btn-primary btn-small" href="/book.html?location=virtual">Book Virtual</a>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap grid grid-2">
    <div class="settle">
      <h2>Sessions for children</h2>
      <p>For a child's first session, please complete the intake form in advance so Heidi can prepare for your visit.</p>
      <a class="btn btn-ghost" href="/intake.html">Complete the child intake form</a>
    </div>
    <div class="settle">
      <h2>Cancellation policy</h2>
      <p>Heal with Movement reserves the right to charge the full applicable treatment fee for missed or cancelled appointments if <strong>{{CANCELLATION_HOURS}} hours'</strong> notice has not been received. (Sourced from the intake form's existing 24-hour language, confirm this still applies to all session types before launch.)</p>
      <a class="btn btn-ghost" href="/cancellation.html">Read the full policy</a>
    </div>
  </div>
</section>
`,
});

// ---------- BOOK ----------
const book = page({
  path: "/book.html",
  title: "Book a Session | Heal with Movement",
  description: "Choose your location and book an Anat Baniel Method NeuroMovement session with Heidi Rood via Cal.com.",
  active: "/book.html",
  body: `
<section class="section">
  <div class="wrap">
    <p class="eyebrow">Book</p>
    <h1>Book a session</h1>
    <p style="max-width:60ch; color:var(--c-ink-soft);">First, choose where you'd like to work together. If you're booking for a child's first session, please complete the <a href="/intake.html">intake form</a> first, Heidi reviews it before your first lesson.</p>

    <div class="loc-grid" id="location-chooser" role="group" aria-label="Choose a location">
      <button class="loc-card" type="button" data-cal-key="vermont" aria-pressed="false">
        <h3>Chittenden County, VT</h3>
        <p>In-person private lesson</p>
      </button>
      <button class="loc-card" type="button" data-cal-key="montreal" aria-pressed="false">
        <h3>Montreal, QC</h3>
        <p>In-person private lesson</p>
      </button>
      <button class="loc-card" type="button" data-cal-key="virtual" aria-pressed="false">
        <h3>Virtual</h3>
        <p>Live group class, online</p>
      </button>
    </div>

    <div id="child-notice" class="skip-note" style="margin-top:1.5em; display:none;">
      Booking for a child? Please complete the <a href="/intake.html">child intake form</a> before your first session, Heidi reviews every intake before meeting a new child client.
    </div>

    <div id="cal-embed-container" style="margin-top:2em;" aria-live="polite">
      <p style="padding:32px; color:var(--c-ink-soft);">Select a location above to load available times.</p>
    </div>
  </div>
</section>
`,
  extraHead: `<script src="https://app.cal.com/embed/embed.js" async></script>`,
  extraScripts: `<script src="/js/booking.js" defer></script>`,
});

// ---------- FAQ ----------
const faqItems = [
  ["What is a NeuroMovement lesson like?", "Lessons are slow, gentle, and exploratory, Heidi guides small, varied movements by hand (or verbally, in group classes) so your nervous system can discover new, easier ways to move. There is no forcing or stretching to a point of pain."],
  ["Do I need any experience or equipment?", "No experience is necessary. Wear comfortable clothing you can move in. In-person sessions typically take place on a low table; virtual sessions can be done seated, lying down, or standing, depending on the class."],
  ["Is this covered by insurance?", "{{INSURANCE_INFO}}, please confirm coverage with your provider; Heal with Movement can provide a receipt for services upon request."],
  ["What ages and conditions do you work with?", "Heidi works with children with developmental disabilities and special needs, adults recovering from injury or stroke, people with chronic conditions such as Parkinson's and multiple sclerosis, high performers, and anyone seeking greater ease of movement."],
  ["How do I book for my child?", "Please complete the child intake form before your first session. Heidi reviews every intake ahead of a first lesson with a new child client."],
  ["What is the cancellation policy?", "Heal with Movement reserves the right to charge the full session fee for cancellations made with less than {{CANCELLATION_HOURS}} hours' notice. See the full Cancellation Policy page for details."],
  ["Do you offer virtual sessions?", "Yes, virtual group classes meet live online. Several clients have found the virtual format just as effective as in-person work."],
  ["Where are in-person sessions held?", "In-person private lessons are offered in Chittenden County, Vermont and in Montreal, Quebec. {{STUDIO_ADDRESS}}"],
];
const faq = page({
  path: "/faq.html",
  title: "FAQ | Heal with Movement",
  description: "Answers to common questions about Anat Baniel Method NeuroMovement sessions with Heidi Rood.",
  active: "/faq.html",
  body: `
<section class="section">
  <div class="wrap">
    <p class="eyebrow">Questions</p>
    <h1>Frequently asked questions</h1>
    <div style="max-width:70ch; margin-top:1.5em;">
      ${faqItems.map(([q, a]) => `<details class="faq-item"><summary>${q}</summary><p>${a}</p></details>`).join("\n      ")}
    </div>
  </div>
</section>
`,
});

// ---------- CONTACT ----------
const contact = page({
  path: "/contact.html",
  title: "Contact | Heal with Movement",
  description: "Get in touch with Heidi Rood at Heal with Movement.",
  active: "/contact.html",
  body: `
<section class="section">
  <div class="wrap grid grid-2">
    <div class="settle">
      <p class="eyebrow">Contact</p>
      <h1>Say hello</h1>
      <p>Questions about sessions, locations, or scheduling? Send a note and Heidi will get back to you.</p>
      <ul style="list-style:none; padding:0; display:flex; flex-direction:column; gap:.8em;">
        <li><strong>Email:</strong> <a href="mailto:heidi@healwithmovement.com">heidi@healwithmovement.com</a></li>
        <li><strong>Locations:</strong> Chittenden County, VT &amp; Montreal, QC (in-person) · Virtual (anywhere)</li>
        <li><strong>Phone:</strong> {{PHONE}}</li>
      </ul>
    </div>
    <form class="card settle" action="#" method="post" onsubmit="return false;">
      <div class="field">
        <label for="c-name">Name</label>
        <input type="text" id="c-name" name="name" required autocomplete="name">
      </div>
      <div class="field">
        <label for="c-email">Email</label>
        <input type="email" id="c-email" name="email" required autocomplete="email">
      </div>
      <div class="field">
        <label for="c-message">Message</label>
        <textarea id="c-message" name="message" required></textarea>
      </div>
      <p class="hint">This form is a UI placeholder, wire it to a Cloudflare Pages Function + Resend (mirroring <code>functions/api/intake.js</code>) or a form service before launch.</p>
      <button class="btn btn-primary" type="submit">Send message</button>
    </form>
  </div>
</section>
`,
});

// ---------- LEGAL PAGES ----------
function legalPage({ path, title, heading, body }) {
  return page({
    path, title,
    description: `${heading} for Heal with Movement.`,
    active: "",
    body: `
<section class="section">
  <div class="wrap" style="max-width:800px;">
    <div class="skip-note" style="margin-bottom:2em;">
      <strong>Draft for Heidi's review.</strong> This is a placeholder legal draft, not legal advice. Please have it reviewed by a qualified attorney (and, for Quebec/Law 25 matters, one familiar with Quebec privacy law) before publishing. <span class="placeholder-tag">DRAFT</span>
    </div>
    <p class="eyebrow">Legal</p>
    <h1>${heading}</h1>
    ${body}
    <p class="hint">Last updated: {{LEGAL_DATE}}</p>
  </div>
</section>
`,
  });
}

const privacy = legalPage({
  path: "/privacy.html",
  title: "Privacy Policy | Heal with Movement",
  heading: "Privacy Policy",
  body: `
<p>Heal with Movement ("we", "us") respects your privacy. This policy explains what information we collect through healwithmovement.com and how we use it.</p>
<h3>Information we collect</h3>
<p>Contact form and newsletter submissions (name, email, message); child intake form submissions (health history and contact details, used only to prepare for sessions); booking information collected by our scheduling provider, Cal.com, and payment information collected by Stripe (we do not store card numbers); anonymized analytics data via our privacy-friendly analytics provider.</p>
<h3>How we use it</h3>
<p>To respond to inquiries, schedule and prepare for sessions, and improve the site. We do not sell personal information.</p>
<h3>Residents of Quebec (Law 25)</h3>
<p>If you are located in Quebec, you have rights under Law 25 (Act respecting the protection of personal information in the private sector), including the right to access, correct, and request deletion of your personal information, and to know how it is used. Contact heidi@healwithmovement.com to exercise these rights.</p>
<h3>Third-party processors</h3>
<p>We use Cal.com (scheduling), Stripe (payments), Resend (transactional email), and Cloudflare (hosting, forms, Turnstile bot protection). Each has its own privacy policy.</p>
<h3>Contact</h3>
<p>Questions about this policy: <a href="mailto:heidi@healwithmovement.com">heidi@healwithmovement.com</a>.</p>
`,
});

const terms = legalPage({
  path: "/terms.html",
  title: "Terms of Service | Heal with Movement",
  heading: "Terms of Service",
  body: `
<p>By using healwithmovement.com or booking a session with Heal with Movement, you agree to these terms.</p>
<h3>Services</h3>
<p>Heal with Movement provides Anat Baniel Method NeuroMovement lessons for children and adults, in person and virtually. Sessions are educational/somatic movement lessons, not medical treatment, see our <a href="/disclaimer.html">Medical Disclaimer</a>.</p>
<h3>Bookings &amp; payment</h3>
<p>Sessions are booked through our Cal.com scheduling system with payment processed by Stripe. Prices are listed at time of booking. See our <a href="/cancellation.html">Cancellation Policy</a> for rescheduling and cancellation terms.</p>
<h3>Use of the site</h3>
<p>You agree not to misuse the site, attempt to disrupt its operation, or submit false information through our forms.</p>
<h3>Limitation of liability</h3>
<p>To the fullest extent permitted by law, Heal with Movement and Heidi Rood are not liable for indirect, incidental, or consequential damages arising from use of the site or participation in sessions.</p>
<h3>Governing law</h3>
<p>{{GOVERNING_LAW_JURISDICTION}}</p>
`,
});

const cancellation = legalPage({
  path: "/cancellation.html",
  title: "Cancellation Policy | Heal with Movement",
  heading: "Cancellation Policy",
  body: `
<p>We know plans change. Here's what to expect if you need to reschedule or cancel.</p>
<h3>Notice window</h3>
<p>Heal with Movement reserves the right to charge the full applicable session fee for missed or cancelled appointments if at least <strong>{{CANCELLATION_HOURS}} hours'</strong> notice has not been received. This figure is carried over from Heidi's existing intake form language; confirm it still applies uniformly across Vermont, Montreal, and virtual group sessions before publishing.</p>
<h3>How to cancel or reschedule</h3>
<p>Use the manage-booking link in your Cal.com confirmation email, or contact <a href="mailto:heidi@healwithmovement.com">heidi@healwithmovement.com</a> directly.</p>
<h3>Group classes</h3>
<p>{{GROUP_CANCELLATION_TERMS}}</p>
`,
});

const disclaimer = legalPage({
  path: "/disclaimer.html",
  title: "Medical Disclaimer | Heal with Movement",
  heading: "Medical Disclaimer",
  body: `
<p>The Anat Baniel Method® NeuroMovement® is not a substitute for professional medical advice or a medical exam. You should regularly consult a doctor in all matters relating to physical or mental health, particularly concerning any symptoms that may require diagnosis or medical attention.</p>
<p>Heidi Rood and/or Heal with Movement make no warranties or guarantees concerning any particular outcome, result, or improvement from participation in functional synthesis and/or movement lessons.</p>
<p>Heidi Rood and/or Heal with Movement are not responsible for any direct, indirect, consequential, special, or other damages, including but not limited to economic loss, injury, or illness, that may result from participation in functional synthesis and/or movement lessons.</p>
<p>By booking a session or submitting an intake form, you confirm you have read and understood this disclaimer, and consent to treatment on that basis. You may withdraw consent at any time, at which point the session will be stopped.</p>
`,
});

// ---------- 404 ----------
const notFound = page({
  path: "/404.html",
  title: "Page not found | Heal with Movement",
  description: "This page could not be found.",
  active: "",
  body: `
<section class="section" style="text-align:center;">
  <div class="wrap">
    <p class="eyebrow">404</p>
    <h1>This page took a wrong turn.</h1>
    <p style="max-width:50ch; margin:0 auto 1.6em;">The page you're looking for doesn't exist, or has moved. Let's find you a better path.</p>
    <div class="hero-cta" style="justify-content:center;">
      <a class="btn btn-primary" href="/">Back to home</a>
      <a class="btn btn-ghost" href="/contact.html">Contact us</a>
    </div>
  </div>
</section>
`,
});

// ---------- INTAKE (multi-step) ----------
const intake = page({
  path: "/intake.html",
  title: "Child Intake Form | Heal with Movement",
  description: "Confidential intake form for a child's first Anat Baniel Method NeuroMovement session with Heidi Rood.",
  active: "",
  body: `
<section class="section">
  <div class="wrap" style="max-width:820px;">
    <p class="eyebrow">Before your child's first session</p>
    <h1>Intake Form &amp; Release of Liability (Child)</h1>
    <p style="color:var(--c-ink-soft);">The following information will be held in strict confidence. To help us work together effectively, please be as specific as possible. Thank you.</p>

    <form id="intake-form" novalidate>
      <div class="step-progress" id="step-progress" aria-hidden="true"><span><i></i></span><span><i></i></span><span><i></i></span><span><i></i></span></div>

      <!-- Step 1: Client & guardian -->
      <fieldset class="form-step active" data-step="1">
        <legend>1. Client &amp; guardian details</legend>
        <div class="grid grid-2">
          <div class="field">
            <label for="clientName">Client (child) name</label>
            <input type="text" id="clientName" name="clientName" required autocomplete="name">
          </div>
          <div class="field">
            <label for="birthDate">Birth date</label>
            <input type="date" id="birthDate" name="birthDate" required autocomplete="bday">
          </div>
          <div class="field">
            <label for="guardianName">Parent or guardian name</label>
            <input type="text" id="guardianName" name="guardianName" required>
          </div>
          <div class="field">
            <label for="referredBy">Referred by</label>
            <input type="text" id="referredBy" name="referredBy">
          </div>
        </div>
      </fieldset>

      <!-- Step 2: Contact -->
      <fieldset class="form-step" data-step="2">
        <legend>2. Contact information</legend>
        <div class="field">
          <label for="address">Address</label>
          <input type="text" id="address" name="address" required autocomplete="street-address">
        </div>
        <div class="grid grid-3">
          <div class="field">
            <label for="city">City</label>
            <input type="text" id="city" name="city" required autocomplete="address-level2">
          </div>
          <div class="field">
            <label for="province">Province / State</label>
            <input type="text" id="province" name="province" required autocomplete="address-level1">
          </div>
          <div class="field">
            <label for="postalCode">Postal / ZIP code</label>
            <input type="text" id="postalCode" name="postalCode" required autocomplete="postal-code">
          </div>
        </div>
        <div class="grid grid-2">
          <div class="field">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" required autocomplete="email">
          </div>
          <div class="field">
            <label for="occupation">Occupation / employer</label>
            <input type="text" id="occupation" name="occupation">
          </div>
        </div>
        <div class="grid grid-3">
          <div class="field">
            <label for="homePhone">Home phone</label>
            <input type="tel" id="homePhone" name="homePhone">
          </div>
          <div class="field">
            <label for="cellPhone">Cell phone</label>
            <input type="tel" id="cellPhone" name="cellPhone">
          </div>
          <div class="field">
            <label for="workPhone">Work phone</label>
            <input type="tel" id="workPhone" name="workPhone">
          </div>
        </div>
        <div class="field">
          <label id="preferredPhoneLabel">Preferred phone for us to call first</label>
          <div class="radio-row" role="radiogroup" aria-labelledby="preferredPhoneLabel">
            <label><input type="radio" name="preferredPhone" value="home" required> Home</label>
            <label><input type="radio" name="preferredPhone" value="cell"> Cell</label>
            <label><input type="radio" name="preferredPhone" value="work"> Work</label>
          </div>
        </div>
      </fieldset>

      <!-- Step 3: Health history -->
      <fieldset class="form-step" data-step="3">
        <legend>3. Health history</legend>
        <div class="field">
          <label for="diagnosis">What is your child's diagnosis, if any?</label>
          <textarea id="diagnosis" name="diagnosis"></textarea>
        </div>
        <div class="field">
          <label for="reason">What is your primary reason for seeking treatment today?</label>
          <textarea id="reason" name="reason" required></textarea>
        </div>
        <div class="field">
          <label for="otherTreatments">Are they presently receiving other treatments/therapy (physio, chiro, OT, PT, speech, etc.)? Please specify.</label>
          <textarea id="otherTreatments" name="otherTreatments"></textarea>
        </div>
        <div class="field">
          <label id="tubesLabel">Do they have any tubes or devices attached?</label>
          <div class="radio-row" role="radiogroup" aria-labelledby="tubesLabel">
            <label><input type="radio" name="hasTubes" value="yes" required> Yes</label>
            <label><input type="radio" name="hasTubes" value="no"> No</label>
          </div>
        </div>
        <div class="grid grid-2">
          <div class="field">
            <label for="tubesDetail">If yes, please specify (port, shunt, feeding tube, other)</label>
            <input type="text" id="tubesDetail" name="tubesDetail">
          </div>
          <div class="field">
            <label for="tubesSinceAge">Since what age?</label>
            <input type="text" id="tubesSinceAge" name="tubesSinceAge">
          </div>
        </div>
        <div class="field">
          <label for="supportDevices">Do they use support devices such as AFOs, braces, splints, standers, special chairs, wheelchairs, walker, etc.? If so, specify what and how often they're used.</label>
          <textarea id="supportDevices" name="supportDevices"></textarea>
        </div>
        <div class="field">
          <label for="surgicalHistory">Describe any surgical procedure, accident, or muscular/skeletal problem or pain that has required medical care.</label>
          <textarea id="surgicalHistory" name="surgicalHistory"></textarea>
        </div>
        <div class="field">
          <label for="eatSleep">Does your child eat and sleep well? If not, briefly explain.</label>
          <textarea id="eatSleep" name="eatSleep"></textarea>
        </div>
        <div class="field">
          <label for="medications">Are they taking any medications (anti-seizure, ADHD, anxiety)?</label>
          <textarea id="medications" name="medications"></textarea>
        </div>
        <div class="field">
          <label for="additionalInfo">Anything else you'd like to add to help us better understand and help your child?</label>
          <textarea id="additionalInfo" name="additionalInfo"></textarea>
        </div>
      </fieldset>

      <!-- Step 4: Disclaimer & consent -->
      <fieldset class="form-step" data-step="4">
        <legend>4. Disclaimer &amp; consent</legend>
        <div class="card" style="max-height:260px; overflow:auto; font-size:.9rem; margin-bottom:1.2em;">
          <p>The Anat Baniel Method® NeuroMovement® is not a substitute for professional medical advice or a medical exam. You should regularly consult a doctor in all matters relating to physical or mental health, particularly concerning any symptoms that may require diagnosis or medical attention.</p>
          <p>Heidi Rood and/or Heal with Movement make no warranties or guarantees concerning any particular outcome, result, or improvement from participation in functional synthesis and/or movement lessons, and are not responsible for any direct, indirect, consequential, special, or other damages that may result from participation.</p>
          <p>By signing below, I confirm my consent to treatment for my child, understanding that I may withdraw consent at any time, at which point treatment will be stopped.</p>
          <p><strong>Please note:</strong> Heal with Movement reserves the right to charge the full applicable treatment fee for missed or cancelled appointments if {{CANCELLATION_HOURS}} hours' notice has not been received.</p>
        </div>
        <div class="field">
          <label><input type="checkbox" name="consent" required> I have read and understood the disclaimer above, and I consent to treatment for my child.</label>
        </div>
        <div class="grid grid-2">
          <div class="field">
            <label for="signature">Signature (type full legal name)</label>
            <input type="text" id="signature" name="signature" required>
          </div>
          <div class="field">
            <label for="signDate">Date</label>
            <input type="date" id="signDate" name="signDate" required>
          </div>
        </div>
        <div class="field">
          <div id="turnstile-widget" class="cf-turnstile" data-sitekey="{{TURNSTILE_SITE_KEY}}"></div>
          <p class="hint">Bot protection by Cloudflare Turnstile, replace <code>{{TURNSTILE_SITE_KEY}}</code> in this file with your live site key.</p>
        </div>
      </fieldset>

      <div id="intake-status" role="status" aria-live="polite"></div>

      <div class="step-nav">
        <button type="button" class="btn btn-ghost" id="intake-back" disabled>Back</button>
        <button type="button" class="btn btn-primary" id="intake-next">Continue</button>
        <button type="submit" class="btn btn-primary" id="intake-submit" style="display:none;">Submit intake form</button>
      </div>
    </form>
  </div>
</section>
`,
  extraHead: `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`,
  extraScripts: `<script src="/js/intake.js" defer></script>`,
});

// ---------- write files ----------
const files = {
  "index.html": home,
  "about.html": about,
  "abm.html": abm,
  "testimonials.html": testimonials,
  "services.html": services,
  "book.html": book,
  "faq.html": faq,
  "contact.html": contact,
  "privacy.html": privacy,
  "terms.html": terms,
  "cancellation.html": cancellation,
  "disclaimer.html": disclaimer,
  "404.html": notFound,
  "intake.html": intake,
};

for (const [name, content] of Object.entries(files)) {
  writeFileSync(join(__dirname, name), content, "utf8");
}
console.log("Built", Object.keys(files).length, "pages.");
