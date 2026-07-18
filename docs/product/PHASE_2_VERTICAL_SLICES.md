# Phase 2 Product Reset Vertical Slices

> **SUPERSEDED PROTOTYPE SEQUENCE — DO NOT EXECUTE**
>
> This file is retained as the sequence that accompanied the Product Reset acceptance prototype. The approved production feature map is now `docs/product/PHASE_2_FEATURE_MAP.md`, and the approved production design is `docs/superpowers/specs/2026-07-18-phase-2-daily-work-progress-design.md`.

**Status:** Superseded prototype-planning history
**Current checkpoint:** No production slice is authorized

Every slice must produce one visible result across UI, API, domain, persistence, authorization, audit, localization, tests, and demo. Reuse the Phase 1 backend; do not create a parallel identity, Project, Workstream, criteria, document, audit, queue, or AI store.

## Slice 1 — My Work + Work Item

**Visible result:** An employee sees authorized Work Items in My Work, creates one under a required Project and optional same-Project Workstream, and opens a URL-addressable panel.

**Backend delta:** New bounded `work-items` module; Work Item, assignment/participant, dependency, status-history, and assignment-history records; list/get/create/update/transition queries and commands.

**Dependencies:** Phase 1 identity, permissions, Projects, Workstreams, responsibility windows, and audit.

**Acceptance criteria:**

- exact seven-status vocabulary;
- Project required and Workstream optional/same-Project;
- status and assignment history append-only;
- My Work groups and compact rows;
- server authorization, optimistic concurrency, Arabic/English, RTL/LTR, keyboard, and 390px support;
- no workload score, time tracking, sprint, story point, or employee performance calculation.

**Focused tests:** domain invariants; migration from empty and Phase 1 snapshot; permission matrix; concurrency; immutable history; My Work query; Arabic/RTL component; protected end-to-end flow.

**Demo:** employee creates, filters, opens, transitions, and closes a Work Item on desktop and mobile.

**Stop/approval gate:** migration, authorization, concurrency, history, and protected-rule review before Slice 2.

## Slice 2 — Text Update + live AI + Timeline

**Visible result:** An employee writes an update, answers one missing-context question, edits the structured draft, confirms it, and sees it in Activity Timeline.

**Backend delta:** Update source/revision, structured-draft revision, confirmation event, and activity projection; versioned schema; AI Router command; read/create/confirm endpoints.

**Dependencies:** Slice 1, AI Router, worker, audit, active responsibility and criteria queries.

**Acceptance criteria:**

- original text and revisions retained;
- all AI calls use AI Router;
- result contains descriptive fields and source references, never rating/rank/productivity/readiness scores;
- one clarification at a time;
- employee edit and confirmation are mandatory human gates;
- accepted event links Project, optional Workstream, Work Item, criteria, and evidence.

**Focused tests:** schema validation; no-rating AI eval; Arabic fixtures; prompt-injection fixture; confirmation authorization; immutable revision; activity ordering; route trace and audit.

**Demo:** submit incomplete Arabic text, clarify, edit, confirm, and inspect source versus structured event.

**Stop/approval gate:** AI boundary, prompt/schema version, audit integrity, and immutable-history review before Slice 3.

## Slice 3 — Evidence + attribution

**Visible result:** An employee adds file/link/test evidence, describes personal versus team contribution, selects execution mode, and confirms attribution.

**Backend delta:** Evidence, source reference, evidence revision, confirmation, attribution, execution mode, and evidence-link records; create/edit/confirm/reject commands.

**Dependencies:** Slices 1–2, Phase 1 files/documents, responsibility windows, criteria, audit.

**Acceptance criteria:**

- immutable source and revision history;
- Work Item/update/criterion links;
- Manual, AI-Assisted, Agent-Generated, and Mixed modes;
- partial and team contribution remain explicit;
- attribution follows the responsibility window;
- evidence volume never becomes a performance input.

**Focused tests:** file/link authorization; source immutability; attribution window; team/partial context; confirmation transaction; negative performance-contract test.

**Demo:** attach, contextualize, confirm, revise through a new revision, and inspect attribution history.

**Stop/approval gate:** privacy, attribution, file safety, audit, and immutable-history review before Slice 4.

## Slice 4 — GitHub suggested evidence

**Visible result:** GitHub PR, commit, check, and test activity arrives as suggestions that an employee can link, merge, reassign, contextualize, confirm, reject, or ignore.

**Backend delta:** GitHub suggestion and source-link records; webhook/reconciliation commands; idempotency keys; suggestion merge/reassignment history; Inbox projection.

**Dependencies:** Slice 3, existing worker/queue, GitHub App with minimum permissions, audit.

**Acceptance criteria:**

- original source ID and URL retained;
- webhook and reconciliation idempotent;
- no suggestion becomes contribution/evidence before employee confirmation;
- link to Work Item, update, and criterion;
- merge, team/partial contribution, Project reassignment, reject, and ignore supported;
- commit, PR, file, line, and activity volume absent from performance contracts.

**Focused tests:** webhook replay; reconciliation; permission boundaries; confirmation transaction; merge/reassignment history; negative volume-to-performance test.

**Demo:** ingest a synthetic PR/check, confirm one with context, reject another, and show no performance score.

**Stop/approval gate:** GitHub permissions, idempotency, attribution, audit, and protected evidence review before Slice 5.

## Slice 5 — Voice update

**Visible result:** An employee records/uploads voice, corrects the raw transcript, confirms it, edits the structured update, and confirms the final event.

**Backend delta:** private audio source, raw/edited transcript revisions, STT route trace, structured update link, retention/access policy, upload and confirmation commands.

**Dependencies:** Slice 2, Phase 1 upload controls, AI Router adapter interface, worker, audit.

**Acceptance criteria:**

- original audio, raw transcript, edited transcript, structured update, and provider trace retained under policy;
- audio/file validation and private access;
- employee confirms transcript and structured output separately;
- STT provider remains adapter-based;
- Arabic Fusha, Gulf, Levantine, and mixed-language fixtures;
- no rating output.

**Focused tests:** file type/size/safety; private access; transcript revisions; dual human gates; dialect eval fixtures; injection defense; retention.

**Demo:** simulated Gulf Arabic recording through transcript correction and confirmed timeline event.

**Stop/approval gate:** credential/configuration, privacy, file safety, AI route, dialect quality, and retention review before Slice 6.

## Slice 6 — Check-ins and monthly readiness

**Visible result:** The product requests a Thursday check-in only when substantive updates are absent and highlights thin monthly records without quotas or penalties.

**Backend delta:** substantive-update query, check-in reminder state, monthly readiness projection, approved-leave exclusion, manager-safe coarse aggregation.

**Dependencies:** Slices 1–5, Phase 1 Documentation Readiness, responsibility, eligibility/leave state, worker.

**Acceptance criteria:**

- no duplicate Thursday detail when a substantive update exists;
- approved leave excluded;
- Project check-in summarizes cross-Workstream state;
- monthly readiness identifies thin records without evidence quota, penalty, score, or ranking;
- manager projection is coarse and contains no individual percentage/value.

**Focused tests:** substantive-update boundary; Thursday schedule; approved leave; cross-Workstream summary; no-quota/no-score contract; manager privacy negatives.

**Demo:** show reminder generated, reminder suppressed by update, approved-leave exclusion, and coarse manager view.

**Stop/approval gate:** readiness privacy, leave behavior, scheduling, and protected product-rule review before Slice 7.

## Slice 7 — Manager operational view

**Visible result:** A manager reviews blockers, missing check-ins, criteria objections, attribution questions, reassignment, evaluation actions, and team-level readiness gaps without employee scoring.

**Backend delta:** manager operations query composed from public module interfaces; coarse readiness projection; action-resolution commands.

**Dependencies:** Slices 1–6 and Phase 1 manager permissions.

**Acceptance criteria:**

- Project/Workstream operational health and action categories;
- server-side manager scope;
- no employee rank, productivity score, individual readiness percentage/value, commit leaderboard, task leaderboard, or predicted rating;
- rating decision remains separate and human.

**Focused tests:** manager-scope positive/negative cases; forbidden-field response contract; coarse readiness; action resolution; Arabic/RTL end-to-end.

**Demo:** manager resolves a blocker and inspects coarse readiness, then verify forbidden fields are absent.

**Stop/approval gate:** manager authorization, readiness privacy, and protected-rule review before Slice 8.

## Slice 8 — Evaluation Fact View preparation

**Visible result:** Employee and manager preparation distinguishes source-supported facts from employee interpretation before periodic human evaluation.

**Backend delta:** period Fact View query/snapshot with responsibility window, claim, facts, unclear parts, result, evidence, verification, attribution, criteria, and immutable source references.

**Dependencies:** Slices 1–7, Phase 1 criteria/responsibility/audit, later evaluation-cycle implementation.

**Acceptance criteria:**

- source facts and employee interpretation visibly and contractually separate;
- historical responsibility and active-at-time criteria used;
- evidence and verification traceable;
- no automatic Project/Workstream/criteria average;
- no recommended/predicted rating;
- final manager rating remains human and finalization creates an immutable snapshot.

**Focused tests:** fact/interpretation separation; responsibility period; criteria version; evidence trace; no-rating schema/eval; snapshot immutability; privacy authorization.

**Demo:** inspect one period from source update/evidence through Fact View, then show the manager makes an independent human decision.

**Stop/approval gate:** evaluation finalization, immutable snapshot, privacy, AI no-rating, and protected product-rule approval before any later evaluation slice.

## Durable checkpoint rule

After each approved slice: run only focused tests plus related integration tests, demonstrate the visible outcome, commit, push, update the phase Pull Request and task record, then stop at the slice’s declared gate. Do not execute several invisible slices as one long bundle.
