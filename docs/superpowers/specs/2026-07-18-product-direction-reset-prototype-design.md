# Product Direction Reset Prototype Design

> **PROTOTYPE HISTORY — NOT THE PRODUCTION PHASE 2 DESIGN**
>
> This design governed the isolated acceptance prototype. The approved production design is `docs/superpowers/specs/2026-07-18-phase-2-daily-work-progress-design.md`.

**Status:** Implemented acceptance prototype; retained for history
**Scope:** Clickable UX and workflow acceptance prototype only  
**Supersedes:** `2026-07-18-phase-2-updates-evidence-readiness-design.md` for current execution  
**Research basis:** `docs/research/OPEN_SOURCE_REUSE_ASSESSMENT.md` and `docs/research/OPEN_SOURCE_REUSE_DECISION.md`

## 1. Outcome

Build a realistic, responsive prototype that lets the product owner experience the daily operating chain:

> Work Item → Project → optional Workstream → Update → Evidence → GitHub suggestion → criteria → Evaluation Fact View → periodic human evaluation.

The prototype demonstrates the employee and manager workflows without creating production Work Item storage, migrations, APIs, queues, authentication, or AI calls. The current Phase 1 backend remains authoritative and unchanged.

## 2. Approved boundaries

- Implement original React/Next.js code. External products are interaction references only.
- Do not copy candidate source, translations, assets, branding, screenshots, schemas, authentication, backend, or sync logic.
- Do not resume T030–T044.
- Do not merge Phase 1.
- Do not call a paid AI model. Text and voice structuring use deterministic mock results.
- Do not expose, print, move, or commit an API credential.
- Do not calculate employee scores, rankings, predicted ratings, suggested ratings, or productivity measures.
- Do not present task volume, completion percentage, update frequency, GitHub volume, or Documentation Readiness as performance.
- Keep T016 Arabic rubric activation deferred and protected.

## 3. Isolation architecture

Create a separate private workspace package at `apps/product-reset-prototype`.

The package:

- runs on port `3100`;
- contains no import from production domain packages other than shared typography assets when useful;
- contains a visibly labelled synthetic-data banner;
- stores interactive state only in an in-memory React store for the current browser session;
- makes no production API call;
- has no database, queue, secret, upload, or AI dependency;
- uses a deterministic mock adapter for structured text and voice results;
- has its own focused component tests and Playwright configuration.

The prototype app is deliberately separate from `apps/web` so its routes and mock behavior cannot be mistaken for the Phase 1 interface or production storage.

## 4. Information architecture

### 4.1 Employee navigation

The Arabic default navigation is:

1. `عملي / My Work`
2. `صندوق الوارد / Inbox`
3. `المشاريع / Projects`
4. `الأدلة / Evidence`
5. `الجاهزية / Readiness`

`My Work` is the default post-login screen.

### 4.2 Manager navigation

The manager persona sees:

1. `نظرة تشغيلية / Operations`
2. `المشاريع / Projects`
3. `الإجراءات / Actions`
4. `جاهزية الفريق / Team Readiness`
5. `التقييمات / Evaluations`

The dashboard is operational only. It excludes employee ranking, productivity scores, individual readiness percentages, commit leaderboards, task-completion leaderboards, and predicted ratings.

### 4.3 Persistent shell

Desktop uses a compact sidebar, a narrow utility header, and a dense content canvas. Mobile uses a compact header and bottom navigation. The shell always exposes:

- employee/manager persona switch;
- Arabic/English switch;
- synthetic-prototype label;
- keyboard-visible primary navigation;
- quick-add action.

## 5. Visual direction

The visual language is original and intentionally distinct from the Phase 1 interface and the referenced products.

- Warm neutral canvas with white working surfaces.
- Deep ink navigation with a restrained teal accent.
- Compact rows and tables for repeated work, not oversized cards.
- Small status badges with text and icon shape; color is never the only signal.
- Strong typographic hierarchy using the repository’s local Inter and Noto Sans Arabic fonts.
- Logical CSS properties for RTL/LTR.
- Drawers and side panels for focused details.
- `prefers-reduced-motion` disables nonessential transitions.
- Minimum interactive target size is 44 CSS pixels on touch layouts.
- Focus rings remain visible in both directions.

## 6. Shared mock domain

One mock data module defines:

- two Projects;
- five Workstreams;
- twenty Work Items;
- employee and manager personas;
- text and voice update drafts;
- activity events;
- GitHub PR, commit, check, and test suggestions;
- files, links, screenshots, and architecture evidence;
- operational KPIs;
- project and workstream dynamic criteria;
- Thursday check-in state;
- monthly readiness gaps;
- Evaluation Fact View records.

Every Work Item has one required Project and zero or one Workstream. All List, Board, Calendar, and Timeline views read the same Work Item collection and share one filter state.

## 7. Screen behavior

### 7.1 My Work

Group the same Work Item records into:

- Needs My Action;
- Overdue;
- Today;
- This Week;
- Waiting / Blocked;
- Reviews and criteria responses;
- No Due Date;
- Recent Activity.

Rows show only title, Project, optional Workstream, employee role, status, priority, due date, blocker, and next action. Quick Add and Quick Update open focused dialogs.

### 7.2 Inbox

Separate actionable items from informational activity. Items can be opened, resolved, converted to a mock Work Item when appropriate, or linked to an existing Work Item.

### 7.3 Projects and Workstreams

Project list rows show name, employee role, health, target date, latest update, open Work Items, next action, and important blocker.

Project detail tabs are:

1. Overview
2. Work
3. Updates
4. Evidence
5. Document
6. Criteria
7. People and Responsibility

The Work tab switches List, Board, Calendar, and Timeline without duplicating state.

Workstream detail shows purpose, parent Project, owner/contributors, health, target output, KPIs, Work Items, updates, evidence, document, dynamic criteria, and responsibility history.

### 7.4 Work Item side panel

The panel opens from My Work, Project, Workstream, Inbox, and Timeline. A `workItem` query parameter makes it URL-addressable.

It includes all approved fields, updates, comments, evidence, GitHub links, contribution context, and status/assignment history. Escape closes it, focus moves into it, focus returns to the opener, and the background is unavailable to assistive technology while open.

Initial statuses are exactly:

- Planned
- Ready
- In Progress
- Blocked
- In Review
- Done
- Cancelled

No sprint, story-point, time-tracking, workload-score, or workflow-builder concept appears.

### 7.5 Text and voice update flows

Text flow:

> raw text → deterministic structured draft → employee edits → employee confirmation → Activity Timeline.

If context is missing, the mock asks one clarification question at a time.

Voice flow:

> record/upload choice → simulated raw transcript → editable transcript → transcript confirmation → deterministic structured draft → final confirmation → Timeline and Evidence.

The UI explains which source and revision records a future production implementation retains. It never claims that prototype audio or AI output was persisted.

### 7.6 Timeline and evidence

The chronological timeline visually distinguishes:

- original employee input;
- AI-structured summary;
- verified fact;
- employee interpretation;
- suggested evidence;
- confirmed evidence.

GitHub suggestions never become contribution or performance automatically. The mock employee can contextualize, link, merge, mark team or partial contribution, reassign, reject/ignore, and select Manual, AI-Assisted, Agent-Generated, or Mixed execution.

### 7.7 Evaluation Readiness

The preview combines responsibility window, employee claim, supported facts, unclear parts, result, evidence, verification, attribution, and related criteria. It contains no recommended rating.

## 8. Localization and accessibility

- Arabic is the default prototype locale; English is complete.
- Locale changes preserve the current screen, persona, selected tab, filters, and open Work Item.
- Root `lang` and `dir` change together.
- Mixed Arabic/English technical strings use isolation and LTR treatment only for the technical fragment.
- Keyboard paths cover navigation, dialogs, side panel, persona switch, view tabs, and primary mock actions.
- All icon-only controls have accessible names.
- Status, health, verification, and evidence states include text.
- Desktop, tablet, and 390px mobile layouts must not overflow horizontally.

Arabic terminology is original to this product and does not activate or reproduce the protected Arabic evaluation rubric.

## 9. Verification and review

Run only:

- prototype lint;
- prototype typecheck;
- focused component tests;
- accessibility smoke assertions;
- Playwright navigation and interaction checks;
- Arabic/English screenshots;
- desktop/mobile screenshots.

Perform one self-review followed by one focused UX/spec review. Confirm only P0/P1 acceptance or protected-rule issues block delivery. Record lower-priority polish without opening a remediation loop.

## 10. Delivery

Deliver:

- the runnable prototype and exact local URL;
- employee/manager persona switch;
- all approved screens and mock interactions;
- Arabic/English desktop and mobile screenshots;
- `PHASE_2_DAILY_WORK_EXPERIENCE.md`;
- `PHASE_2_BACKEND_DELTA.md`;
- `PHASE_2_VERTICAL_SLICES.md`;
- `PHASE_2_INTERACTION_REFERENCE_REGISTER.md`;
- a committed and pushed checkpoint.

Then stop for the product-owner gate:

> Approve product direction / Request modifications.
