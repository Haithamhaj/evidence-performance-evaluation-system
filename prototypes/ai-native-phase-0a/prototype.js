import { fixtures } from "./fixtures.js";

const params = new URLSearchParams(window.location.search);
const state = {
  locale: params.get("locale") === "ar" ? "ar" : "en",
  view: ["normal", "busy", "decision", "prepared", "agent", "clear", "stale", "recovery"].includes(
    params.get("state"),
  )
    ? params.get("state")
    : "busy",
  role: ["employee", "manager", "admin"].includes(params.get("role"))
    ? params.get("role")
    : "employee",
  sourceRefreshed: false,
  capturedTasks: [],
};

const app = document.querySelector("#app");
const statusRegion = document.querySelector("#live-status");
const draftDialog = document.querySelector("#draft-dialog");
const captureDialog = document.querySelector("#capture-dialog");

let draftTrigger = null;
let captureTrigger = null;

function copy() {
  return fixtures[state.locale];
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function announce(message) {
  statusRegion.textContent = "";
  window.requestAnimationFrame(() => {
    statusRegion.textContent = message;
  });
}

function updateUrl() {
  const next = new URL(window.location.href);
  next.searchParams.set("locale", state.locale);
  next.searchParams.set("state", state.view);
  next.searchParams.set("role", state.role);
  window.history.replaceState({}, "", next);
}

function navigationItems(t) {
  const items = [
    ["today", t.nav.today, "calendar"],
    ["work", t.nav.work, "checkbox"],
    ["projects", t.nav.projects, "folder"],
    ["research", t.nav.research, "search"],
    ["evaluation", t.nav.evaluation, "chart-bar"],
  ];

  if (state.role === "manager") items.push(["manager", t.nav.manager, "checkbox"]);
  if (state.role === "admin") items.push(["admin", t.nav.admin, "settings"]);
  return items;
}

function renderDesktopNavigation(t) {
  return navigationItems(t)
    .map(
      ([key, label, icon]) =>
        `<a class="nav-link" href="#${key}" ${key === "today" ? 'aria-current="page"' : ""}><img src="/assets/icons/${icon}.svg" alt="" />${label}</a>`,
    )
    .join("");
}

function renderBottomNavigation(t) {
  return navigationItems(t)
    .slice(0, 5)
    .map(
      ([key, label, icon]) =>
        `<a href="#${key}" ${key === "today" ? 'aria-current="page"' : ""}><img src="/assets/icons/${icon}.svg" alt="" />${label}</a>`,
    )
    .join("");
}

function renderDecision(t) {
  if (state.view === "recovery") return "";
  const stale = state.view === "stale";
  return `
    ${
      stale
        ? `<section class="system-banner" aria-labelledby="stale-title">
            <div><h2 id="stale-title">${t.staleTitle}</h2><p>${t.staleBody}</p></div>
            <button class="primary-button" data-action="refresh-source">${t.refresh}</button>
          </section>`
        : ""
    }
    <section class="section" data-tone="amber" aria-label="${t.decisionHeading}" id="decision-section">
      <h2 class="section-title">${t.decisionHeading}</h2>
      <div class="decision-card">
        <div>
          <h3 class="decision-title">${t.decisionTitle}</h3>
          <p class="decision-source">${t.decisionSource}</p>
          <div class="explanation">
            <span><b>${t.decisionWhy.split(":")[0]}:</b>${t.decisionWhy.split(":").slice(1).join(":")}</span>
            <span><b>${t.decisionFreshness.split(":")[0]}:</b>${t.decisionFreshness.split(":").slice(1).join(":")}</span>
            ${state.sourceRefreshed ? `<span>${t.sourceRefreshed}</span>` : ""}
          </div>
        </div>
        <div class="decision-actions">
          <button class="primary-button" data-action="confirm-decision" ${stale ? "disabled" : ""}>${t.confirm}</button>
          <button class="secondary-button" data-action="correct-decision">${t.correct}</button>
          <button class="secondary-button" data-action="dismiss-decision">${t.dismiss}</button>
        </div>
      </div>
    </section>`;
}

function renderPrepared(t) {
  return `
    <section class="section" aria-labelledby="prepared-heading">
      <h2 class="section-title" id="prepared-heading">${t.preparedHeading}</h2>
      <div class="prepared-row">
        <div>
          <h3 class="row-title">${t.preparedTitle}</h3>
          <p class="row-detail">${t.preparedSource}</p>
        </div>
        <button class="secondary-button" data-action="review-draft">${t.reviewDraft}</button>
      </div>
    </section>`;
}

function renderTaskRows(t) {
  const tasks = [...t.tasks, ...state.capturedTasks];
  return tasks
    .map(
      (task, index) => `
        <div class="work-row ${task.captured ? "captured-row" : ""}">
          <input class="task-check" type="checkbox" aria-label="${escapeHtml(task.title)}" />
          <div>
            <h3 class="row-title">${escapeHtml(task.title)}</h3>
            <p class="row-detail" ${index === 1 ? 'dir="auto"' : ""}>${escapeHtml(task.detail)}</p>
          </div>
          <span class="project-name">Atlas Voice Intelligence</span>
          <span class="source-name">${escapeHtml(task.source)}</span>
          <span class="due">${t.dueToday}</span>
        </div>`,
    )
    .join("");
}

function renderWork(t) {
  return `
    <section class="section" aria-labelledby="today-heading">
      <h2 class="section-title" id="today-heading">${t.todayHeading}</h2>
      <div class="work-list">${renderTaskRows(t)}</div>
    </section>
    <section class="section" data-tone="green" aria-labelledby="continue-heading">
      <h2 class="section-title" id="continue-heading">${t.continueHeading}</h2>
      <div class="continue-row">
        <div>
          <h3 class="row-title">${t.continueTitle}</h3>
          <p class="row-detail">${t.continueDetail}</p>
        </div>
        <span class="due">${state.locale === "ar" ? "متاحة الآن" : "Now unblocked"}</span>
      </div>
    </section>
    <section class="section" data-tone="green" aria-labelledby="changed-heading">
      <details class="change-disclosure" ${window.matchMedia("(min-width: 761px)").matches ? "open" : ""}>
        <summary><h2 class="section-title" id="changed-heading">${t.changedHeading}</h2></summary>
        <div class="change-row">
          <div class="change-content">
            <span class="change-time">7:42 AM</span>
            <div>
              <h3 class="row-title">${t.changedTitle}</h3>
              <p class="row-detail">${t.changedSource}</p>
              <p class="row-detail">${t.changedContext}</p>
            </div>
          </div>
        </div>
      </details>
    </section>`;
}

function renderRecovery(t) {
  return `
    <section class="system-banner" aria-labelledby="recovery-title">
      <div><h2 id="recovery-title">${t.recoveryTitle}</h2><p>${t.recoveryBody}</p></div>
      <div class="banner-actions">
        <a class="quiet-button" href="#work">${t.continueManually}</a>
        <button class="primary-button" data-action="retry-connection">${t.retry}</button>
      </div>
    </section>
    ${renderPrepared(t)}
    ${renderWork(t)}`;
}

function renderAgent(t) {
  return `
    <section class="system-banner agent-banner" aria-labelledby="agent-title">
      <div><h2 id="agent-title">${t.agentTitle}</h2><p>${t.agentBody}</p></div>
      <a class="quiet-button" href="#work">${t.continueManually}</a>
    </section>
    ${renderWork(t)}`;
}

function renderClear(t) {
  return `
    <section class="clear-panel" aria-labelledby="clear-title">
      <h2 id="clear-title">${t.clearTitle}</h2>
      <p>${t.clearBody}</p>
      <div class="clear-actions">
        <a href="#work">${t.openWork}</a>
        <button class="primary-button" data-action="open-capture">${t.addSomething}</button>
      </div>
    </section>`;
}

function renderReceipt(t, message, actionLabel) {
  return `<section class="receipt-row" data-receipt>
    <p class="row-title">${message}</p>
    <button class="secondary-button" data-action="undo-decision">${actionLabel}</button>
  </section>`;
}

function renderDynamicContent(t) {
  if (state.view === "clear") return renderClear(t);
  if (state.view === "recovery") return renderRecovery(t);
  if (state.view === "prepared") return `${renderPrepared(t)}${renderWork(t)}`;
  if (state.view === "decision") return `${renderDecision(t)}${renderWork(t)}`;
  if (state.view === "agent") return renderAgent(t);
  return `${renderDecision(t)}${renderPrepared(t)}${renderWork(t)}`;
}

function render() {
  const t = copy();
  document.documentElement.lang = state.locale;
  document.documentElement.dir = t.dir;
  updateUrl();

  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand"><span class="brand-mark" aria-hidden="true">CB</span><span>${t.brand}</span></div>
        <label class="command-search">
          <span class="sr-only">${t.search}</span>
          <img class="search-icon" src="/assets/icons/search.svg" alt="" />
          <input type="search" placeholder="${t.search}" data-command-search />
          <span class="shortcut" aria-hidden="true">/</span>
        </label>
        <span class="topbar-spacer"></span>
        <div class="topbar-actions">
          <button class="locale-button desktop-capture" data-action="open-capture"><img src="/assets/icons/plus.svg" alt="" />${t.capture}</button>
          <button class="locale-button" data-action="switch-locale">${t.locale}</button>
          <div class="preview-wrap">
            <button class="preview-button" data-action="toggle-state-menu" aria-expanded="false">${t.previewStates}</button>
            <div class="state-menu" role="menu" hidden>
              ${Object.entries(t.states)
                .map(
                  ([key, label]) =>
                    `<button role="menuitem" data-state="${key}" aria-current="${state.view === key}">${label}</button>`,
                )
                .join("")}
            </div>
          </div>
          <button class="profile-button" aria-label="Codex account">C</button>
        </div>
      </header>
      <aside class="sidebar">
        <nav aria-label="${t.navLabel}">${renderDesktopNavigation(t)}</nav>
        <div class="sidebar-footer">
          <a class="nav-link" href="#settings"><img src="/assets/icons/settings.svg" alt="" />${t.nav.settings}</a>
          <a class="nav-link" href="#help"><img src="/assets/icons/help-circle.svg" alt="" />${t.nav.help}</a>
        </div>
      </aside>
      <main class="main" id="main-content">
        <div class="main-inner">
          <header class="page-heading"><p class="date-line">${t.date}</p><h1>${t.greeting}</h1></header>
          <div data-dynamic-content>${renderDynamicContent(t)}</div>
          <p class="footer-truth">${t.footer}</p>
        </div>
      </main>
      <button class="mobile-add" data-action="open-capture" aria-label="${t.capture}"><img src="/assets/icons/plus.svg" alt="" /><span>${t.capture}</span></button>
      <nav class="bottom-nav" aria-label="${t.navLabel}">${renderBottomNavigation(t)}</nav>
    </div>`;

  bindInteractions();
}

function openDraft(trigger) {
  const t = copy();
  draftTrigger = trigger;
  document.querySelector("#draft-dialog-kicker").textContent = t.preparedHeading;
  document.querySelector("#draft-dialog-title").textContent = t.preparedTitle;
  document.querySelector("#draft-dialog-note").textContent = t.draftNote;
  document.querySelector("#draft-update").value = t.draftBody;
  document.querySelector("#draft-dialog-source").textContent = t.draftSource;
  draftDialog.querySelector('[data-action="confirm-draft"]').textContent =
    state.locale === "ar" ? "تأكيد التحديث" : "Confirm update";
  draftDialog.showModal();
  document.querySelector("#draft-update").focus();
}

function openCapture(trigger) {
  const t = copy();
  captureTrigger = trigger;
  document.querySelector("#capture-dialog-kicker").textContent =
    state.locale === "ar" ? "تسجيل سريع" : "Universal capture";
  document.querySelector("#capture-dialog-title").textContent =
    state.locale === "ar" ? "إضافة عمل" : "Capture work";
  document.querySelector("#capture-privacy-note").textContent = t.capturePrivacy;
  document.querySelector("#capture-input").value = "";
  captureDialog.showModal();
  document.querySelector("#capture-input").focus();
}

function bindInteractions() {
  const t = copy();
  app.querySelector('[data-action="switch-locale"]')?.addEventListener("click", () => {
    state.locale = state.locale === "en" ? "ar" : "en";
    render();
  });

  app.querySelector('[data-action="toggle-state-menu"]')?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    const menu = app.querySelector(".state-menu");
    const willOpen = menu.hidden;
    menu.hidden = !willOpen;
    button.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) menu.querySelector('[role="menuitem"]')?.focus();
  });

  app.querySelectorAll("[data-state]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.state;
      state.sourceRefreshed = false;
      render();
      app.querySelector('[data-action="toggle-state-menu"]')?.focus();
    });
  });

  app.querySelector('[data-action="confirm-decision"]')?.addEventListener("click", () => {
    app.querySelector("#decision-section")?.remove();
    app
      .querySelector("[data-dynamic-content]")
      .insertAdjacentHTML(
        "afterbegin",
        renderReceipt(t, t.confirmationReceipt, t.undoConfirmation),
      );
    const undo = app.querySelector('[data-action="undo-decision"]');
    undo.addEventListener("click", () => {
      render();
      app.querySelector('[data-action="confirm-decision"]')?.focus();
    });
    announce(state.locale === "ar" ? "تم تأكيد الربط" : "Link confirmed");
    undo.focus();
  });

  app.querySelector('[data-action="dismiss-decision"]')?.addEventListener("click", () => {
    app.querySelector("#decision-section")?.remove();
    announce(state.locale === "ar" ? "تم تجاهل الاقتراح" : "Proposal dismissed");
  });

  app.querySelector('[data-action="correct-decision"]')?.addEventListener("click", () => {
    announce(
      state.locale === "ar"
        ? "يمكنك اختيار مشروع آخر من البحث"
        : "Choose another Project from search",
    );
    app.querySelector("[data-command-search]")?.focus();
  });

  app.querySelector('[data-action="refresh-source"]')?.addEventListener("click", () => {
    state.view = "busy";
    state.sourceRefreshed = true;
    render();
    app.querySelector('[data-action="confirm-decision"]')?.focus();
  });

  app.querySelector('[data-action="retry-connection"]')?.addEventListener("click", () => {
    state.view = "busy";
    render();
    announce(state.locale === "ar" ? "تمت استعادة الاتصال" : "Connection restored");
    app.querySelector("[data-command-search]")?.focus();
  });

  app.querySelector('[data-action="review-draft"]')?.addEventListener("click", (event) => {
    openDraft(event.currentTarget);
  });

  app.querySelectorAll('[data-action="open-capture"]').forEach((button) => {
    button.addEventListener("click", (event) => openCapture(event.currentTarget));
  });
}

draftDialog.addEventListener("close", () => draftTrigger?.focus());
captureDialog.addEventListener("close", () => captureTrigger?.focus());

draftDialog.querySelector('[data-action="confirm-draft"]').addEventListener("click", (event) => {
  event.preventDefault();
  draftDialog.close();
  announce(state.locale === "ar" ? "تم تأكيد التحديث" : "Update confirmed");
});

captureDialog.querySelectorAll(".capture-type").forEach((button) => {
  button.addEventListener("click", () => {
    captureDialog.querySelectorAll(".capture-type").forEach((candidate) => {
      const selected = candidate === button;
      candidate.classList.toggle("is-selected", selected);
      candidate.setAttribute("aria-pressed", String(selected));
    });
  });
});

captureDialog.querySelector('[data-action="save-capture"]').addEventListener("click", (event) => {
  event.preventDefault();
  const input = document.querySelector("#capture-input");
  const value = input.value.trim();
  if (!value) {
    input.setCustomValidity(state.locale === "ar" ? "أدخل ما تريد تسجيله" : "Add something first");
    input.reportValidity();
    return;
  }
  input.setCustomValidity("");
  state.capturedTasks.push({
    title: value,
    detail:
      state.locale === "ar"
        ? "مسودة خاصة بانتظار تأكيدك."
        : "Private draft awaiting your confirmation.",
    source: state.locale === "ar" ? "يدوي" : "Manual",
    captured: true,
  });
  captureDialog.close();
  render();
  announce(state.locale === "ar" ? "تم حفظ مسودة مهمة خاصة" : "Private Task draft saved");
  app.querySelectorAll(".captured-row").at(-1)?.scrollIntoView({ block: "center" });
});

window.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    app.querySelector("[data-command-search]")?.focus();
  }
});

document.documentElement.dataset.motion = window.matchMedia("(prefers-reduced-motion: reduce)")
  .matches
  ? "reduced"
  : "full";

render();
window.__phase0aReady = true;
