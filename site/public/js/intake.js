(function () {
  "use strict";
  var form = document.getElementById("intake-form");
  if (!form) return;

  var steps = Array.prototype.slice.call(form.querySelectorAll(".form-step"));
  var progressBars = document.querySelectorAll("#step-progress i");
  var current = 0;
  var backBtn = document.getElementById("intake-back");
  var nextBtn = document.getElementById("intake-next");
  var submitBtn = document.getElementById("intake-submit");
  var statusEl = document.getElementById("intake-status");
  var cfg = window.HWM_CONFIG || {};

  function showStep(i) {
    steps.forEach(function (s, idx) { s.classList.toggle("active", idx === i); });
    progressBars.forEach(function (bar, idx) {
      bar.style.width = idx <= i ? "100%" : "0%";
    });
    backBtn.disabled = i === 0;
    var isLast = i === steps.length - 1;
    nextBtn.style.display = isLast ? "none" : "inline-flex";
    submitBtn.style.display = isLast ? "inline-flex" : "none";
    steps[i].querySelector("input, textarea, select")?.focus({ preventScroll: false });
  }

  function validateStep(i) {
    var invalid = steps[i].querySelector(":invalid");
    if (invalid) {
      invalid.reportValidity();
      return false;
    }
    return true;
  }

  nextBtn.addEventListener("click", function () {
    if (!validateStep(current)) return;
    if (current < steps.length - 1) { current++; showStep(current); }
  });
  backBtn.addEventListener("click", function () {
    if (current > 0) { current--; showStep(current); }
  });

  showStep(current);

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!validateStep(current)) return;

    var formData = new FormData(form);
    var data = {};
    formData.forEach(function (v, k) { data[k] = v; });

    var turnstileResp = form.querySelector('[name="cf-turnstile-response"]');
    data.turnstileToken = turnstileResp ? turnstileResp.value : "";

    submitBtn.disabled = true;
    statusEl.textContent = "Submitting…";

    try {
      var res = await fetch((cfg.intakeApiEndpoint || "/api/intake"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      var result = await res.json().catch(function () { return {}; });
      if (!res.ok || !result.ok) {
        throw new Error(result.error || "Something went wrong. Please try again.");
      }
      form.innerHTML = "";
      statusEl.innerHTML = "<p><strong>Thank you.</strong> Your intake form has been sent to Heidi. She'll follow up before your child's first session. You can now <a href=\"/book.html\">book a session</a> if you haven't already.</p>";
    } catch (err) {
      statusEl.textContent = err.message || "Something went wrong. Please try again or email heidi@healwithmovement.com directly.";
      submitBtn.disabled = false;
    }
  });
})();
