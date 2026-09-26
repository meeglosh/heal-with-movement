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
    // Each quote holds on its own for most of its scroll slot. Near the end
    // of the slot it fades out, leaves a short clear beat, then the next quote
    // fades in. The overlap-free handoff keeps both quotes from competing.
    var testSpacer = document.getElementById("testimonial-pin-spacer");
    var testPin = document.getElementById("testimonial-pin");
    var testStages = document.querySelectorAll(".testimonial-stage");
    var testDots = document.querySelectorAll(".testimonial-dot");
    var testVisual = document.getElementById("testimonial-visual-svg");

    if (testSpacer && testPin && testStages.length) {
      document.documentElement.classList.add("js-testimonials-pinned");
      var n = testStages.length;
      if (n === 1) {
        testStages[0].style.opacity = "1";
        testStages[0].classList.add("is-active");
      } else ScrollTrigger.create({
        trigger: testSpacer,
        start: "top top",
        end: "+=" + (isMobile ? "180%" : "320%"),
        pin: testPin,
        scrub: true,
        snap: {
          // Snap only if the visitor stops during a transition. Holds remain
          // wherever the visitor leaves them, and endpoints stay reachable.
          snapTo: function (value) {
            if (value <= 0 || value >= 1) return value;
            var position = value * n;
            var index = Math.min(n - 1, Math.floor(position));
            var local = position - index;
            if (index > 0 && local < 0.06) return (index + 0.5) / n;
            if (index < n - 1 && local >= 0.9) return (index + 0.5) / n;
            return value;
          },
          duration: { min: 0.3, max: 0.8 },
          ease: "power1.inOut",
        },
        onUpdate: function (self) {
          var p = self.progress;
          // Each quote owns one equal slot. It fades in during the first 6%,
          // holds alone through 90%, then fades out during the next 4%; a
          // clear beat separates it from the next slot. The final quote also
          // gets a full-width hold before the pinned sequence ends.
          var position = p * n;
          var current = Math.min(n - 1, Math.floor(position));
          var local = position - current;
          var opacities = new Array(n).fill(0);

          if (current === 0 || local >= 0.06) {
            opacities[current] = 1;
          } else {
            opacities[current] = local / 0.06;
          }
          if (current < n - 1 && local >= 0.9) {
            opacities[current] = Math.max(0, 1 - (local - 0.9) / 0.04);
          }

          testStages.forEach(function (stage, i) {
            var opacity = opacities[i];
            stage.style.opacity = String(opacity);
            stage.classList.toggle("is-active", opacity > 0.5);
          });
          var activeDot = opacities.findIndex(function (opacity) { return opacity > 0.5; });
          if (activeDot < 0) activeDot = current;
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
