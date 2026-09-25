(function () {
  "use strict";
  var cfg = window.HWM_CONFIG || {};
  var calCfg = (cfg.cal || {});
  var container = document.getElementById("cal-embed-container");
  var buttons = document.querySelectorAll("#location-chooser .loc-card");
  var childNotice = document.getElementById("child-notice");

  function loadCal(callback) {
    if (window.Cal) return callback();
    var check = setInterval(function () {
      if (window.Cal) { clearInterval(check); callback(); }
    }, 100);
  }

  function openLocation(key) {
    buttons.forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-cal-key") === key ? "true" : "false");
    });
    childNotice.style.display = key ? "block" : "none";
    var calLink = (calCfg.calLink || {})[key];
    if (!calLink || !container) return;
    container.innerHTML = "";
    loadCal(function () {
      window.Cal("inline", {
        elementOrSelector: "#cal-embed-container",
        calLink: calLink,
        config: { theme: "light" },
      });
    });
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      openLocation(btn.getAttribute("data-cal-key"));
    });
  });

  // Preselect from ?location= query param (used by Services page links)
  var params = new URLSearchParams(window.location.search);
  var initial = params.get("location");
  if (initial && calCfg.calLink && calCfg.calLink[initial]) {
    openLocation(initial);
  }
})();
