(function () {
  "use strict";

  // Mobile nav toggle
  var toggle = document.querySelector(".nav-toggle");
  var navLinks = document.getElementById("nav-links");
  if (toggle && navLinks) {
    toggle.addEventListener("click", function () {
      var open = navLinks.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    navLinks.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        navLinks.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Signature "settle" reveal — elements arrive with a slow downward settle,
  // echoing the unhurried pace of an ABM lesson. Respects reduced motion via CSS.
  var settleEls = document.querySelectorAll(".settle");
  if ("IntersectionObserver" in window && settleEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    settleEls.forEach(function (el) { io.observe(el); });
  } else {
    settleEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  // EN/FR toggle scaffold — Law 25 bilingual requirement.
  // Full translations are not yet wired; this persists the choice and
  // flags untranslated pages so a translator/i18n pass can pick it up.
  var langButtons = document.querySelectorAll("[data-lang]");
  var stored = (function(){ try { return localStorage.getItem("hwm_lang"); } catch(e) { return null; } })();
  function setLang(lang) {
    document.documentElement.setAttribute("lang", lang);
    langButtons.forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-lang") === lang ? "true" : "false");
    });
    try { localStorage.setItem("hwm_lang", lang); } catch (e) {}
    if (lang === "fr") {
      console.info("HWM i18n: French translations are not yet wired for this page (scaffold only).");
    }
  }
  if (stored) setLang(stored);
  langButtons.forEach(function (b) {
    b.addEventListener("click", function () { setLang(b.getAttribute("data-lang")); });
  });
})();
