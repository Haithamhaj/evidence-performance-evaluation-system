# TASKS.md

## Execution Task File — Revision 1.4

**Status:** Ready for implementation
**Task order:** Dependency-driven and phase-valid
**Completion rule:** A task is complete only after required verification passes
**Pilot feedback mode:** Identified
**Pilot language:** English-only use permitted; Arabic employee use requires approved Arabic rubric content and semantic review
**Cycle 1:** Calibration — Non-Baseline

Legend:

- `P0` foundational or blocking.
- `P1` core product.
- `P2` completion, configurability, or hardening.
- `APPROVAL` requires explicit product approval before execution or change.

The dependency graph must be validated by CI. No task may depend on an unknown task or a task in a later phase.

---

# Phase 0 — Repository, Governance, AI, and Localization Foundations

## T001 — Create Monorepo Foundation

**Priority:** P0
**Dependencies:** None
**Purpose:** Establish the repository structure and shared tooling.
**Expected output:** `apps/web`, `apps/api`, `apps/worker`, shared packages, workspace configuration.
**Likely areas:** repository root, package manager, TypeScript, lint, format.
**Verification:** install succeeds; all apps compile; workspace scripts run.

## T002 — Add Local Infrastructure

**Priority:** P0
**Dependencies:** T001
**Purpose:** Provide PostgreSQL, Redis, MinIO, and OIDC identity provider for local development.
**Expected output:** Docker Compose and environment templates.
**Likely areas:** `infra/docker`, `.env.example`.
**Verification:** clean startup; health checks; persistent volumes; documented reset.

## T003 — Establish CI Pipeline

**Priority:** P0
**Dependencies:** T001, T002
**Purpose:** Enforce build quality from the beginning.
**Expected output:** install, lint, typecheck, unit test, integration-test setup, migration validation.
**Likely areas:** CI configuration, scripts.
**Verification:** CI passes on clean repository and fails on an intentional test failure.

## T004 — Create Database Package and Migration Workflow

**Priority:** P0
**Dependencies:** T002
**Purpose:** Establish Prisma/PostgreSQL schema ownership and migration rules.
**Expected output:** database package, migration commands, test database support.
**Likely areas:** `packages/database`.
**Verification:** migrate empty DB; rollback through rebuild; generate client; integration test.

## T005 — Implement Structured Logging and Error Model

**Priority:** P0
**Dependencies:** T001
**Purpose:** Create consistent operational and user-safe errors.
**Expected output:** correlation IDs, structured logs, error codes, error boundaries.
**Likely areas:** API, worker, shared packages.
**Verification:** correlation carrier contract across Web/API/Worker; sensitive values not logged; real queued trace propagation verified by T013.

## T006 — Implement Authentication

**Priority:** P0
**Dependencies:** T002, T004
**Purpose:** Authenticate users through OIDC.
**Expected output:** login/logout/session, user synchronization, deactivation enforcement.
**Likely areas:** `packages/auth`, web middleware, API guards.
**Verification:** valid login; invalid login; expired session; deactivated user denied.

## T007 — Implement Authorization Framework

**Priority:** P0
**Dependencies:** T006
**Purpose:** Enforce RBAC and scoped resource rules.
**Expected output:** Employee, Manager, System Administrator, Project Owner, Workstream Owner, Contributor, Acting Owner policies.
**Likely areas:** `packages/permissions`, API guards.
**Verification:** permission matrix tests, including negative manager access to upward data.

## T008 — Seed Pilot Organization and Roles

**Priority:** P0
**Dependencies:** T004, T006, T007
**Purpose:** Create LeapAI pilot organization, AI department, roles, and separated manager/admin users.
**Expected output:** repeatable seed script.
**Likely areas:** database seeds.
**Verification:** idempotent seed; role separation verified.

## T009 — Create Audit Foundation

**Priority:** P0
**Dependencies:** T004, T006, T007, T008
**Purpose:** Provide append-only audit events.
**Expected output:** audit service, event schema, query API for authorized admins.
**Likely areas:** `packages/audit`, API module.
**Verification:** authentication synchronization, pilot role assignment, representative private-mode access decisions, and their audit events succeed or roll back atomically; bootstrap seed events use a non-human service actor; database-to-audit imports are prohibited; ordinary users cannot modify/delete or query protected events.

## T010 — Seed Approved Evaluation Rubric

**Priority:** P0
**Dependencies:** T004, T008, T009
**Purpose:** Store Version 1 sections, 12 criteria, 60 anchors, weights, and five manager criteria.
**Expected output:** versioned rubric seed matching `EVALUATION_RUBRIC.md`.
**Likely areas:** evaluation configuration schema and seed.
**Verification:** automated content/weight comparison; totals equal 100%; rubric activation and its audit event are atomic; Documentation Readiness cannot enter a performance-rating input; raw activity counts are absent from performance input contracts.

## T011 — Implement AI Router

**Priority:** P0
**Dependencies:** T004, T005, T009
**Purpose:** Centralize all AI calls and route resolution.
**Expected output:** provider adapters, route configs, fallbacks, run trace.
**Verification:** project > department > system; override requires reason; provider failure fallback.

## T012 — Implement AI Evaluation Harness

**Priority:** P1
**Dependencies:** T011
**Purpose:** Regression-test prompts, schemas, feedback-visibility modes, Arabic content, dialects, and criteria quality.
**Verification:** versioned English and Arabic fixture suite runs in CI or a controlled evaluation pipeline; synthetic or licensed Gulf and Levantine audio fixtures pass manifest, provenance, checksum, and golden-transcript integrity checks; raw activity counts are absent from performance inputs; no AI output contains a performance rating recommendation.

## T013 — Implement Worker and Queue Infrastructure

**Priority:** P0
**Dependencies:** T002, T004, T005, T009, T011
**Purpose:** Run asynchronous AI, GitHub, document, notification, and aggregation jobs.
**Verification:** retry, dead-letter state, idempotency, traceability.

## T014 — Implement Evaluation Eligibility Snapshot Foundation

**Priority:** P0
**Dependencies:** T004, T007, T008, T009
**Purpose:** Determine who is eligible for each employee and manager evaluation cycle without depending on the later full leave/delegation module.
**Expected output:** Versioned cycle eligibility records with active, excluded, approved-leave, and pending states.
**Likely areas:** evaluation configuration, users, cycle domain
**Verification:** Eligibility is frozen at cycle open; approved-leave state can be represented; the permitted pre-close exclusion transition and its audit event are atomic; identified pilot completion status works; no Phase 4 task depends on Phase 5.

## T015 — Implement Localization and RTL Foundation

**Priority:** P0
**Dependencies:** T001
**Purpose:** Preserve Arabic localization and RTL foundations without permitting Arabic employee use before rubric approval.
**Expected output:** Locale routing, translation catalogs, RTL tokens/components, mixed-direction utilities, Arabic typography and date/number handling.
**Likely areas:** web shell, shared UI, contracts, localization package
**Verification:** Arabic and English app shells render; keyboard/focus order works in RTL; code, URLs, model names, and repository paths display correctly; UTC values render with locale-aware dates and numbers in the user timezone with `Asia/Riyadh` as the default; Identified-mode catalogs disclose manager visibility and reject anonymity/confidentiality promises.

## T016 — Translate and Approve the Arabic Evaluation Rubric

**Priority:** APPROVAL
**Status:** Deferred, draft, and inactive; future Arabic employee-release gate, not a Phase 0 or engineering-phase blocker.
**Dependencies:** T010, T015
**Purpose:** Provide employee-ready Arabic meaning for the complete Version 1 rubric before rollout.
**Expected output:** Approved Arabic translations of 12 criteria, 60 employee anchors, Project Contribution anchors, five manager criteria, 25 manager anchors, examples, prompts, and bias guidance.
**Likely areas:** rubric content, localization data, approval record
**Verification:** Separate Arabic subject-matter and employee-comprehension reviews pass; adjacent rating meanings remain distinct; IDs, version, and source hashes match English; activation, approval, and their audit events are atomic; translation cannot activate independently when either human disposition or meaning is unresolved.
**Approval:** Product owner or delegated Arabic evaluation subject-matter reviewer approves the Arabic meaning, and authorized pilot reviewers complete employee-comprehension review, before employee-facing use.

## T017 — Add Task Dependency Graph Validation

**Priority:** P0
**Dependencies:** T003
**Purpose:** Prevent task plans from containing dependencies on later phases or unknown task IDs.
**Expected output:** CI script that parses TASKS.md and validates IDs, dependencies, cycles, and phase order.
**Likely areas:** scripts, CI, project documentation tooling
**Verification:** Current task graph passes; an intentionally invalid later-phase dependency fails CI.

---

# Phase 1 — Projects, Workstreams, Documents, and Criteria

## T018 — Implement Project Domain

**Priority:** P1
**Dependencies:** T004, T007
**Purpose:** Create projects, status, owners, and members.
**Expected output:** APIs and domain rules.
**Verification:** one active Primary Owner; manager-scoped management; historical ownership retained.

## T019 — Implement Workstream Domain

**Priority:** P1
**Dependencies:** T018
**Purpose:** Create workstreams, owners, contributors, and parent relationships.
**Verification:** one active Workstream Owner; multiple contributors; no supervisor authority implied.

## T020 — Implement Responsibility Windows

**Priority:** P1
**Dependencies:** T018, T019
**Purpose:** Track Original, Acting, Permanent, and Contributor responsibility periods.
**Verification:** overlapping contributor windows allowed; owner invariants; correct period queries.

## T021 — Implement Document Template Engine

**Status:** Complete — protected activation, scoped versioning, immutable history, and optimistic concurrency verified.
**Priority:** P1
**Dependencies:** T004, T007
**Purpose:** Support protected core sections and configurable defaults.
**Expected output:** organization/department templates and versions.
**Verification:** six protected project requirements cannot be removed; future-version activation works.

## T022 — Implement File Upload and Object Storage

**Status:** Complete — fail-closed streaming validation, ClamAV, private storage, and authorized signed access verified.
**Priority:** P1
**Dependencies:** T002, T005, T007
**Purpose:** Store documents, images, and audio safely.
**Verification:** type/size validation; signed access; unauthorized access denied; metadata recorded.

## T023 — Implement Project and Workstream Documents

**Status:** Complete — one stable document per resource, append-only versions, retained history, and stale-write rejection verified.
**Priority:** P1
**Dependencies:** T021, T022
**Purpose:** Attach versioned documents to projects and workstreams.
**Verification:** upload new version; retain old version; optimistic concurrency.

## T024 — Implement Document Readiness Checks

**Status:** Complete — source-bound readiness, append-only results, correction guidance, and manager-safe projection verified.
**Priority:** P1
**Dependencies:** T023, T011
**Purpose:** Validate documents against template requirements.
**Expected output:** readiness status, missing items, AI correction instructions.
**Verification:** complete/incomplete fixtures; no competing hidden source of truth.

## T025 — Implement Document Comparison and Material Change

**Status:** Complete — adjacent-version comparison, retained source references, and append-only human review verified.
**Priority:** P1
**Dependencies:** T023, T011
**Purpose:** Compare versions and classify material changes.
**Verification:** editorial vs material fixtures; source references retained; human review available.

## T026 — Implement Dynamic Project Criteria

**Status:** Complete — one-to-three source-bound proposals, employee correction/rejection, owner approval, and prospective activation verified.
**Priority:** P1
**Dependencies:** T024, T011
**Purpose:** Generate and approve one to three project criteria.
**Verification:** employee correction/rejection flow; no AI rating fields; effective date enforced.

## T027 — Implement Dynamic Workstream Criteria

**Status:** Complete — two-to-three proposals, frozen contributor responses, retained objections, and bounded manager resolution verified.
**Priority:** P1
**Dependencies:** T024, T019, T011
**Purpose:** Generate two to three criteria and collect contributor acknowledgments/objections.
**Verification:** no unanimity requirement; objections retained; criteria versioned.

## T028 — Implement Criteria Revision

**Status:** Complete — reviewed material changes create atomic prospective revisions while historical timestamp links remain immutable.
**Priority:** P1
**Dependencies:** T025, T026, T027
**Purpose:** Revise criteria prospectively after material changes.
**Verification:** old activity remains linked to old version; retroactive link rejected.

## T029 — Build Project and Workstream UI

**Status:** Complete — Arabic-first responsive project/workstream screens, same-origin protected actions, role-scoped controls, bilingual routing, RTL/mixed-direction handling, and core browser flows verified.
**Priority:** P1
**Dependencies:** T018–T028
**Purpose:** Provide simple list/detail, members, documents, criteria, and status screens.
**Expected output:** Arabic-first responsive RTL screens with English support.
**Verification:** employee/manager scope; responsive UI; core e2e flow.

---

# Phase 2 — Updates, Evidence, GitHub, Check-ins, and Monthly Readiness

> **REPLANNED — DO NOT EXECUTE T030–T044 IN THE ORIGINAL ORDER**
>
> The product owner approved the AI-first Daily Workspace reset on 2026-07-20. T030–T044 remain traceability references, but the active authority is `docs/superpowers/specs/2026-07-20-ai-first-daily-workspace-design.md` and `docs/superpowers/plans/2026-07-20-ai-first-daily-workspace-master-plan.md` with its six linked slice plans. Earlier Phase 2 designs and plans are historical records only.

## Approved execution mapping

1. Slice 1 — Today + normal Task workspace + private Inbox.
2. Slice 2 — Google Workspace connection + private context + manual Project linking.
3. Slice 3 — Context Intelligence + explainable linking + human-confirmed Task drafts.
4. Slice 4 — GitHub + fast Updates + Evidence + voice + Timeline.
5. Slice 5 — Project-owner progress setup + check-ins/readiness + manager operations.
6. Slice 6 — neutral Evaluation Fact View preparation.

Execution status:

- The bounded Work Items, Updates & Evidence, Progress Contract, daily composition, bilingual routing, and real Codex dogfood foundations already implemented remain reusable.
- The previous employee My Work and long Update interaction were rejected and are not accepted as the new Slice 1 experience.
- **New Slice 1 is implemented and accepted by the Product Owner.**
- **Slice 2 deterministic implementation and privacy acceptance are complete at the Product Owner
  gate and accepted by the Product Owner. A guarded real-personal-account preview exists only for
  explicit local acceptance; production Google remains blocked by the approved
  external-configuration gate.**
- **Slice 3 Tasks 1–6, deterministic acceptance, and all bounded final-review P1 remediations are
  implemented, verified, and accepted by the Product Owner. Untrusted Gmail title/summary text
  cannot act as a confirmed sender-domain anchor.**
- **Slice 4 Tasks 1–7 are implemented, comprehensively verified, accepted by the Product Owner,
  and authorized for merge.** The deterministic acceptance journey covers GitHub
  webhook/reconciliation, governed
  suggestions, universal text/voice/file/code capture, employee-confirmed evidence, ambiguous
  Project-owner review, and the source-labelled Timeline. Live GitHub App installation remains an
  external administrator/credential gate.
- **Slice 5 is technically complete and merged.** Its owner setup, Project pulse, check-ins,
  monthly readiness, and manager operations are verified engine surfaces; final frontend usability
  acceptance is intentionally deferred to the dedicated frontend program.
- **Slice 6 is technically complete, merged, and green on `main`.** The neutral Evaluation Fact
  View composes source-supported facts without ratings, ranking, readiness leakage, or automatic
  Project averages. It prepares the source layer for Phase 3; it does not implement evaluation.

## AI-first reset task trace

These IDs are execution checkpoints inside the approved plans; they are not new dependency-graph task headings.

| Slice  | Plan tasks                                                                                                                                          | Status                                                                   |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| P2R-S1 | S1-T1 persistence; S1-T2 services; S1-T3 APIs; S1-T4 Today composition; S1-T5 Task UI; S1-T6 acceptance                                             | Accepted by Product Owner                                                |
| P2R-S2 | S2-T1 schema; S2-T2 connection/sync; S2-T3 APIs; S2-T4 UI; S2-T5 gated live adapters; S2-T6 privacy acceptance                                      | Deterministic complete; Product Owner gate; live Google externally gated |
| P2R-S3 | S3-T1 governed AI schema; S3-T2 deterministic matching; S3-T3 routed AI; S3-T4 APIs; S3-T5 review queue; S3-T6 acceptance                           | Accepted by Product Owner                                                |
| P2R-S4 | S4-T1 GitHub schema; S4-T2 webhook/reconciliation; S4-T3 source suggestions; S4-T4 universal capture; S4-T5 voice; S4-T6 Timeline; S4-T7 acceptance | Accepted by Product Owner; live GitHub externally gated                  |
| P2R-S5 | S5-T1 owner authorization; S5-T2 setup UI; S5-T3 Project pulse; S5-T4 check-ins/readiness; S5-T5 manager queues; S5-T6 acceptance                   | Technically complete — verified; final frontend acceptance deferred      |
| P2R-S6 | S6-T1 Fact contract; S6-T2 source composition; S6-T3 API; S6-T4 UI; S6-T5 acceptance                                                                | Technically complete; merged and green on `main`                         |

Original-task mapping:

- T030–T035 foundations are reused in Slice 4; the rejected employee interaction is replaced.
- T032 and relevant T044 voice/dialect fixtures are completed in Slice 4.
- T036–T037 and T043 are completed in Slice 5.
- T038–T041 are completed in Slice 4.
- T042 is delivered visibly across Slices 1–5.
- Phase 2 Fact View preparation is Slice 6 and does not implement the complete Phase 3 evaluation workflow.

## Engine-first completion checkpoints

These checkpoint IDs extend execution traceability without renumbering or weakening T001–T077.
The detailed authority is
`docs/superpowers/plans/2026-08-05-engine-first-completion-program.md` and the current baseline is in
`docs/product/ENGINE_FEATURE_REGISTER.md`.

| Checkpoint | Scope                                                                          | Status                                                                                                              |
| ---------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| E2         | Feature register, capability matrix, system map, and frontend handoff contract | Complete — source-traced baseline verified                                                                          |
| E3         | Research questions, experiments, conclusions, decisions, and applied learning  | Technical checkpoint complete locally, including real production API+PostgreSQL lifecycle; hosted PR checks pending |
| E4         | Employee Fact View, self/manager assessment, comparison, and finalization      | Technical checkpoint complete locally; E6B export delivery is now complete; final frontend remains later            |
| E5         | Identified upward manager evaluation, coaching, and development                | E5A and E5B technical checkpoints complete locally; combined review and hosted checks pending                       |
| E6         | Leave/delegation, notifications, exports, administration, hardening, recovery  | Technical checkpoint complete locally through E6C; production infrastructure remains externally gated               |
| E7         | Final source-to-code engine audit and final-frontend handoff                   | Complete — 44 capabilities reconciled; ready for Product Owner frontend-handoff review                              |

## T030 — Implement Activity Timeline

**Planning status:** Existing append-only source-labelled foundation is retained and presented through the unified Timeline in new Slice 4; do not build a generic activity platform.
**Execution status:** Domain foundation complete; new employee Timeline presentation pending Slice 4.
**Priority:** P1
**Dependencies:** T018, T019
**Purpose:** Store typed project and workstream events.
**Verification:** append-only history; pagination; correct contributor/time scope.

## T031 — Implement Text Update Composer

**Planning status:** The completed backend foundation is retained and simplified inside the new Slice 4 universal capture flow.
**Execution status:** Backend foundation complete; rejected long-form employee interaction will be replaced.
**Priority:** P1
**Dependencies:** T030, T011
**Purpose:** Structure employee updates through AI and human confirmation.
**Verification:** original input retained; structured output validated; employee approval required.

## T032 — Implement Voice Update Flow

**Planning status:** Mapped to new Slice 4 as a connector to the existing Updates & Evidence lifecycle.
**Priority:** P1
**Dependencies:** T022, T030, T011
**Purpose:** Transcribe, confirm, structure, and store voice updates.
**Verification:** transcript editing; original audio trace; failed STT recovery; Fusha, Gulf, and Levantine Arabic fixtures; mixed Arabic/English terminology.

## T033 — Implement Evidence Records

**Planning status:** Existing bounded Updates & Evidence ownership is retained; new Slice 4 exposes evidence inside universal capture and source review.
**Execution status:** Private manual evidence foundation complete; simplified employee journey pending Slice 4.
**Priority:** P1
**Dependencies:** T022, T030
**Purpose:** Link files, images, links, and source metadata to claims and criteria.
**Verification:** many-to-many links; permissions; source integrity.

## T034 — Implement Multimodal Evidence Analysis

**Planning status:** Retained in new Slice 4; analysis supports a claim but never becomes automatic proof or progress.
**Execution status:** The bounded Slice 2 acceptance is complete: screenshots/files use the existing private upload safety path, while the reviewed update draft may prefill the claim. Direct evidence-content inference is not treated as proof and was not added as a separate platform.
**Priority:** P1
**Dependencies:** T033, T011
**Purpose:** Analyze images and documents without treating them as automatic proof.
**Verification:** supported/partial/conflicting fixtures; confidence is claim support only.

## T035 — Implement Contribution Attribution

**Planning status:** Retained in new Slice 4 with immutable confirmation and responsibility-period attribution.
**Execution status:** Complete for the Slice 2 employee-confirmed contribution context and responsibility-scoped evidence lineage.
**Priority:** P1
**Dependencies:** T030, T033
**Purpose:** Record individual/team contribution, peer acknowledgment, and objections.
**Verification:** no-response is not approval; disputed state persists.

## T036 — Implement Thursday Workstream Check-in

**Planning status:** Mapped to new Slice 5.
**Priority:** P1
**Dependencies:** T019, T030, T013
**Purpose:** Require a lightweight check-in only when no substantive update exists.
**Verification:** Thursday logic, leave exemption, update substitution, missing state.

## T037 — Implement Project Check-in Aggregation

**Planning status:** Mapped to new Slice 5.
**Priority:** P1
**Dependencies:** T036
**Purpose:** Summarize workstreams for Primary Project Owner.
**Verification:** cross-workstream issues visible; no duplicated details required.

## T038 — Create GitHub App Integration

**Planning status:** Mapped to new Slice 4 as a connector to Updates & Evidence and a versioned source binding to Projects.
**Priority:** P1
**Dependencies:** T007, T009
**Purpose:** Install scoped GitHub access.
**Verification:** installation flow; minimum permissions; token refresh; uninstall handling.

## T039 — Implement GitHub Webhook Ingestion

**Planning status:** Mapped to new Slice 4 with signature verification, durable idempotent receipt, reconciliation, and deterministic contract-rule processing.
**Priority:** P1
**Dependencies:** T038, T013
**Purpose:** Receive push, PR, and check events idempotently.
**Verification:** signature check; duplicate delivery; retry/replay.

## T040 — Implement GitHub Document Sync

**Planning status:** Mapped to new Slice 4 and limited to approved document bindings/versions.
**Priority:** P1
**Dependencies:** T023, T038, T039
**Purpose:** Track branch/path/commit and create document versions.
**Verification:** changed file sync; deleted/moved file state; missed-event reconciliation.

## T041 — Implement Suggested Evidence Inbox

**Planning status:** Mapped to new Slice 4; automatic Project progress and employee contribution remain separate, and employee confirmation remains mandatory for contribution evidence.
**Priority:** P1
**Dependencies:** T033, T039
**Purpose:** Show PRs, commits, and checks as suggestions requiring employee context.
**Verification:** acceptance/rejection; project reassignment; no automatic performance linkage.

## T042 — Build Update, Timeline, and Evidence UI

**Planning status:** Delivered incrementally across new Slices 1–5 rather than as a late standalone UI task.
**Priority:** P1
**Dependencies:** T030–T041
**Expected output:** Arabic-first responsive RTL screens with English support.
**Verification:** text/voice/image/GitHub e2e; accessibility and responsive behavior.

## T043 — Implement Monthly Evaluation Readiness Review

**Planning status:** Mapped to new Slice 5.
**Priority:** P1
**Dependencies:** T030, T033, T012, T036
**Purpose:** Surface thin evidence before quarter-end without creating update or evidence quotas.
**Expected output:** Employee monthly review of silent workstreams, unsupported artifact-based criteria, incomplete experiments, unapplied learning, unreviewed GitHub suggestions, and unresolved attribution.
**Likely areas:** updates, evidence, coaching/readiness, notifications, employee UI
**Verification:** No performance score or quota is produced; manager sees operational gaps only, not employee percentages or ranking; fixtures cover false-positive avoidance.

## T044 — Expand Arabic and Dialect AI Fixtures

**Planning status:** Distributed across new Slices 3–4 when the relevant prompt/schema or voice behavior changes; no unrelated fixture expansion.
**Priority:** P1
**Dependencies:** T012, T032
**Purpose:** Validate AI behavior on the language actually used by the pilot team.
**Expected output:** Fusha, Gulf, Levantine, mixed Arabic/English, Arabic PDF/DOCX, STT, update extraction, evidence, and report fixtures.
**Likely areas:** AI evaluation datasets, STT tests, document processing tests
**Verification:** All critical structured outputs validate; terminology is preserved; privacy and rating prohibitions hold in Arabic; regression thresholds documented.

---

# Phase 3 — Employee Evaluation

## T045 — Implement Evaluation Template Engine

**Execution status:** Complete — versioned activation, protected global ranges, and scoped administration verified.
**Priority:** P1
**Dependencies:** T010, T007
**Purpose:** Support global and department templates, mandatory criteria, ranges, and activation.
**Verification:** weight rules; version activation; department scope.

## T046 — Implement Cycle Creation and Snapshot

**Execution status:** Complete — Cycle 1 calibration type, eligibility, visibility, rubric, and template snapshots are frozen.
**Priority:** P1
**Dependencies:** T045
**Purpose:** Create quarterly cycles, freeze rubric and visibility configuration, and mark Cycle 1 as `Calibration — Non-Baseline`.
**Verification:** active-cycle mutation denied; assignments and dates correct; Cycle 1 cannot become an official baseline without an approved policy change.

## T047 — Implement Evidence Preparation

**Execution status:** Complete — consumes the existing neutral Fact View public boundary with responsibility/source scope.
**Priority:** P1
**Dependencies:** T046, T030, T033
**Purpose:** Gather period evidence, project/workstream context, responsibility windows, monthly-readiness gaps, and source-supported facts.
**Verification:** responsibility periods and criteria versions respected.

## T048 — Implement Self-Assessment

**Execution status:** Complete — source-bound drafts/submissions and post-rating AI wording are protected and audited.
**Priority:** P1
**Dependencies:** T046, T047
**Purpose:** Employee ratings, rationale, evidence, strengths, and development areas.
**Verification:** same anchors; AI help after rating only; draft autosave.

## T049 — Implement Independent Manager Assessment

**Execution status:** Complete — self projection remains inaccessible until the manager initial submission is frozen.
**Priority:** P1
**Dependencies:** T046, T047
**Purpose:** Manager initial draft without self-rating anchoring.
**Verification:** self-rating hidden until initial submission; observation basis supported.

## T050 — Implement Comparison and Discussion

**Execution status:** Complete — deterministic comparison and versioned source-authorized discussion are implemented.
**Priority:** P1
**Dependencies:** T048, T049
**Purpose:** Show gaps and prepare discussion agenda.
**Verification:** AI does not decide; disputed attribution shown accurately.

## T051 — Implement Finalization and Acknowledgment

**Execution status:** Complete — final human judgment, reservation, closure, and immutable snapshot are verified.
**Priority:** P1
**Dependencies:** T050
**Purpose:** Manager final rating, employee acknowledgment/reservation, closure.
**Verification:** no automatic averaging; reservation does not change rating; snapshot immutable.

## T052 — Build Employee Evaluation UI

**Execution status:** Technical verification surface complete; final product UX remains in the approved frontend program.
**Priority:** P1
**Dependencies:** T046–T051
**Expected output:** Arabic-first responsive RTL screens with English support.
**Verification:** complete employee/manager e2e cycle.

## T053 — Implement Evaluation Reports and Export

**Execution status:** Complete at the engine checkpoint — immutable employee/department/identified-upward projections, asynchronous encrypted export generation, current-access download audit, expiry, and revocation are verified. Arabic evaluation export remains correctly blocked at T016.
**Priority:** P2
**Dependencies:** T051
**Verification:** correct snapshot, calibration label, Arabic and English export, feedback visibility matches the frozen mode, export audit event.

## T054 — Implement Evaluation Fact View

**Execution status:** Complete — neutral source facts precede employee interpretation without readiness leakage or rating output.
**Priority:** P1
**Dependencies:** T047, T030, T033, T035, T012
**Purpose:** Reduce self-presentation bias by separating normalized source facts from employee interpretation.
**Expected output:** Fact View containing event, date, scope, responsibility window, claim, supported facts, unclear parts, result, verification, and attribution.
**Likely areas:** evaluation preparation, AI analysis, employee/manager evaluation UI
**Verification:** Manager can review normalized facts before narrative; original employee text remains available and labeled; AI does not add unsupported claims or ratings.

---

# Phase 4 — Identified Manager Evaluation and Coaching

## T055 — Implement Manager Evaluation Configuration

**Execution status:** Complete — five approved manager criteria, frozen `IDENTIFIED` policy, and disabled future-mode contracts are persisted and verified.
**Priority:** P1
**Dependencies:** T010, T046, T014
**Purpose:** Seed five manager criteria and freeze the selected feedback-visibility mode in the cycle.
**Expected output:** Manager rubric configuration and `Identified` pilot visibility snapshot.
**Likely areas:** manager evaluation domain, rubric config
**Verification:** Pilot cycle is Identified; mode cannot change after cycle opens; future modes are represented by configuration.

## T056 — Implement Identified Manager Evaluation Submissions

**Execution status:** Complete — one immutable/idempotent named five-criterion submission is enforced transactionally with explicit identified notice confirmation.
**Priority:** P1
**Dependencies:** T055, T007
**Purpose:** Allow employees to submit named criterion ratings and comments to the manager.
**Expected output:** Versioned employee submission linked to identity, ratings, comments, and timestamp.
**Likely areas:** manager evaluation API and database
**Verification:** Manager can read authorized submissions; employees cannot read peers’ submissions; UI/API do not claim anonymity.

## T057 — Implement Manager Completion and Response View

**Execution status:** Complete — the frozen manager receives immediate named originals and leave-aware completion; peers, administrators, and other managers are denied.
**Priority:** P1
**Dependencies:** T056, T014
**Purpose:** Show who submitted, who is pending, who is on approved leave, and what each employee rated.
**Expected output:** Manager-facing completion list and response detail.
**Likely areas:** manager dashboard, evaluation API
**Verification:** Submitted responses are visible immediately; leave does not block others; cycle eligibility is traceable.

## T058 — Implement Optional Manager Feedback Aggregation

**Execution status:** Complete — optional AI Router summaries are versioned, source-cited, support-bounded, limitation-bearing, and contain no manager rating or judgment.
**Priority:** P1
**Dependencies:** T056, T012
**Purpose:** Add trends and repeated themes without replacing identified responses.
**Expected output:** Criterion aggregates, repeated themes, strengths, improvement areas, and cross-cycle trends.
**Likely areas:** AI worker, reports, manager evaluation
**Verification:** Summaries link to source submissions, do not invent consensus, and do not assign an automatic manager judgment.

## T059 — Implement Future Feedback Visibility Mode Foundation

**Execution status:** Complete — private-mode policy/identity-link contracts exist but fail closed and cannot reuse the `IDENTIFIED` projection.
**Priority:** P2
**Dependencies:** T055, T007, T009
**Purpose:** Avoid hardcoding the pilot’s Identified choice and prepare Manager-Blinded and Anonymous Aggregated modes.
**Expected output:** Mode-aware permission contract, identity-link abstraction, conditional sensitive-access hooks, and tests.
**Likely areas:** permissions, manager evaluation, audit
**Verification:** Identified mode remains unchanged; contract tests prove future protected fields cannot leak when a private mode is enabled.

## T060 — Implement Coaching Insight Engine

**Status:** Complete — source-qualified runtime AI Router drafting, persisted route trace, manual recovery, and protected employee decision flow are verified.

**Priority:** P1
**Dependencies:** T030, T011, T012, T043
**Purpose:** Generate source-grounded, non-scoring coaching insights.
**Expected output:** Insights with pattern, sources, period, confidence, limits, and optional action.
**Likely areas:** coaching domain, worker, AI routing
**Verification:** No ratings, ranking, prediction, or activity-volume score; Arabic and English fixtures pass.

## T061 — Implement Personal Development Actions

**Status:** Complete — append-only persistence and protected action APIs are verified through the authenticated employee/private/share/manager-support journey.

**Priority:** P1
**Dependencies:** T060
**Purpose:** Support accept, modify, reject, defer, private/share, and status tracking.
**Expected output:** Employee-controlled personal actions and manager support for shared actions.
**Likely areas:** coaching and development domain
**Verification:** Manager cannot see private actions or rejection reasons; shared fields match approved rules.

## T062 — Implement Formal Development Plans

**Status:** Complete — employee approval, manager agreement, optimistic transitions, confirmed-evidence linking, and completion are verified through the authenticated journey.

**Priority:** P1
**Dependencies:** T051, T061
**Purpose:** Convert approved development needs into formal trackable plans.
**Expected output:** Development area, reason, activity, target date, evidence, owner, and status.
**Likely areas:** evaluation and development domain
**Verification:** Employee approval required for conversion; completion evidence and history retained.

## T063 — Build Manager Evaluation and Coaching UI

**Status:** Partial — protected API routes and localized technical checkpoint are implemented; production interaction screens remain required.

**Priority:** P1
**Dependencies:** T055–T062, T015
**Purpose:** Provide employee submission, manager identified-response view, optional aggregates, coaching, and development screens.
**Expected output:** Arabic-first RTL and English manager-evaluation/coaching experience.
**Likely areas:** web application
**Verification:** Manager sees pilot identity/status/ratings/comments; employees see clear Identified notice; future mode tests pass; RTL and accessibility pass.

---

# Phase 5 — Leave, Delegation, Offboarding, and Hardening

## T064 — Implement Leave Records

**Status:** Complete — minimal leave records, manager-scoped decisions, and neutral check-in/evaluation eligibility projection are verified.

**Priority:** P1
**Dependencies:** T014, T018
**Purpose:** Complete the leave workflow and connect approved leave to the earlier evaluation-eligibility foundation, check-ins, and delegation.
**Verification:** no HR balance logic; check-in and evaluation exemptions.

## T065 — Implement Handover

**Status:** Complete — append-only versioned handover items, exact-scope validation, employee confirmation, stale-version rejection, and sensitive-field rejection are verified.

**Priority:** P1
**Dependencies:** T064, T024
**Purpose:** Structured Handover with AI completeness review.
**Verification:** manager approves delegation, not technical truth.

## T066 — Implement Delegation and Acting Ownership

**Status:** Complete — normal/emergency activation, delegate access confirmation, gap blocking, and exact action/scope/time authorization are verified.

**Priority:** P1
**Dependencies:** T065, T020
**Purpose:** Delegate confirmation, emergency activation, full time-bounded authority.
**Verification:** original owner not attributed during leave; all actions marked.

## T067 — Implement Return Handover

**Status:** Complete — manager-direct return, append-only extension, immediate return, and real permanent responsibility transfer are verified.

**Priority:** P1
**Dependencies:** T066
**Verification:** original confirms; manager can finalize/extend/transfer; authority ends correctly.

## T068 — Implement Account Deactivation and Archiving

**Status:** Complete — scoped administrator deactivation is atomic with continuity-case creation, denies later authentication, and preserves user and historical records.

**Priority:** P1
**Dependencies:** T006, T020
**Purpose:** Disable access while preserving history.
**Verification:** authentication denied; historical records intact.

## T069 — Implement Reassignment Required

**Status:** Complete — atomically queued, deduplicated ownerless-work cases and manager-only permanent resolution through Projects are verified.

**Priority:** P1
**Dependencies:** T068, T018, T019
**Purpose:** Flag ownerless active work for manager decision.
**Verification:** admin cannot assign; manager resolves; critical alert.

## T070 — Implement Retention Configuration Foundation

**Status:** Complete — forward-only retention references require archive-only behavior and prohibit automatic deletion.

**Priority:** P2
**Dependencies:** T068
**Purpose:** Prepare configurable future retention without automatic deletion in pilot.
**Verification:** archive/hide does not break project history.

## T071 — Implement Notification Service

**Execution status:** Complete at the engine checkpoint — source-event dedupe, in-app delivery, email preferences/recovery, versioned Thursday/monthly schedules, and the notification BullMQ runtime are verified. The live email provider is an external deployment gate.

**Priority:** P1
**Dependencies:** T013
**Purpose:** In-app and email notifications.
**Verification:** deduplication, user preferences where allowed, Thursday reminders.

## T072 — Implement Dashboards

**Execution status:** Technical composition complete — existing employee/manager projections and the safe System Administrator operations projection are available; final daily-use frontend interaction design remains in the approved post-engine frontend program.

**Priority:** P1
**Dependencies:** Major feature tasks
**Purpose:** Employee, Manager, and System Administrator dashboards including monthly readiness, operational documentation states, and identified manager-feedback status.
**Verification:** no unauthorized data; manager sees identified pilot feedback; manager does not see employee Documentation Readiness percentages or ranking; RTL and English layouts pass.

## T073 — Implement Observability and System Health

**Execution status:** Complete at the bounded engine checkpoint — live dependency probes feed runtime signals/action alerts; safe dependency health, correlation, and job/provider recovery states are verified. Production telemetry destination remains a deployment gate.

**Priority:** P2
**Dependencies:** T005, T013
**Verification:** metrics, traces, job health, provider health, alerting.

## T074 — Security and Privacy Hardening

**Execution status:** Complete at the E6C technical checkpoint — 46 protected controllers map to 25 rows with allow/deny/audit evidence, retention is organization/resource/time scoped, unknown structured log fields fail closed to redaction, and future-private-mode and incident/revocation controls are verified. Production credentials and telemetry remain external gates.

**Priority:** P0
**Dependencies:** All protected features
**Purpose:** Threat modeling, permission testing for all feedback-visibility modes, encryption review, prompt-injection controls, and Arabic input safety.
**Verification:** privacy test suite and security review pass.

## T075 — Backup and Restore Drill

**Execution status:** Complete for the protected local-isolated drill — signed encrypted PostgreSQL/object/config bundles restore into a new local database/filesystem target and are verified by live protected-row, foreign-key, append-only-control, and hash comparisons. Shared or production restore remains a direct human gate; production destination and key custody remain external gates.

**Priority:** P0
**Dependencies:** T004, T022
**Verification:** restore database and object storage; validate audit and evaluation integrity.

## T076 — Pilot Dry Run

**Execution status:** Complete at the technical engine checkpoint — the English simulated-quarter stages and cross-engine browser journey pass; Arabic evaluation remains gated and final frontend/product acceptance remains the next program after E7.

**Priority:** P0
**Dependencies:** T001–T015, T017–T075
**Purpose:** Run one full `Calibration — Non-Baseline` simulated quarter with English test users and realistic projects; include Arabic test users only after T016 approval.
**Verification:** all English critical workflows pass; identified manager-feedback behavior is understood; monthly readiness and Fact View are reviewed; issues logged and resolved. Arabic release validation remains conditional on T016 approval.

## T077 — Production Pilot Launch

**Execution status:** Not started — E7 is complete; blocked by final frontend/customer-journey acceptance, Product Owner launch approval, and the external production gates recorded in `docs/operations/EXTERNAL_GATE_REGISTER.md`.

**Priority:** P0
**Dependencies:** T076
**Purpose:** Deploy approved pilot.
**Verification:** production checklist, monitoring, backups, identified-feedback notice, onboarding, and rollback plan. Arabic rubric approval and RTL release validation are required only before Arabic employee use.

---

# Phase 6 — AI-Native Frontend Foundation and Gate G0

## T078 — Freeze Frontend Architecture and Exact Handoffs

**Status:** Complete — ADRs and machine-validated Phase 1–2 handoffs are committed.
**Priority:** P0
**Dependencies:** T076
**Purpose:** Prevent the frontend from recreating engine truth or inventing commands.
**Verification:** capability, event, and handoff validators pass with exact repository references.

## T079 — Build Command Brief Tokens and Styling Foundation

**Status:** Complete — semantic design, density, motion, contrast, RTL, and legacy-compatibility tokens are available.
**Priority:** P1
**Dependencies:** T078
**Purpose:** Establish the selected visual direction without migrating temporary routes prematurely.
**Verification:** token contract, UI typecheck, and web build pass.

## T080 — Adopt the Accessible Primitive Suite

**Status:** Complete — owned wrappers and compatibility evidence cover keyboard, focus, dialog, RTL, reduced motion, and server rendering.
**Priority:** P1
**Dependencies:** T079
**Purpose:** Standardize accessible product interactions behind owned interfaces.
**Verification:** focused primitive tests, lint, typecheck, and build pass.

## T081 — Add Storybook and Visual Review Infrastructure

**Status:** Complete — Command Brief stories, browser accessibility tests, states, and design-QA evidence are available.
**Priority:** P1
**Dependencies:** T080
**Purpose:** Make visible frontend behavior reviewable before broad migration.
**Verification:** Storybook tests/build, desktop/mobile/RTL capture, and design-QA pass.

## T082 — Enforce Frontend and Telemetry Boundaries

**Status:** Complete — new code cannot import domain persistence, server internals, provider SDKs, or protected telemetry paths.
**Priority:** P0
**Dependencies:** T078, T080
**Purpose:** Keep the browser a presentation/composition client and telemetry non-authoritative.
**Verification:** rejection fixtures, repository validator, lint, and builds pass.

## T083 — Establish the Role-Aware Stable Shell

**Status:** Complete — employee/manager navigation, locale/auth, loading/error recovery, desktop, and 390px RTL shell journeys are verified.
**Priority:** P1
**Dependencies:** T081, T082
**Purpose:** Wrap existing routes in the approved Command Brief shell without simulating Phase 1 behavior.
**Verification:** 30 focused unit/localization tests, five Storybook tests, four authenticated E2E journeys, lint, typecheck, build, and visual comparison pass.

## T084 — Protect Inspection Mode and Inventory Route Retirement

**Status:** Complete — a fail-closed operational trace contract and 20/20 temporary-route ledger are verified.
**Priority:** P0
**Dependencies:** T078, T082, T083
**Purpose:** Support safe internal diagnosis without secrets, private content, readiness values, rating influence, or premature route deletion.
**Verification:** focused contract/ledger tests, administrator authorization references, privacy remediation re-review, boundaries, route ledger, and secret scan pass.

## T085 — Publish the Executable Phase 1 Graph

**Status:** Complete — the ordered T087–T094 vertical-slice plan and machine-checked coverage graph are published.
**Priority:** P1
**Dependencies:** T078–T084
**Purpose:** Make every Phase 1 slice visible, source-backed, reversible, testable, and reviewable.
**Verification:** task graph, Phase 1 coverage test, exact handoff/capability mapping, demos, screenshots, rollback, and Product Owner gates.

## T086 — Prove Gate G0

**Status:** Complete — Product Owner approved G0 on 2026-08-11, accepted the recorded participant overlap, and authorized Phase 1 execution.
**Priority:** P0
**Dependencies:** T078–T085
**Purpose:** Run the frontend-foundation acceptance matrix once and stop for the Product Owner decision.
**Verification:** G0 evidence, human employee/manager sessions, full affected frontend checks, rollback proof, and explicit statement that Phase 1 runtime has not started.

---

# Phase 7 — AI-Native Frontend Phase 1 Vertical Slices

## T087 — Implement Universal Capture and Manual Recovery

**Status:** Complete — bounded manual-first private capture is verified in the authenticated product.
**Priority:** P1
**Dependencies:** T086
**Purpose:** Deliver one compact text/link/file capture flow with private-Inbox fallback.
**Verification:** real capture-to-confirmation demo, allow/deny tests, English/Arabic desktop/mobile evidence, and rollback.

## T088 — Implement Work Signals and Experience Events

**Status:** Complete — authorized Work Signals now drive an owner-filtered What Changed experience with durable recovery and telemetry isolation.
**Priority:** P0
**Dependencies:** T087
**Purpose:** Refresh authorized experience state while keeping telemetry non-authoritative.
**Verification:** versioning, idempotency, wrong-user exclusion, replay/recovery, and boundary tests.

## T089 — Implement the Minimal Experience Orchestrator

**Status:** Complete — one authorized source-backed proposal is prepared through the governed AI Router or a truthful deterministic fallback, with semantic quarantine and no command authority.
**Priority:** P0
**Dependencies:** T088
**Purpose:** Prepare one source-backed next action above the existing AI Router.
**Verification:** one-action limit, source/why/freshness/consequence, fallback, privacy, and no-rating tests.

## T090 — Implement Intelligent Today and One Decision Path

**Status:** Complete — Intelligent Today now composes the real authorized daily snapshot, one prepared item, and one protected confirm/correct/dismiss path with stale recovery and rollback.
**Priority:** P1
**Dependencies:** T089
**Purpose:** Deliver Needs Your Action, Today, Overdue, prepared work, and one real confirm/correct/dismiss journey.
**Verification:** authenticated employee journey, stale recovery, accessibility, RTL, protected command allow/deny, screenshots, and rollback.

## T091 — Implement What Changed and Durable SSE

**Status:** Complete — authorized durable SSE replay, bounded recovery, and the Arabic product journey are verified.
**Priority:** P1
**Dependencies:** T090
**Purpose:** Show concise authorized receipts with reconnect and exactly-once visible behavior.
**Verification:** ordered replay, idempotent cursor, wrong-user isolation, offline recovery, and session-expiry tests.

## T092 — Migrate Work List and Task Detail with Parity

**Status:** Complete — authenticated Arabic desktop/mobile list, task-detail, create, and valid transition journeys are accepted; retained Board, Calendar, and legacy routes remain available for rollback.
**Priority:** P1
**Dependencies:** T091
**Purpose:** Provide compact daily task management without losing existing Work Item behavior.
**Verification:** create/transition parity, drawer focus, URL state, mobile/RTL, retained-route rollback, and Product Owner review.

## T093 — Connect the First Real Source-to-Command Journey

**Status:** Complete — real Google/manual review, explicit evidence confirmation, GitHub confirmation gates, owner privacy, manager exclusion, recovery, and rollback are verified.
**Priority:** P0
**Dependencies:** T092
**Purpose:** Join Google, GitHub, and manual context through explicit employee review and evidence confirmation.
**Verification:** owner-only privacy, uncertainty review, no automatic evidence/contribution, connector fallback, E2E demo, and rollback.

## T094 — Run Phase 1 Acceptance and Route-Retirement Decision

**Status:** Awaiting Product Owner — the complete employee journey, manager-safe home, rollback, and parity evidence pass; no route is retired and no Phase 1 pull request is merged pending the protected decision.
**Priority:** P0
**Dependencies:** T087–T093
**Purpose:** Prove the complete daily journey, protected manager shell, rollback, and route parity before controlled retirement.
**Verification:** end-to-end customer journey, authorization matrix, affected full web suite, screenshots, acceptance report, and explicit Product Owner decision.

---

# Phase 8 — Final AI-Native Employee Experience

## T095 — Freeze Final Screen Contracts and Rollback

**Status:** Complete — closed screen contracts, independent rollback flags, and final-UI source boundaries are verified.
**Priority:** P1
**Dependencies:** T094
**Purpose:** Define one typed presentation/composition model for Home, Project, Work, Capture, and Review without moving domain authority into the browser.
**Verification:** screen-contract tests, capability mapping, feature flags, localization parity, and focused boundary validation.

## T096 — Build the Final Home Overview

**Status:** Not started
**Priority:** P1
**Dependencies:** T095
**Purpose:** Replace the temporary employee Today composition with the approved multi-Project overview, circular confirmed progress, milestone/KPI context, Smart Brief, and Now timeline.
**Verification:** source-backed progress states, no employee scoring, desktop/mobile/RTL rendering, accessibility, and rollback.

## T097 — Build the Final Project Workspace

**Status:** Not started
**Priority:** P1
**Dependencies:** T095, T096
**Purpose:** Connect purpose, approved progress, milestones, KPI, Work, Updates, Evidence, Documents, and Timeline around one Project.
**Verification:** authorized readers only, truthful missing/stale states, compact desktop/mobile layout, and no automatic progress mutation.

## T098 — Align Work with the Approved Daily Hierarchy

**Status:** Not started
**Priority:** P1
**Dependencies:** T095, T096
**Purpose:** Present Needs My Action, Today, Overdue, waiting, and upcoming Tasks with the existing authoritative Task drawer and transitions.
**Verification:** create/transition parity, current selection, source context, assistant next step, mobile/RTL, and retained Board/Calendar routes.

## T099 — Build the Intelligent Universal Capture Journey

**Status:** Not started
**Priority:** P0
**Dependencies:** T095–T098
**Purpose:** Let the employee share text, voice, URL, image, code, or file; prepare one source-backed interpretation; ask one missing question at a time; and preserve a private fallback.
**Verification:** AI Router-only assistance, untrusted-input controls, no official write before confirmation, manual/provider recovery, localization, and accessibility.

## T100 — Build Review & Confirmation

**Status:** Not started
**Priority:** P0
**Dependencies:** T099
**Purpose:** Separate editable Update, selectable Evidence, contribution context, and progress proposal so the employee confirms only the intended actions and official progress still follows its owning rule.
**Verification:** employee edit/confirmation gates, independent owner confirmation, stale recovery, append-only Timeline result, and no rating/progress shortcut.

## T101 — Run the Final Employee Journey Acceptance

**Status:** Not started
**Priority:** P0
**Dependencies:** T096–T100
**Purpose:** Prove Home → Project → Work → Capture → Clarify → Review & Confirmation as one realistic customer journey before route retirement or merge.
**Verification:** authenticated desktop/mobile English plus Arabic/RTL foundation, keyboard/a11y, connector and AI fallback, protected-boundary tests, screenshots, rollback, Product Owner acceptance, commit, push, and PR update.
---

# Approval-Blocked Changes

The following are not normal tasks and require explicit approval:

- Change protected product rules.
- Change Version 1 rubric, anchors, or weights.
- Release Arabic employee evaluation before the Arabic rubric is approved and semantically reviewed; English-only employee evaluation is permitted.
- Allow AI ratings or rating recommendations.
- Change the pilot upward manager evaluation from `Identified`.
- Claim anonymity while the active mode is Identified.
- Expose individual Documentation Readiness percentages or readiness ranking to the manager.
- Remove `Calibration — Non-Baseline` status from Cycle 1.
- Add employee ranking.
- Add payroll, promotion, or disciplinary automation.
- Apply criteria retroactively.
- Modify closed evaluations.
- Split into microservices.
- Delete historical records.
