# Current Bilingual System Map Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the outdated English-only system map with a self-contained bilingual journey-first reference that accurately explains the current product, architecture, authority boundaries, and delivery state.

**Architecture:** Keep one dependency-free semantic HTML document. English remains the no-JavaScript fallback; a small inline controller switches every translated label to Arabic, applies RTL, and stores the session preference. Content is sourced from approved repository documents and separates the merged engine baseline, the active frontend branch, and external or human gates.

**Tech Stack:** Semantic HTML5, CSS custom properties and responsive grid/flex layouts, inline vanilla JavaScript, repository documentation, browser verification with Playwright.

## Global Constraints

- Modify documentation artifacts only; do not change production UI, API, database, permissions, or product behavior.
- Do not change or weaken any protected product rule in `AGENTS.md`.
- English and Arabic visible meanings must be equivalent; Arabic must use RTL and English LTR.
- English must remain readable with JavaScript disabled.
- Introduce no external font, script, image, tracker, dependency, copied brand asset, or live API call.
- Project progress must be described only as Progress Contract output; Task, Update, GitHub, commit, file, and line volume cannot calculate it.
- AI must never assign, predict, or recommend a rating, rank employees, calculate productivity scores, or bypass human gates.
- Label local Codex dogfood and open Pull Request status as current snapshots, not permanent product guarantees.

---

### Task 1: Replace the outdated shell with a bilingual accessible map foundation

**Files:**
- Modify: `project-state/SYSTEM_MAP.html`

**Interfaces:**
- Consumes: the approved design in `docs/superpowers/specs/2026-08-16-current-system-map-refresh-design.md`.
- Produces: one semantic document with `data-en` and `data-ar` copy pairs, `setLanguage(locale)` behavior, stable section IDs, responsive layout primitives, reduced-motion behavior, and print styles.

- [ ] **Step 1: Record the old map baseline**

Run:

```bash
wc -l project-state/SYSTEM_MAP.html
rg -n '<section|<h2|id="' project-state/SYSTEM_MAP.html
```

Expected: the old map exposes its existing ten-section English-only structure so replacement is intentional rather than accidental deletion.

- [ ] **Step 2: Write the bilingual semantic shell**

Replace the old page shell with:

```html
<html lang="en" dir="ltr">
  <body>
    <header id="top">
      <h1 data-en="Evidence-supported work and evaluation system" data-ar="نظام العمل والتقييم المدعوم بالأدلة">Evidence-supported work and evaluation system</h1>
    </header>
    <nav aria-label="System map sections">
      <a href="#overview" data-en="Overview" data-ar="نظرة عامة">Overview</a>
      <a href="#employee-journey" data-en="Employee" data-ar="الموظف">Employee</a>
      <a href="#manager-journey" data-en="Manager" data-ar="المدير">Manager</a>
      <a href="#capabilities" data-en="Capabilities" data-ar="القدرات">Capabilities</a>
      <a href="#source-lifecycle" data-en="Sources" data-ar="المصادر">Sources</a>
      <a href="#progress" data-en="Progress" data-ar="التقدم">Progress</a>
      <a href="#evaluation" data-en="Evaluation" data-ar="التقييم">Evaluation</a>
      <a href="#ai" data-en="AI" data-ar="الذكاء الاصطناعي">AI</a>
      <a href="#architecture" data-en="Architecture" data-ar="البنية">Architecture</a>
      <a href="#authority" data-en="Authority" data-ar="الصلاحيات">Authority</a>
      <a href="#delivery" data-en="Delivery" data-ar="التنفيذ">Delivery</a>
    </nav>
    <main>
      <section id="overview" aria-labelledby="overview-title"><h2 id="overview-title" data-en="System overview" data-ar="نظرة عامة على النظام">System overview</h2></section>
      <section id="employee-journey" aria-labelledby="employee-title"><h2 id="employee-title" data-en="Employee daily journey" data-ar="رحلة الموظف اليومية">Employee daily journey</h2></section>
      <section id="manager-journey" aria-labelledby="manager-title"><h2 id="manager-title" data-en="Manager journey" data-ar="رحلة المدير">Manager journey</h2></section>
      <section id="capabilities" aria-labelledby="capabilities-title"><h2 id="capabilities-title" data-en="Current capabilities" data-ar="القدرات الحالية">Current capabilities</h2></section>
      <section id="source-lifecycle" aria-labelledby="sources-title"><h2 id="sources-title" data-en="Source lifecycle" data-ar="دورة حياة المصادر">Source lifecycle</h2></section>
      <section id="progress" aria-labelledby="progress-title"><h2 id="progress-title" data-en="Project progress" data-ar="تقدم المشروع">Project progress</h2></section>
      <section id="evaluation" aria-labelledby="evaluation-title"><h2 id="evaluation-title" data-en="Human-decided evaluation" data-ar="التقييم بقرار بشري">Human-decided evaluation</h2></section>
      <section id="ai" aria-labelledby="ai-title"><h2 id="ai-title" data-en="AI boundaries" data-ar="حدود الذكاء الاصطناعي">AI boundaries</h2></section>
      <section id="architecture" aria-labelledby="architecture-title"><h2 id="architecture-title" data-en="Technical architecture" data-ar="البنية التقنية">Technical architecture</h2></section>
      <section id="authority" aria-labelledby="authority-title"><h2 id="authority-title" data-en="Authority and privacy" data-ar="الصلاحيات والخصوصية">Authority and privacy</h2></section>
      <section id="delivery" aria-labelledby="delivery-title"><h2 id="delivery-title" data-en="Delivery state" data-ar="حالة التنفيذ">Delivery state</h2></section>
    </main>
  </body>
</html>
```

Every translated plain-text element uses equivalent pairs:

```html
<span data-en="Employee daily journey" data-ar="رحلة الموظف اليومية">
  Employee daily journey
</span>
```

The language controller must use `textContent`, not `innerHTML`:

```js
function setLanguage(locale) {
  const next = locale === "ar" ? "ar" : "en";
  document.documentElement.lang = next;
  document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
  document.querySelectorAll("[data-en][data-ar]").forEach((element) => {
    element.textContent = element.dataset[next];
  });
  sessionStorage.setItem("system-map-locale", next);
}
```

- [ ] **Step 3: Add responsive and accessibility behavior**

Implement visible focus, semantic status text, isolated table overflow, print rules, and reduced motion:

```css
:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
.table-wrap { overflow-x: auto; }
@media (max-width: 720px) { .journey-grid, .architecture-grid { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; } }
@media print { nav, .language-switch { display: none; } section { break-inside: avoid; } }
```

- [ ] **Step 4: Run the static bilingual shell check**

Run:

```bash
node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const html = readFileSync("project-state/SYSTEM_MAP.html", "utf8");
  const en = (html.match(/data-en=/g) ?? []).length;
  const ar = (html.match(/data-ar=/g) ?? []).length;
  if (en < 25 || en !== ar) throw new Error(`translation mismatch en=${en} ar=${ar}`);
  for (const id of ["overview","employee-journey","manager-journey","capabilities","source-lifecycle","progress","evaluation","ai","architecture","authority","delivery"]) {
    if (!html.includes(`id="${id}"`)) throw new Error(`missing ${id}`);
  }
  console.log(`Bilingual shell OK: ${en} pairs`);
'
```

Expected: `Bilingual shell OK` and equal English/Arabic counts.

- [ ] **Step 5: Commit the foundation**

```bash
git add project-state/SYSTEM_MAP.html
git commit -m "docs: rebuild bilingual system map foundation"
```

---

### Task 2: Populate the current journeys, architecture, and protected boundaries

**Files:**
- Modify: `project-state/SYSTEM_MAP.html`

**Interfaces:**
- Consumes: the section IDs and translation convention from Task 1; approved facts from `PROJECT_STATE.md`, engine capability artifacts, final employee-experience design, and GPT-5.6 routing decision.
- Produces: the complete reviewer-facing current product story, exact source lifecycles, authority matrix, architecture map, and delivery snapshot.

- [ ] **Step 1: Add the employee and manager journeys**

Populate compact connected steps that explicitly show:

```text
Employee: Home → Work → Project → Capture → Review & confirm → Evidence → Evaluation
Manager: Operational queues → Project oversight → Human assessment → Coaching → Continuity
```

Home is a multi-Project overview; Work prioritizes Needs My Action, Today, and Overdue; Project contains Overview, Plan, Work, Progress, Timeline, Documents, Criteria, Evidence, Research, and Assistant. Manager queues must never expose employee ranking, productivity scores, individual readiness percentages, or private connected-work context.

- [ ] **Step 2: Add source-to-record and Project-progress lifecycles**

Render these exact conceptual flows:

```text
GitHub / Google / text / voice / URL / image / code / file
→ owner-private or suggested context
→ AI-organized draft
→ focused clarification
→ employee edit/reject/defer/confirm
→ accepted Update or Evidence
→ append-only meaningful Timeline
```

```text
Approved Project Document
→ AI-prepared Progress Contract proposal
→ authorized human revision and activation
→ approved milestone/KPI measurement or authorized confirmation
→ append-only Progress Snapshot
→ Project indicator
```

Add a visible prohibition: Task completion, update frequency, GitHub activity, commits, files, and lines changed never calculate Project progress and never become employee performance.

- [ ] **Step 3: Add the fact-first evaluation and AI boundaries**

Show:

```text
Source-supported facts → employee interpretation/self-assessment
→ independent manager assessment → comparison/discussion
→ manager final human decision → employee acknowledgment or reservation
→ immutable cycle snapshot/export
```

Describe GPT-5.6 routing only through the AI Router:

```text
Luna: frequent bounded preparation
Terra: daily Capture, Update, and Task assistance
Sol: complex Progress Contract and Research analysis
```

All routes require governed prompts, validated structured output, source references, route trace, safe fallback, and the applicable human gate.

- [ ] **Step 4: Add architecture, roles, privacy, and delivery state**

Render the modular monolith and public module interfaces around:

```text
Next.js web → NestJS API/domain modules → PostgreSQL authority
                                  ↘ Redis/BullMQ workers
                                  ↘ MinIO private objects + scan gate
Keycloak/OIDC → authenticated principal → server authorization → audit
External sources → bounded connectors → private/suggested context
Feature modules → AI Router → governed provider route
```

State delivery accurately:

```text
main: merged engine baseline
codex/ai-native-frontend-phase-1: current Command Brief surfaces and local Codex dogfood
PR #30 → Phase 0B; PR #29 → main; both open drafts at the snapshot date
External/human gates: merge decision, retained-route retirement, deployment monitoring/privacy approvals, Arabic evaluation release
```

- [ ] **Step 5: Run protected-copy and source checks**

Run:

```bash
rg -n "AI does not|human decision|Progress Contract|GitHub|Google|Luna|Terra|Sol|identified|RTL|codex/ai-native-frontend-phase-1|PR #30|PR #29" project-state/SYSTEM_MAP.html
rg -n "employee ranking|productivity score|Task completion|activity volume|readiness percentage" project-state/SYSTEM_MAP.html
git diff --check
```

Expected: every required concept is visible, forbidden transformations appear only as explicit prohibitions, and the diff has no whitespace errors.

- [ ] **Step 6: Commit complete content**

```bash
git add project-state/SYSTEM_MAP.html
git commit -m "docs: map current product journeys and boundaries"
```

---

### Task 3: Verify the bilingual artifact visually and publish the checkpoint

**Files:**
- Modify if verification finds a defect: `project-state/SYSTEM_MAP.html`
- Reference only: `project-state/PROJECT_STATE.md`

**Interfaces:**
- Consumes: the completed static map from Tasks 1–2.
- Produces: a visually verified English/Arabic desktop/mobile artifact and a pushed branch checkpoint.

- [ ] **Step 1: Start a documentation-only preview**

Run:

```bash
python3 -m http.server 4317 --directory project-state
```

Expected: `http://127.0.0.1:4317/SYSTEM_MAP.html` serves the self-contained artifact without accessing application APIs.

- [ ] **Step 2: Verify English desktop and Arabic mobile**

Use Playwright to inspect:

```text
Desktop: 1440 × 1000, English, all navigation targets, no page-level horizontal overflow.
Mobile: 390 × 844, Arabic, RTL, language switch, compact journeys, isolated table overflow.
```

Verify keyboard activation for both language buttons and at least one sticky-navigation link. Verify the document title and direction update after switching languages.

- [ ] **Step 3: Verify reduced motion, no external dependencies, and print readability**

Confirm:

```text
prefers-reduced-motion removes nonessential transitions;
the network log contains only SYSTEM_MAP.html and its browser-internal resources;
print preview hides sticky navigation and language controls;
English content remains present when JavaScript is disabled.
```

- [ ] **Step 4: Run final repository checks**

Run:

```bash
git diff --check
git status --short
git diff --name-only HEAD~2..HEAD
```

Expected: only the approved design, plan, and `project-state/SYSTEM_MAP.html` documentation artifacts changed in this workstream.

- [ ] **Step 5: Commit any verification correction and push**

If verification required a correction:

```bash
git add project-state/SYSTEM_MAP.html
git commit -m "docs: polish bilingual system map verification"
```

Then publish the current branch:

```bash
git push origin codex/ai-native-frontend-phase-1
```

Expected: the remote Phase 1 branch contains the refreshed map; no merge into `main` is performed.
