import { createAuthClient } from "@neondatabase/auth";
const authClient = createAuthClient(`${location.origin}/api/auth`);
const screen = document.getElementById("portal-screen");
const status = document.getElementById("portal-status");
const root = document.getElementById("portal");
const labels = {
  vermont: "Vermont Private Lesson",
  montreal: "Montreal Private Lesson",
  virtual: "Virtual Group Class",
};
let me,
  flow,
  email = "",
  name = "",
  selectedChild = null,
  selectedService =
    new URLSearchParams(location.search).get("location") || "vermont",
  week = 0;
const timeZone =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function message(text = "", error = false) {
  status.textContent = text;
  status.classList.toggle("is-error", error);
}
async function api(path, body) {
  const methods = {
    "/api/auth/get-session": () => authClient.getSession(),
    "/api/auth/sign-out": () => authClient.signOut(),
    "/api/auth/email-otp/send-verification-otp": () =>
      authClient.emailOtp.sendVerificationOtp(body),
    "/api/auth/sign-in/email-otp": () => authClient.signIn.emailOtp(body),
  };
  if (methods[path]) {
    const result = await methods[path]();
    if (result.error)
      throw new Error(
        result.error.message || "Sign-in could not be completed.",
      );
    return result.data;
  }
  const r = await fetch(path, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && path.startsWith("/api/portal/")) {
      me = null;
      signIn();
    }
    const error = new Error(
      data.error?.message || data.error || data.message || "Please try again.",
    );
    error.status = r.status;
    throw error;
  }
  return data;
}
function on(selector, fn, event = "click") {
  screen.querySelector(selector)?.addEventListener(event, async (e) => {
    if (event === "submit") e.preventDefault();
    const button = e.submitter || e.currentTarget;
    if (button instanceof HTMLButtonElement) button.disabled = true;
    message();
    try {
      await fn(e);
    } catch (error) {
      message(error.message, true);
    } finally {
      if (button instanceof HTMLButtonElement) button.disabled = false;
      root.setAttribute("aria-busy", "false");
    }
  });
}
function render(html) {
  screen.innerHTML = html;
  root.setAttribute("aria-busy", "false");
  screen.querySelector("h2")?.setAttribute("tabindex", "-1");
  screen.querySelector("h2")?.focus();
}
function toolbar() {
  return `<div class="portal-toolbar"><span class="muted">${escape(me.user.email)}</span><button class="portal-link" id="account-home">My account</button><button class="portal-link" id="sign-out">Sign out</button></div>`;
}
function wireToolbar() {
  on("#account-home", async () => {
    history.replaceState(null, "", "/account.html");
    await dashboard();
  });
  on("#sign-out", async () => {
    await api("/api/auth/sign-out", {});
    me = null;
    flow = null;
    history.replaceState(null, "", "/book.html");
    signIn();
  });
}
function signIn() {
  render(
    `<p class="eyebrow">Welcome</p><h2>A little space<br>for you.</h2><p>Sign in or create your account with an email code. No password to remember.</p><form id="sign-in-form"><div class="field"><label for="parent-name">Your name</label><input id="parent-name" name="name" autocomplete="name" maxlength="200" value="${escape(name)}" required></div><div class="field"><label for="parent-email">Email address</label><input id="parent-email" name="email" type="email" autocomplete="email" value="${escape(email)}" required></div><button class="btn btn-primary" type="submit">Send sign-in code</button></form><p class="muted" style="margin-top:24px">Your account lets you book for yourself or your children and keeps completed intake on file.</p>`,
  );
  on(
    "#sign-in-form",
    async (e) => {
      const data = new FormData(e.target);
      email = data.get("email");
      name = data.get("name");
      await api("/api/auth/email-otp/send-verification-otp", {
        email,
        type: "sign-in",
      });
      codeScreen();
    },
    "submit",
  );
}
function codeScreen() {
  render(
    `<h2>Check your inbox.</h2><p>Enter the code sent to ${escape(email)}.</p><form id="code-form"><div class="field"><label for="code">Sign-in code</label><input id="code" name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></div><button class="btn btn-primary">Continue</button></form><button class="portal-link" id="change-email">Use a different email or resend</button>`,
  );
  on("#change-email", () => signIn());
  on(
    "#code-form",
    async (e) => {
      await api("/api/auth/sign-in/email-otp", {
        email,
        otp: new FormData(e.target).get("otp"),
        name,
      });
      await load();
    },
    "submit",
  );
}
async function dashboard() {
  me = await api("/api/portal/me");
  render(
    `${toolbar()}<h2>Your account.</h2><p>Welcome, ${escape(me.user.name)}.</p><button class="btn btn-primary" id="new-booking">Book a Session</button><h3 style="margin-top:36px">Your appointments</h3>${me.bookings.length ? me.bookings.map((b) => `<article class="portal-booking"><strong>${escape(labels[b.service])}</strong><p>${escape(b.childName || "For yourself")}</p><p>${escape(new Date(b.start).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }))}</p><p>${escape({ accepted: "Confirmed", pending: "Awaiting confirmation", creating: "Processing", needs_review: "Awaiting review — please contact Heidi before booking again", cancelled: "Cancelled", rejected: "Declined" }[b.status] || b.status)}</p></article>`).join("") : '<p class="muted">No appointments yet.</p>'}<p class="muted">To cancel or reschedule, use the link in your booking confirmation email or contact Heidi.</p>${me.staff ? '<button class="portal-link" id="staff-intakes">Review intake</button>' : ""}`,
  );
  wireToolbar();
  on("#new-booking", () => {
    history.replaceState(null, "", "/book.html");
    choosePerson();
  });
  on("#staff-intakes", staffList);
}
function choosePerson() {
  flow = null;
  render(
    `${toolbar()}<p class="eyebrow">Book a Session</p><h2>Who is this for?</h2><div class="portal-options"><button class="portal-choice" data-person="self"><strong>Myself</strong><small>A session for you</small></button>${me.children.map((c) => `<button class="portal-choice" data-person="${escape(c.id)}"><strong>${escape(c.name)}</strong><small>${c.intakeComplete ? "Intake on file" : "First booking — intake needed"}</small></button>`).join("")}<button class="portal-choice" data-person="new"><strong>Add a child</strong><small>Book their first session</small></button></div>`,
  );
  wireToolbar();
  screen.querySelectorAll("[data-person]").forEach((b) =>
    on(`[data-person="${b.dataset.person}"]`, () => {
      if (b.dataset.person === "new") return addChild();
      selectedChild = b.dataset.person === "self" ? null : b.dataset.person;
      chooseService();
    }),
  );
}
function addChild() {
  render(
    `${toolbar()}<h2>Your child.</h2><p>Create a profile so you only need to complete intake once for this child.</p><form id="child-form"><div class="field"><label for="child-name">Child’s full name</label><input id="child-name" name="name" maxlength="200" required autocomplete="off"></div><div class="field"><label for="child-birth">Date of birth</label><input id="child-birth" type="date" name="birthDate" max="${new Date().toISOString().slice(0, 10)}" required></div><button class="btn btn-primary">Continue</button></form><button class="portal-link" id="back">Back</button>`,
  );
  wireToolbar();
  on("#back", choosePerson);
  on(
    "#child-form",
    async (e) => {
      const { child } = await api(
        "/api/portal/children",
        Object.fromEntries(new FormData(e.target)),
      );
      selectedChild = child.id;
      me = await api("/api/portal/me");
      chooseService();
    },
    "submit",
  );
}
function chooseService() {
  render(
    `${toolbar()}<h2>Where shall we meet?</h2><div class="portal-options">${Object.entries(
      labels,
    )
      .map(
        ([k, v]) =>
          `<button class="portal-choice" data-service="${k}" aria-pressed="${selectedService === k}"><strong>${v}</strong></button>`,
      )
      .join(
        "",
      )}</div><button class="btn btn-primary" id="continue">Continue</button><button class="portal-link" id="back" style="margin-left:20px">Back</button>`,
  );
  wireToolbar();
  screen.querySelectorAll("[data-service]").forEach((b) =>
    on(`[data-service="${b.dataset.service}"]`, () => {
      selectedService = b.dataset.service;
      screen
        .querySelectorAll("[data-service]")
        .forEach((x) =>
          x.setAttribute("aria-pressed", x === b ? "true" : "false"),
        );
    }),
  );
  on("#back", choosePerson);
  on("#continue", async () => {
    flow = await api("/api/portal/flows", {
      service: selectedService,
      childId: selectedChild,
    });
    history.replaceState(
      null,
      "",
      `/book.html?flow=${encodeURIComponent(flow.id)}`,
    );
    await resumeFlow();
  });
}
async function resumeFlow() {
  flow = await api(`/api/portal/flows/${flow.id}`);
  if (flow.needsIntake) return intake();
  week = 0;
  await slots();
}
async function intake() {
  const data = await api(`/api/portal/flows/${flow.id}/intake`);
  render(
    `${toolbar()}<p class="eyebrow">First session</p><h2>Getting to know ${flow.childId ? escape(flow.childName) : "you"}.</h2><p>Complete this once. It will stay on file for future bookings.</p>${data.html}`,
  );
  wireToolbar();
  const form = screen.querySelector("#intake-form");
  for (const [k, v] of Object.entries({
    clientName: data.childName || data.adultName || "",
    birthDate: data.birthDate ? String(data.birthDate).slice(0, 10) : "",
    email: data.email,
    guardianName: me.user.name,
    signDate: new Date().toISOString().slice(0, 10),
  })) {
    if (form.elements[k]) form.elements[k].value = v;
  }
  for (const k of flow.childId
    ? ["clientName", "birthDate", "email"]
    : ["email"])
    form.elements[k].readOnly = true;
  const steps = [...form.querySelectorAll(".form-step")];
  let current = 0;
  const back = form.querySelector("#intake-back"),
    next = form.querySelector("#intake-next"),
    submit = form.querySelector("#intake-submit");
  function show() {
    steps.forEach((s, i) => s.classList.toggle("active", i === current));
    back.disabled = current === 0;
    next.style.display = current === steps.length - 1 ? "none" : "";
    submit.style.display = current === steps.length - 1 ? "" : "none";
    form
      .querySelectorAll(".step-progress i")
      .forEach((x, i) => (x.style.width = i <= current ? "100%" : "0%"));
    steps[current].querySelector("input,textarea")?.focus();
  }
  next.addEventListener("click", () => {
    const invalid = steps[current].querySelector(":invalid");
    if (invalid) return invalid.reportValidity();
    current++;
    show();
  });
  back.addEventListener("click", () => {
    current--;
    show();
  });
  show();
  on(
    "#intake-form",
    async () => {
      const invalid = form.querySelector(":invalid");
      if (invalid) {
        current = steps.findIndex((s) => s.contains(invalid));
        show();
        return invalid.reportValidity();
      }
      const formData = new FormData(form);
      const values = Object.fromEntries(formData);
      if (!flow.childId) values.conditions = formData.getAll("conditions");
      try {
        await api(`/api/portal/flows/${flow.id}/intake`, values);
      } catch (error) {
        if (error.status === 409) return resumeFlow();
        throw error;
      }
      message(
        "Intake saved. You won’t need to fill it out for future bookings.",
      );
      flow.needsIntake = false;
      await slots();
    },
    "submit",
  );
}
async function slots() {
  render(
    `${toolbar()}<h2>Find your time.</h2><p>${escape(labels[flow.service])}${flow.childName ? " · " + escape(flow.childName) : ""}</p><p class="muted">Times shown in ${escape(timeZone.replaceAll("_", " "))}.</p><div id="slots"><p>Loading available times…</p></div><div class="portal-actions"><button class="portal-link" id="previous" ${week === 0 ? "disabled" : ""}>Previous week</button><button class="portal-link" id="next-week">Next week</button><button class="portal-link" id="back">Start over</button></div>`,
  );
  wireToolbar();
  on("#back", choosePerson);
  on("#previous", async () => {
    week = Math.max(0, week - 1);
    await slots();
  });
  on("#next-week", async () => {
    week++;
    await slots();
  });
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + week * 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  const slotContainer = screen.querySelector("#slots");
  try {
    const result = await api(
      `/api/portal/flows/${flow.id}/slots?` +
        new URLSearchParams({
          start: start.toISOString(),
          end: end.toISOString(),
          timeZone,
        }),
    );
    if (!slotContainer.isConnected) return;
    const groups = Object.entries(result.slots || {});
    slotContainer.innerHTML = groups.length
      ? groups
          .map(
            ([date, items]) =>
              `<h3>${escape(new Date(date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }))}</h3><div class="portal-slot-grid">${items
                .map((s) => {
                  const value = typeof s === "string" ? s : s.start;
                  return `<button class="portal-slot" data-start="${escape(value)}">${escape(new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }))}</button>`;
                })
                .join("")}</div>`,
          )
          .join("")
      : "<p>No times are available this week. Try the following week or contact Heidi.</p>";
    screen
      .querySelectorAll("[data-start]")
      .forEach((b) =>
        b.addEventListener("click", () => confirm(b.dataset.start)),
      );
  } catch (e) {
    if (!slotContainer.isConnected) return;
    slotContainer.textContent = "";
    throw e;
  }
}
function confirm(start) {
  render(
    `${toolbar()}<p class="eyebrow">One last step</p><h2>Your next session.</h2><p><strong>${escape(labels[flow.service])}</strong></p><p>${escape(flow.childName || me.user.name)}</p><p>${escape(new Date(start).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" }))}</p><p class="muted">Confirmation will be sent to ${escape(me.user.email)}.</p><button class="btn btn-primary" id="confirm-booking">Confirm booking</button><button class="portal-link" id="back" style="margin-left:20px">Choose another time</button>`,
  );
  wireToolbar();
  on("#back", slots);
  on("#confirm-booking", async () => {
    const result = await api(`/api/portal/flows/${flow.id}/book`, {
      start,
      timeZone,
      name: me.user.name,
    });
    history.replaceState(null, "", "/account.html");
    await dashboard();
    message(
      result.booking.status === "accepted"
        ? "Your session is booked. Check your email for the details."
        : "Your booking request is saved. Check its status below.",
    );
  });
}
async function staffList() {
  const data = await api("/api/portal/admin/intakes");
  render(
    `${toolbar()}<h2>Intake records.</h2><div class="portal-options">${data.intakes.map((x) => `<button class="portal-choice" data-intake="${escape(x.id)}" data-kind="${x.kind}"><strong>${escape(x.name)}</strong><small>${x.kind === "adult" ? "Adult" : `Child · ${escape(x.guardian_name)}`}</small></button>`).join("") || "<p>No intake submissions yet.</p>"}</div>`,
  );
  wireToolbar();
  screen.querySelectorAll("[data-intake]").forEach((b) =>
    on(`[data-intake="${b.dataset.intake}"]`, async () => {
      const data = await api(
        `/api/portal/admin/${b.dataset.kind === "adult" ? "adult-intakes" : "intakes"}/${encodeURIComponent(b.dataset.intake)}`,
      );
      render(
        `${toolbar()}<h2>Intake record.</h2><dl class="portal-record">${Object.entries(
          data.intake,
        )
          .map(
            ([k, v]) =>
              `<dt>${escape(k.replace(/([A-Z])/g, " $1"))}</dt><dd>${escape(v || "—")}</dd>`,
          )
          .join(
            "",
          )}</dl><button class="portal-link" id="back">Back to intake list</button>`,
      );
      wireToolbar();
      on("#back", staffList);
    }),
  );
}
async function load() {
  message();
  try {
    const session = await api("/api/auth/get-session");
    if (!session?.user) return signIn();
    me = await api("/api/portal/me");
    const flowId = new URLSearchParams(location.search).get("flow");
    if (flowId) {
      flow = { id: flowId };
      return await resumeFlow();
    }
    if (location.pathname.includes("account")) return await dashboard();
    choosePerson();
  } catch (e) {
    if (!me) signIn();
    else choosePerson();
    message(e.message, true);
  } finally {
    root.setAttribute("aria-busy", "false");
  }
}
load();
