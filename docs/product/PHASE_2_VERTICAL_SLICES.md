# Phase 2 AI-First Daily Workspace Vertical Slices

**Status:** Approved production sequence

**Authority:** `docs/superpowers/plans/2026-07-20-ai-first-daily-workspace-master-plan.md`

Every slice must produce visible, runnable software across the necessary UI, API, domain, persistence, authorization, audit, localization, tests, and demo. Previously implemented domain foundations remain reusable; previously rejected employee interactions do not.

## Slice 1 — Daily home and Tasks

**Visible result:** The employee opens Today, sees Needs My Action/Today/Overdue first, captures a private Inbox thought, promotes it through a Project-linked Task draft, and manages the same Task through My Tasks, Team Tasks, List, Board, Calendar, and focused detail.

**Backend delta:** `0017_task_workspace`; private Inbox; checklist and Task update support; protected Task endpoints; Today composition.

**Acceptance criteria:**

- Official Task always requires Project.
- Private Inbox item may be unlinked and is visible only to its employee.
- Promotion atomically creates one official Task and closes the Inbox item.
- Task detail supports responsible assignee, optional collaborators, Workstream, due date, priority, description, checklist, source links, and append-only history.
- List/Board/Calendar use one Task identity and permissions model.
- No Task count or completion changes Project progress or employee performance.
- Arabic/English routing, RTL/LTR, mixed technical text, keyboard, focus, reduced motion, and 390px layout pass.

**Focused tests:** migration; contracts; Inbox ownership; promotion transaction; Task updates; API guards; Today ordering/timezone; component behavior; protected browser journey.

**Demo:** Today → quick capture → Task draft → choose Project → confirm Task → edit in side panel/sheet → switch List/Board/Calendar.

**Stop gate:** Product Owner validates daily-use clarity and speed.

## Slice 2 — Google Workspace context

**Visible result:** The employee connects Google Workspace, sees private Gmail and Calendar summaries, excludes unwanted sources, and manually links useful context to a Project.

**Backend delta:** `0018_connected_work_context`; provider-neutral adapters; credential vault and encryption ports; sync cursor; exclusions; links; protected APIs.

**Acceptance criteria:**

- Minimum approved scopes and exact OAuth state/nonce/redirect enforcement.
- Provider tokens never enter plaintext database fields or logs.
- Sensitive derived summaries are encrypted.
- Employee-only access; manager and other employees receive no private summary or metadata.
- Originals remain in Google; local storage is minimal.
- Link/unlink/exclude/disconnect are reversible and audited.
- Last successful sync and stale state are visible; recovery does not duplicate items.

**Focused tests:** schema; owner privacy; OAuth attack cases; cursor recovery; idempotency; encryption boundary; disconnect/retention; browser journey.

**Demo:** deterministic Gmail/Calendar context review, exclusion, manual Project link, unlink, disconnect.

**Stop gate:** privacy/security review and the external organization OAuth/retention gate before live mode.

## Slice 3 — Context Intelligence

**Visible result:** The assistant summarizes work context, explains safe Project links, asks the employee to resolve uncertain items, learns from corrections, and prepares a complete editable Task draft.

**Backend delta:** `0019_context_intelligence`; matching policy; approved Project-document semantic context; versioned AI routes/schemas; corrections; Task drafts; review queue.

**Acceptance criteria:**

- Automatic link requires deterministic mapping or two non-conflicting independent anchors.
- Model confidence alone cannot authorize a link.
- AI output is grounded in authorized sources and includes uncertainty.
- Employee can inspect sources, correct, reject, leave unlinked, or dismiss.
- AI cannot create or assign an official Task.
- Manual operation remains usable when AI is unavailable.
- Draft and source context survive reauthentication.
- No rating, rank, productivity score, or employee judgment fields.

**Focused tests:** matching policy; source authorization; prompt injection; Arabic/mixed text; schema/route trace; confirmation idempotency; privacy negatives; browser journey.

**Demo:** explainable auto-link, uncertain review, correction, rejected suggestion, edited Task draft, human confirmation.

**Stop gate:** Product Owner validates usefulness, transparency, and employee control.

## Slice 4 — GitHub, Updates, Evidence, and voice

**Visible result:** GitHub facts plus employee text, voice, image, file, code, and link sources enter one compact draft/confirmation flow and source-labelled Timeline.

**Backend delta:** `0020_github_integration`; GitHub App binding; webhook/reconciliation; governed suggestions; simplified universal capture; voice transcription; evidence review.

**Acceptance criteria:**

- GitHub signatures, replay/idempotency, reconciliation, minimum permissions, and uninstall handling.
- Verified deterministic contract condition may affect operational Project progress only through Projects.
- Ambiguous GitHub events require authorized Project review.
- Personal contribution Evidence always requires employee confirmation.
- Universal capture shows a useful draft first and asks one focused question at a time only when needed.
- Audio, transcript, employee correction, Update draft, Evidence, and route trace remain distinct.
- Raw activity volume never becomes progress or performance.
- Files/audio remain private and pass type/size/safety controls.

**Focused tests:** webhook integrity; reconciliation; progress-condition rejection; evidence confirmation; Update recovery; voice fixtures; AI boundary; file safety; Timeline authorization; browser journey.

**Demo:** mapped and ambiguous GitHub events, manual text/file/code source, voice correction, Evidence confirmation, compact result, Timeline.

**Stop gate:** GitHub external gate plus integrity, upload, AI, evidence, and privacy reviews.

## Slice 5 — Project owner progress and manager operations

**Visible result:** A Project owner configures measurable progress through a guided owner-only flow; employees see a compact Project pulse; managers act from operational queues.

**Backend delta:** reuse existing Progress Contract; strengthen owner authorization; guided UI; Project pulse; Thursday check-in; Monthly Readiness; manager operations query.

**Acceptance criteria:**

- AI proposal remains inactive until authorized human review and approval.
- Official progress has no direct percentage override.
- Insufficient source coverage retains the previous official percentage.
- Source-explained decreases and contract-version history are append-only.
- Thursday check-in appears only without substantive update; approved leave is excluded.
- Readiness has no quota, automatic penalty, or performance score.
- Manager receives actions and coarse states, never individual readiness percentage/rank, productivity score, leaderboard, predicted rating, or employee ranking.
- Employee quick actions are hidden from manager unless separately authorized as contributor/owner.

**Focused tests:** authorization; draft/activation immutability; progress calculations; check-in and leave; readiness privacy; forbidden fields; manager scope; browser journey.

**Demo:** owner setup, employee Project pulse, missing evidence action, check-in/readiness, manager action queue.

**Stop gate:** Product Owner validates owner clarity, employee neutrality, and manager usefulness.

## Slice 6 — Evaluation Fact View preparation

**Visible result:** Employee and authorized manager see the same neutral source-supported work facts, with employee interpretation clearly separated, before a future quarterly human assessment.

**Backend delta:** read-only Evaluation Preparation package; public source readers; protected Fact View API; neutral UI.

**Acceptance criteria:**

- Source IDs, timestamps, responsibility windows, effective criteria versions, and verification states are traceable.
- Source facts appear before employee interpretation.
- Project count, Task count, activity volume, GitHub volume, readiness, and Project progress do not become performance scores.
- No rating suggestion, prediction, ranking, productivity score, automatic Project average, or manager-visible individual readiness percentage.
- Complete self-assessment, manager assessment, comparison, discussion, and final rating are not implemented in Phase 2.

**Focused tests:** fact/interpretation separation; historical responsibility; prospective criteria; authorization; privacy; neutrality scan; browser journey.

**Demo:** trace an accepted source through the Fact View and show neutral missing-coverage language.

**Stop gate:** Product Owner reviews neutrality, privacy, historical accuracy, and the explicit Phase 3 boundary.

## Durable checkpoint rule

After each slice:

1. Run focused tests and related integration tests.
2. Run secret, performance-input, and AI-boundary scans.
3. Run the visible local demo.
4. Capture Arabic/English desktop and mobile screenshots where applicable.
5. Commit and push the branch.
6. Update Pull Request #5, `TASKS.md`, and `project-state/PROJECT_STATE.md`.
7. Stop at the declared Product Owner gate.

Do not merge Pull Request #5, start a later slice, configure live external credentials, or change protected product rules without the applicable gate.
