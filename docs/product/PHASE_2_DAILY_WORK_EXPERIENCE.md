# Phase 2 Daily Work Experience

> **PROTOTYPE ACCEPTANCE HISTORY**
>
> This document describes the accepted Product Reset prototype. Production behavior is governed by `docs/superpowers/specs/2026-07-18-phase-2-daily-work-progress-design.md` and `docs/product/PHASE_2_FEATURE_MAP.md`. In production, official Project/Workstream progress comes only from a versioned human-approved Progress Contract; it never comes from completed Work Item count. AI clarification continues for as many turns as required, manual evidence is available inside the update flow, and mobile evidence review opens as a visible sheet.

**Status:** Product-direction acceptance prototype history
**Prototype:** `apps/product-reset-prototype`
**Data:** Synthetic, in-memory, and reset when the browser reloads
**Production impact:** None

## Decision to review

Make `My Work / عملي` the employee’s default daily home. The experience connects routine work to evidence-supported periodic evaluation without turning routine activity into a performance score.

The operating chain is:

> Work Item → required Project → optional Workstream → Update → Evidence → GitHub suggestion → dynamic criteria → Evaluation Fact View → human evaluation.

Every screen preserves the following boundary: work volume, completion, update frequency, GitHub volume, operational KPIs, and Documentation Readiness may support work and documentation decisions, but do not calculate employee performance.

## Employee experience

### My Work

The default page answers “what needs my attention now?” with one shared set of Work Items grouped into:

- Needs My Action
- Overdue
- Today
- This Week
- Waiting / Blocked
- Reviews and Criteria Responses
- No Due Date
- Recent Activity

The header includes Quick Add, Quick Update, employee/manager persona switching, and Arabic/English switching. An operational summary shows open work and attention signals with an explicit notice that they are not performance measures.

The List, Board, Calendar, and Timeline controls project the same Work Item identities. They do not create separate copies or separate workflow semantics.

### Inbox

The Inbox separates required actions from informational activity. The prototype supports opening related work, resolving an action, and moving from a GitHub suggestion to the evidence review flow. Production conversion/linking rules remain a backend delta and are not silently implemented in the mock.

### Projects and Workstreams

The project list exposes purpose, health, target date, work completion, Workstream count, and next action. Completion is labelled as delivery progress, not employee performance.

Project detail provides:

- Overview
- Work
- Workstreams
- Updates
- Activity
- Documents
- Criteria
- Settings

The Work tab shares List, Board, Calendar, and Timeline state. Workstream detail shows purpose, owner, contributors, target output, dynamic criteria, Work Items, and the active responsibility window.

### Work Item side panel

A Work Item opens in a side panel without losing the parent context. The panel includes:

- stable Work Item identity;
- required Project and optional Workstream;
- role, assignee, status, priority, and due date;
- blocker and next action;
- acceptance criteria;
- linked evidence;
- activity and responsibility history.

The selected identity is carried in the `workItem` URL query parameter. Escape closes the panel, focus moves to the close control, and mobile presents the panel at almost full viewport width.

### Text and voice updates

Quick Update offers text or voice.

The text flow is:

> Raw input → deterministic structuring → one clarification when a result is missing → employee review → employee confirmation → session Activity Timeline.

The voice flow is:

> Simulated recording → editable raw transcript → deterministic structuring → employee review → employee confirmation → session Activity Timeline.

The prototype clearly states that the “AI assistance” is deterministic local logic. It makes no provider call, reads no key, and produces no rating, ranking, productivity score, or readiness score.

### Evidence and GitHub suggestions

GitHub PRs, commits, checks, and tests begin as suggestions. The employee must:

1. review the source;
2. link it to a Work Item;
3. select Manual, AI-Assisted, Agent-Generated, or Mixed execution;
4. describe their contribution context;
5. confirm or reject it.

Change size, commit count, file count, and lines changed are deliberately absent as performance inputs.

### Evaluation Readiness Fact View

The preview separates:

- source-supported facts;
- unclear or unverified parts;
- the employee’s interpretation;
- recorded result;
- evidence references;
- responsibility window;
- verification state.

It contains no suggested rating. The final rating remains a manager decision.

## Lifecycle summary

### Work Item lifecycle

The prototype uses only Planned → Ready → In Progress → Blocked/In Review → Done, with Cancelled available as a terminal alternative. A production transition must append status and assignment history; it must not overwrite historical responsibility.

### Update lifecycle

Draft source → optional clarification → structured draft → employee edit → employee confirmation → accepted Activity event. Voice inserts original audio → raw transcript → employee-corrected transcript before structuring.

### Evidence lifecycle

Source captured → suggested/reviewable → Work Item/update/criterion links → execution and contribution context → employee confirmation, rejection, or ignore → immutable activity/history.

### GitHub lifecycle

Webhook/reconciliation source → idempotent suggestion → employee review → link/merge/reassign and team/partial attribution → confirm as evidence or reject/ignore. It never becomes contribution or performance automatically.

### Evaluation linkage

Accepted Work Items, updates, responsibility windows, criteria active at the time, and confirmed evidence can supply source references to a period Fact View. Source facts remain distinct from employee interpretation. The manager then makes an independent final human rating decision.

## Manager experience

The manager persona defaults to an operational overview with:

- actions requiring follow-up;
- Project and Workstream health;
- open blockers;
- a coarse Documentation Readiness view.

Counts are explicitly operational. There is no employee leaderboard, productivity score, predicted rating, task-completion ranking, or GitHub ranking.

The readiness component uses only coarse labels such as “record ready for review” and “needs documentation follow-up.” It does not expose an individual readiness percentage, value, or rank, and the prototype states that individual readiness detail is excluded from rating-decision screens.

## Localization and responsive behavior

- Arabic is the default and sets `lang="ar"` and `dir="rtl"`.
- English sets `lang="en"` and `dir="ltr"`.
- The same route and persona remain available in both languages.
- Local Inter and Noto Sans Arabic fonts are used.
- CSS logical properties support RTL/LTR.
- Desktop uses a fixed sidebar; mobile uses bottom navigation.
- Interactive states have text labels in addition to color.
- Focus rings are visible and reduced-motion preferences disable nonessential animation.

### Core terminology

| Concept                 | Arabic            | English                 |
| ----------------------- | ----------------- | ----------------------- |
| Employee home           | عملي              | My Work                 |
| Work Item               | عنصر عمل          | Work Item               |
| Project                 | مشروع             | Project                 |
| Workstream              | مسار العمل        | Workstream              |
| Update                  | تحديث             | Update                  |
| Evidence                | دليل / الأدلة     | Evidence                |
| Suggested evidence      | دليل مقترح        | Suggested evidence      |
| Contribution context    | سياق المساهمة     | Contribution context    |
| Responsibility window   | فترة المسؤولية    | Responsibility window   |
| Evaluation Fact View    | عرض حقائق التقييم | Evaluation Fact View    |
| Documentation Readiness | جاهزية التوثيق    | Documentation Readiness |

These are original product terms and do not import or activate the protected T016 Arabic evaluation rubric.

## Prototype routes

| Experience            | Arabic                        | English                       |
| --------------------- | ----------------------------- | ----------------------------- |
| My Work               | `/ar`                         | `/en`                         |
| Inbox                 | `/ar/inbox`                   | `/en/inbox`                   |
| Projects              | `/ar/projects`                | `/en/projects`                |
| Evidence              | `/ar/evidence`                | `/en/evidence`                |
| Readiness             | `/ar/readiness`               | `/en/readiness`               |
| Manager               | `/ar/manager?persona=manager` | `/en/manager?persona=manager` |
| Addressable Work Item | `/ar?workItem=wi-105`         | `/en?workItem=wi-105`         |

## Acceptance walkthrough

1. Open Arabic My Work and inspect the daily grouping.
2. Switch List → Board → Calendar → Timeline.
3. Open a Work Item and confirm the URL query, details, evidence, and activity.
4. Use Quick Add to add a session-only Work Item.
5. Use Quick Update, select text, enter an activity without a result, and observe one clarification.
6. Add a result, review the deterministic structure, and confirm it.
7. Open Evidence, select a GitHub suggestion, add contribution context, choose execution mode, and confirm.
8. Open Readiness and compare source-supported facts with employee interpretation.
9. Switch to Manager and verify the absence of rankings, scores, and individual readiness percentages.
10. Switch to English, then repeat on a 390px mobile viewport.

## Known prototype limitations

- No login is required; personas are a UI switch over synthetic data.
- State is in-memory and resets on reload.
- There is no production API, database, queue, upload, GitHub App, audio recording, or paid AI call.
- Quick voice uses a simulated transcript.
- Project secondary tabs contain representative preview content rather than production mutations.
- Inbox convert/link behavior is represented by navigation and session actions, not a production lifecycle.
- Focus enters dialogs and the Work Item panel and Escape closes the panel; a production implementation still needs a complete focus trap and focus-return utility.
- Production authorization, audit, append-only history, and immutable snapshots remain owned by the existing Phase 1 backend and the documented backend delta.

## Focused UX/spec review

**Disposition:** Ready for the product-direction gate. No unresolved P0/P1 acceptance, privacy, protected-rule, or functional finding was found.

Reviewed steps:

1. Arabic My Work entry and daily grouping — healthy.
2. Shared view switching and compact row hierarchy — healthy.
3. URL-addressable Work Item panel, focus entry/trap, Escape close, and RTL placement — healthy.
4. Text/voice simulated update explanation and employee confirmation — healthy.
5. Evidence suggestion review and contribution context — healthy.
6. Manager operational projection and coarse readiness privacy — healthy.
7. English LTR and 390px Arabic/English reflow — healthy.

Deferred polish:

- On 390px screens, the two quick actions occupy a tall utility area; consider a compact overflow menu after direction approval.
- Some secondary metadata uses 10–11px text. Verify zoom and contrast with the production design system before implementation.
- The prototype uses simple text glyphs for navigation accents. Replace them with the approved production icon set during the production UI slice.
- Screenshot inspection and keyboard smoke checks do not establish full WCAG conformance; production slices still require automated and assistive-technology verification.

## Screenshots

- `screenshots/product-reset/phase2-ar-my-work-desktop.png`
- `screenshots/product-reset/phase2-ar-work-item-panel-desktop.png`
- `screenshots/product-reset/phase2-ar-evidence-desktop.png`
- `screenshots/product-reset/phase2-ar-manager-desktop.png`
- `screenshots/product-reset/phase2-en-my-work-desktop.png`
- `screenshots/product-reset/phase2-ar-my-work-mobile.png`
- `screenshots/product-reset/phase2-en-my-work-mobile.png`
