/* Heal with Movement — home page scroll choreography.
 *
 * Three pinned, scroll-scrubbed sequences, built on GSAP + ScrollTrigger:
 *
 * 1. The hero: three independent planes (the video, the headline, and a
 *    foreground spiral/light plane) move at different rates as the visitor
 *    scrolls out of it, and a full-bleed plum wash ramps in to bridge into
 *    the next section.
 * 2. The signature move: the brand's continuous spiral line draws itself
 *    (stroke-dashoffset scrubbed by scroll progress) while three short
 *    statements cross-fade in step with the line's travel. This is the
 *    page's engineered emotional peak.
 * 3. Testimonials as stops: a second, deliberately different-looking
 *    pinned sequence (light canvas, side dot index, no drawn line) where
 *    each of five short testimonials crossfades in as a scroll-scrubbed
 *    "stop," with a gentle snap to the nearest stop.
 *
 * Everything here is additive progressive enhancement:
 *  - If GSAP/ScrollTrigger fail to load, the page is left exactly as the
 *    static, fully-readable markup renders it (no pin, no hidden content).
 *  - If the visitor has prefers-reduced-motion set, this script does not
 *    run at all — the CSS reduced-motion rules already lay the hero and
 *    signature sections out as plain static, fully visible content.
 *  - Only transform and opacity are animated, so this stays on the
 *    compositor thread (no layout thrash).
 */
(function () {
  "use strict";

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  function ready(cb) {
    if (document.readyState !== "loading") cb();
    else document.addEventListener("DOMContentLoaded", cb);
  }

  ready(function () {
    if (!window.gsap || !window.ScrollTrigger) return; // static fallback stands
    gsap.registerPlugin(ScrollTrigger);
    document.documentElement.classList.add("js-hero-pinned");

    var isMobile = window.matchMedia("(max-width: 760px)").matches;

    // ---------------- Hero: pinned, three planes ----------------
    var heroSpacer = document.getElementById("hero-pin-spacer");
    var hero = document.getElementById("hero");
    var heroImage = hero && hero.querySelector(".hero-media img");
    var heroInner = hero && hero.querySelector(".hero-inner");
    var heroFg = document.getElementById("hero-fg");
    var heroDarken = document.getElementById("hero-darken");

    if (heroSpacer && hero) {
      ScrollTrigger.create({
        trigger: heroSpacer,
        start: "top top",
        end: "+=" + (isMobile ? "70%" : "100%"),
        pin: hero,
        scrub: true,
        onUpdate: function (self) {
          var p = self.progress;
          if (heroImage) heroImage.style.transform = "scale(" + (1 + p * 0.14) + ")";
          if (heroInner) {
            heroInner.style.transform = "translateY(" + (-p * 64) + "px)";
            heroInner.style.opacity = String(Math.max(0, 1 - p * 1.15));
          }
          if (heroFg) {
            heroFg.style.transform = "translateY(" + (-p * 150) + "px)";
            // Starts faint (resting opacity ~0.15, set in CSS) and gains
            // presence as the hero scrolls away, rather than fading out.
            heroFg.style.opacity = String(0.15 + p * 0.35);
          }
          if (heroDarken) heroDarken.style.opacity = String(Math.min(1, p * 1.15));
        },
      });
    }

    // ---------------- Signature: the spiral draws itself ----------------
    var sigSpacer = document.getElementById("sig-pin-spacer");
    var sigPin = document.getElementById("sig-pin");
    var path = document.getElementById("sig-path");
    var stages = document.querySelectorAll(".signature-stage");

    if (sigSpacer && sigPin && path) {
      var len = path.getTotalLength();
      path.style.strokeDasharray = String(len);
      path.style.strokeDashoffset = String(len);

      ScrollTrigger.create({
        trigger: sigSpacer,
        start: "top top",
        end: "+=" + (isMobile ? "160%" : "250%"),
        pin: sigPin,
        scrub: true,
        onUpdate: function (self) {
          var p = self.progress;
          path.style.strokeDashoffset = String(len * (1 - p));
          stages.forEach(function (stage, i) {
            var stageStart = i / stages.length;
            var stageEnd = (i + 1) / stages.length;
            var mid = (stageStart + stageEnd) / 2;
            var half = (stageEnd - stageStart) / 2;
            var dist = Math.abs(p - mid);
            var opacity = Math.max(0, 1 - dist / half);
            stage.style.opacity = String(opacity);
            stage.classList.toggle("is-active", opacity > 0.5);
          });
        },
      });
    }

    // ---------------- Testimonials: pinned stops ----------------
    // Same "continuous crossfade tied to scroll progress" mechanism as the
    // signature stages, but a distinct composition (see CSS): light canvas,
    // side dot index instead of a drawn line, and a gentle snap to each
    // stop so the section doesn't leave a quote frozen mid-crossfade if the
    // visitor stops scrolling between stops.
    var testSpacer = document.getElementById("testimonial-pin-spacer");
    var testPin = document.getElementById("testimonial-pin");
    var testStages = document.querySelectorAll(".testimonial-stage");
    var testDots = document.querySelectorAll(".testimonial-dot");
    var testVisual = document.getElementById("testimonial-visual-svg");

    if (testSpacer && testPin && testStages.length) {
      var n = testStages.length;
      ScrollTrigger.create({
        trigger: testSpacer,
        start: "top top",
        end: "+=" + (isMobile ? "180%" : "320%"),
        pin: testPin,
        scrub: true,
        snap: {
          snapTo: 1 / (n - 1),
          duration: { min: 0.3, max: 0.8 },
          ease: "power1.inOut",
        },
        onUpdate: function (self) {
          var p = self.progress;
          // Stage centers are spaced at i/(n-1) (0, .25, .5, .75, 1 for
          // n=5), the same points the snap config above snaps to, so the
          // scroll always settles exactly on a full-opacity stage rather
          // than mid-crossfade between two.
          var half = 1 / (2 * (n - 1));
          testStages.forEach(function (stage, i) {
            var mid = i / (n - 1);
            var dist = Math.abs(p - mid);
            var opacity = Math.max(0, 1 - dist / half);
            stage.style.opacity = String(opacity);
            stage.classList.toggle("is-active", opacity > 0.5);
          });
          var activeDot = Math.round(p * (n - 1));
          testDots.forEach(function (dot, i) {
            dot.classList.toggle("is-active", i === activeDot);
          });
          // Desktop-only visual plane (hidden via CSS below 1024px): the
          // spiral turns slowly and gains a little presence as the
          // visitor moves through the stops, a quiet echo of the
          // signature move rather than a repeat of it.
          if (testVisual) {
            testVisual.style.transform = "rotate(" + (p * 50) + "deg)";
          }
        },
      });
    }

    ScrollTrigger.addEventListener("refreshInit", function () {
      // recompute isMobile-dependent end distances on resize/orientation change
    });
    window.addEventListener("resize", function () {
      ScrollTrigger.refresh();
    });
  });
})();
