/* Editorial motion: a paced testimonial sequence and a subtle photographic reveal.
 * Hero and manifesto remain in normal document flow. Reduced motion and
 * unavailable GSAP use the fully readable static layout in editorial.css.
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
    var isMobile = window.matchMedia("(max-width: 760px)").matches;

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
      document.documentElement.classList.add("js-testimonials-pinned");
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
          var half = 1 / (n - 1);
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

    // Science section: reveal and gently settle the field photograph.
    var scienceMedia = document.getElementById("science-media");
    var scienceMainFrame = document.getElementById("science-main-frame");
    var scienceMainImg = document.getElementById("science-main-img");

    if (scienceMedia && scienceMainFrame && scienceMainImg) {
      var clipMax = isMobile ? 8 : 12;

      ScrollTrigger.create({
        trigger: scienceMedia,
        start: "top 85%",
        end: isMobile ? "center 65%" : "center 55%",
        scrub: true,
        onUpdate: function (self) {
          var p = self.progress;

          var clip = clipMax * (1 - p);
          scienceMainFrame.style.clipPath =
            "inset(" + clip + "% " + clip + "% " + clip + "% " + clip + "%)";
          scienceMainImg.style.transform = "scale(" + (1.15 - 0.15 * p) + ")";

        },
      });
    }

    window.addEventListener("resize", function () {
      ScrollTrigger.refresh();
    });
  });
})();
