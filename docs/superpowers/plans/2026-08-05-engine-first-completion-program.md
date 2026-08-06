# Engine-First Completion Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for routine bounded bundles and `superpowers:subagent-driven-development` only for authentication, privacy, audit integrity, database migrations, concurrency, historical immutability, AI Router boundaries, evaluation finalization, and protected product rules. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete and verify the full pilot engine, inventory every capability, and hand a stable, traceable system contract to a later dedicated full-frontend program.

**Architecture:** Preserve the modular monolith, PostgreSQL, Keycloak/OIDC, AI Router, audit path, and current domain ownership. Finish the engine through bounded subsystem plans and public module contracts; use only minimal verification surfaces until the final frontend program begins. Maintain a feature register throughout so the frontend is designed from actual capabilities rather than backend packages or temporary screens.

**Tech Stack:** TypeScript 7, Node.js 24.18.0, pnpm 11.13.0, NestJS, Next.js App Router verification surfaces, React, Prisma/PostgreSQL, Redis/BullMQ, MinIO, Zod, Vitest, Playwright, Keycloak/OIDC, existing AI Router.

## Global Constraints

- Preserve every protected rule in `AGENTS.md`.
- AI never assigns, predicts, recommends, normalizes, or challenges an employee or manager rating.
- AI may measure operational Project/Workstream progress only through an active, human-approved Progress Contract and confirmed source facts.
- Research volume, experiment count, task count, update frequency, GitHub activity, commits, files, and lines changed never become progress or performance scores.
- Employee-confirmed interpretation stays separate from source-supported facts.
- Keep one database, one authentication system, one audit path, and one evidence lifecycle.
- Do not create the final frontend during engine completion. Minimal screens and browser fixtures exist only to verify contracts and protected journeys.
- Maintain the feature register during implementation; perform a final source-to-code audit before frontend design.
- Use Fast Controlled Execution and durable commit/push/PR checkpoints.
- Stop only at a protected product-rule decision, unavoidable external credential or administrator gate, destructive external operation, unresolved P0/P1 blocker, or mandatory direct human approval.
- English-only pilot use remains permitted. Arabic employee evaluation remains blocked until the approved Arabic rubric and semantic review exist; Arabic/RTL foundations remain required.

---

## Program Map

```text
E0  Slice 5 technical closure and merge
 └─ E1  Phase 2 Slice 6 neutral Fact View preparation
     └─ E2  Engine feature register and capability baseline
         ├─ E3  Research & Experiments engine
         ├─ E4  Employee Evaluation engine
         ├─ E5  Identified Manager Evaluation + Coaching engine
         └─ E6  Leave, Delegation, Notifications, Operations, and Hardening
             └─ E7  Final engine audit and frontend handoff
                 └─ Separate Full Frontend Program
```

E3–E6 are separate subsystems. Each receives its own bounded design and implementation plan before production code changes. This master plan controls order, shared constraints, readiness, and handoff; it does not replace those subsystem plans.

---

### Task E0: Close Slice 5 as a technical checkpoint

**Files:**

- Modify: `docs/acceptance/AI_FIRST_DAILY_WORKSPACE_SLICE_5.md`
- Modify: `TASKS.md`
- Modify: `project-state/PROJECT_STATE.md`
- Modify: `docs/superpowers/plans/2026-07-20-ai-first-daily-workspace-master-plan.md`
- Verify: Pull Request #10 and branch `codex/phase-2-slice-5-operational-readiness`

**Interfaces:**

- Consumes: verified Slice 5 commit and `docs/superpowers/specs/2026-08-05-technical-completion-frontend-product-acceptance-design.md`.
- Produces: merged `main` containing Slice 5 and the approved engine-first sequencing decision.

- [ ] **Step 1: Replace the false UX/Product Owner acceptance gate**

  Edit the Slice 5 acceptance document so its gate states that owner setup, employee pulse, readiness,
  and manager queues are technically verified provisional surfaces. Remove any requirement for the
  Product Owner to judge usability before the final frontend exists.

- [ ] **Step 2: Align status and next action**

  Mark P2R-S5 technically complete in `TASKS.md`. Update `PROJECT_STATE.md` so the next action is merge
  of Pull Request #10 followed by Slice 6 technical execution. Preserve the external Google/GitHub and
  Arabic rubric gates.

- [ ] **Step 3: Correct the old master-plan acceptance language**

  In the AI-first Daily Workspace master plan, change slice checkpoints from Product Owner UX approval
  to technical acceptance and reference the engine-first decision. Do not rewrite completed slice
  behavior.

- [ ] **Step 4: Run documentation and graph verification**

  Run:

  ```bash
  pnpm validate:task-graph
  pnpm format:check
  git diff --check
  ```

  Expected: every command exits `0`; task graph remains 77 authoritative tasks until an approved task
  alignment adds the Research & Experiments execution checkpoint.

- [ ] **Step 5: Commit and push the transition checkpoint**

  ```bash
  git add docs/acceptance/AI_FIRST_DAILY_WORKSPACE_SLICE_5.md \
    docs/superpowers/plans/2026-07-20-ai-first-daily-workspace-master-plan.md \
    TASKS.md project-state/PROJECT_STATE.md
  git commit -m "docs: close slice 5 as technical checkpoint"
  git push
  ```

- [ ] **Step 6: Verify Pull Request #10 and merge**

  Confirm local HEAD, remote branch HEAD, and PR head are identical. Require `integrity`, `quality`,
  `build`, and `integration` to pass on that commit. Merge Pull Request #10 into `main` using the
  repository's normal merge strategy; do not remove the worktree until merged `main` is verified.

- [ ] **Step 7: Verify merged main**

  Fetch `main`, confirm the merge contains the engine-first decision and Slice 5 commits, and run the
  hosted required checks on the merged result. Preserve the Slice 5 worktree until the merge is green.

---

### Task E1: Complete Phase 2 Slice 6 technically

**Files:**

- Modify: `docs/superpowers/plans/2026-07-20-slice-6-evaluation-preparation.md`
- Execute: `docs/superpowers/plans/2026-07-20-slice-6-evaluation-preparation.md`
- Modify: `TASKS.md`
- Modify: `project-state/PROJECT_STATE.md`
- Create: `docs/acceptance/AI_FIRST_DAILY_WORKSPACE_SLICE_6.md`

**Interfaces:**

- Consumes: public authorized readers from Projects, Work Items, Updates & Evidence, Documents,
  criteria, responsibility history, check-ins, and approved-leave eligibility.
- Produces: read-only `EvaluationFactView` contracts and protected API suitable for the future employee
  and manager evaluation engine.

- [x] **Step 1: Amend only execution metadata in the existing Slice 6 plan**

  Replace stale Pull Request #5 references with a new branch/PR based on verified `main`. State that the
  Slice 6 UI is a contract-verification surface, not final frontend or product acceptance. Preserve every
  Fact View neutrality, privacy, and no-rating requirement.

- [x] **Step 2: Execute S6-T1 through S6-T5**

  Follow the existing plan task-by-task with TDD. Use one specification review and one
  privacy/neutrality review. Remediate only confirmed P0/P1 findings and re-review only those findings.

- [x] **Step 3: Verify Phase 2 completion**

  Run the exact full checkpoint:

  ```bash
  pnpm verify
  pnpm test:integration
  pnpm test:ai
  pnpm db:verify
  pnpm test:e2e
  git diff --check
  ```

  Expected: all required suites pass; intentional skips are enumerated; no AI-rating, ranking,
  productivity, automatic Project average, or manager-visible readiness-percentage field exists.

- [x] **Step 4: Publish a technical acceptance checkpoint**

  Document source composition, privacy projections, historical responsibility behavior, test evidence,
  provisional verification routes, and known limitations. Commit, push, update the Slice 6 PR, and merge
  only after required hosted checks pass.

---

### Task E2: Establish the engine feature register and capability baseline

**Files:**

- Create: `docs/product/ENGINE_FEATURE_REGISTER.md`
- Create: `docs/product/ENGINE_CAPABILITY_MATRIX.md`
- Create: `docs/product/ENGINE_FRONTEND_HANDOFF_SCHEMA.md`
- Modify: `project-state/SYSTEM_MAP.html`
- Modify: `TASKS.md`
- Modify: `project-state/PROJECT_STATE.md`

**Interfaces:**

- Consumes: `PROJECT_REFERENCE.md`, `EVALUATION_RUBRIC.md`, `IMPLEMENTATION_PLAN.md`, all 77 master tasks,
  active specifications/plans, module exports, API routes, migrations, tests, and acceptance reports.
- Produces: one traceable inventory row per user capability and a gap list that controls E3–E7.

- [x] **Step 1: Define the feature-register record**

  `ENGINE_FEATURE_REGISTER.md` must use these exact fields for every capability:

  ```text
  ID | Capability | User roles | User goal | Authoritative sources | Owner module |
  Inputs/sources | AI role | AI prohibitions | Human gate | States/transitions |
  Public API/events | Authorization/privacy | Audit/history | Failure/recovery |
  Tests | Status | External gate | Frontend implications
  ```

  Allowed status values are exactly `COMPLETE`, `PARTIAL`, `PLANNED`, `EXTERNAL_GATE`, `DEFERRED_APPROVED`,
  and `SUPERSEDED`.

- [x] **Step 2: Inventory authoritative capabilities before inspecting screens**

  Map the project reference and T001–T077 into capability rows. Include daily workspace, Project progress,
  connected sources, research/experiments, evaluation, upward manager evaluation, coaching/development,
  leave/delegation, notifications, exports, administration, observability, backup/restore, and launch
  readiness. Do not treat an existing screen as proof that a capability is complete.

- [x] **Step 3: Trace capabilities to implementation evidence**

  For every row, cite exact packages, API modules, migrations, tests, and acceptance documents. A row is
  `COMPLETE` only when its protected behavior and recovery are implemented and tested. Mark missing
  production adapters as `EXTERNAL_GATE`, not `COMPLETE` or failed.

- [x] **Step 4: Build the capability matrix**

  `ENGINE_CAPABILITY_MATRIX.md` groups rows by employee, Project owner, manager, administrator, and system
  operations. It must expose missing dependencies, duplicated concepts, provisional UI-only behavior,
  and engine capabilities with no future journey entry point.

- [x] **Step 5: Define the frontend handoff schema**

  `ENGINE_FRONTEND_HANDOFF_SCHEMA.md` defines the per-capability information the later frontend program
  consumes: primary action, information priority, related capabilities, responsive needs, localization,
  accessibility, notification behavior, empty/error/recovery states, and protected visibility.

- [x] **Step 6: Update the system map and task graph**

  Add the engine-first sequence and feature-register flow to `SYSTEM_MAP.html`. Add traceable execution
  checkpoints for approved missing engine capabilities without renumbering or weakening T001–T077.

- [x] **Step 7: Verify and checkpoint**

  Run:

  ```bash
  pnpm validate:task-graph
  pnpm scan:performance-inputs
  pnpm scan:ai-boundary
  pnpm format:check
  git diff --check
  ```

  Review every `COMPLETE` claim against a cited test or acceptance artifact. Commit and push the baseline.

---

### Task E3: Design and implement the Research & Experiments engine

**Files:**

- Create: `docs/superpowers/specs/2026-08-05-research-experiments-engine-design.md`
- Create: `docs/superpowers/plans/2026-08-05-research-experiments-engine.md`
- Modify: `docs/product/ENGINE_FEATURE_REGISTER.md`
- Modify: `docs/product/ENGINE_CAPABILITY_MATRIX.md`
- Production files: specified exactly by the approved bounded design after the existing Work Items and
  Updates & Evidence ownership audit.

**Interfaces:**

- Consumes: Project/Workstream context, Tasks, Updates & Evidence, documents, criteria versions,
  responsibility windows, storage/upload safety, AI Router, audit, and Timeline public interfaces.
- Produces: authorized, versioned research questions, experiment methods, results, conclusions,
  decisions, applied learning, evidence links, and public readers for evaluation preparation.

- [x] **Step 1: Audit existing ownership before choosing a module**

  Prove whether the current Work Items and Updates & Evidence schemas can represent the approved research
  lifecycle without JSON blobs, duplicate evidence, cross-module table reads, or overloaded event types.
  Record the decision: extend the existing domains, or add one bounded Research & Experiments domain.

- [x] **Step 2: Write and approve the bounded design**

  The design must define question/hypothesis, assumptions, baseline, measures, test cases, controls,
  conditions, inputs/models/versions, result, failure/limits, reproducibility, employee-confirmed
  conclusion/decision, next experiment/applied learning, evidence, collaborators, responsibility period,
  and append-only history. It must explicitly prohibit volume-based scoring.

- [x] **Step 3: Write the detailed TDD implementation plan**

  The plan must name exact files, migrations, public interfaces, authorization tests, AI schema/evaluation
  fixtures, recovery behavior, and technical browser journey. It must use the standard writing-plans
  header and contain no final frontend implementation.

- [ ] **Step 4: Execute, review, and verify**

  Use Subagent-Driven Development only for its migration, AI-boundary, privacy, and historical-integrity
  tasks; use inline executing-plans for routine work. Require one specification review and one
  security/integrity review, bounded P0/P1 remediation, migration verification, AI evaluations, and a
  deterministic research-to-decision journey.

- [ ] **Step 5: Update the feature register**

  Mark each Research & Experiments row using verified evidence. Preserve gaps and external gates rather
  than inflating completion.

---

### Task E4: Complete the Employee Evaluation engine

**Files:**

- Create: `docs/superpowers/specs/2026-08-05-employee-evaluation-engine-design.md`
- Create: `docs/superpowers/plans/2026-08-05-employee-evaluation-engine.md`
- Modify: `docs/product/ENGINE_FEATURE_REGISTER.md`
- Modify: `docs/product/ENGINE_CAPABILITY_MATRIX.md`
- Trace: `TASKS.md` tasks T045–T054

**Interfaces:**

- Consumes: approved rubric configuration, eligibility, evaluation Fact View, source evidence,
  responsibility windows, criteria versions, identity/permissions, audit, AI Router, and notifications.
- Produces: cycle/template snapshots, evidence preparation, self-assessment, independent manager draft,
  comparison/discussion, manager final decision, acknowledgment/reservation, immutable closure, and report
  data contracts.

- [x] **Step 1: Write the bounded engine design**

  Cover T045–T054 backend behavior without final frontend. Preserve `Calibration — Non-Baseline`, active
  template and closed-evaluation immutability, identical employee/manager anchors, manager-draft
  independence, AI help only after a human rating selection, and manager final human judgment.

- [x] **Step 2: Write the detailed TDD plan**

  Split by template/cycle snapshot, evidence preparation, self-assessment, manager assessment,
  comparison/discussion, finalization, and reporting contracts. Each protected task includes positive and
  negative authorization tests and transaction/immutability verification.

- [ ] **Step 3: Execute through technical checkpoints**

  Use critical reviews for evaluation finalization, privacy, audit, AI boundaries, and migrations. Use
  minimal API clients or verification routes only; do not establish final navigation or visual design.

- [ ] **Step 4: Prove a complete engine-level cycle**

  Run a realistic `Calibration — Non-Baseline` cycle from creation through immutable closure without
  direct database edits. Assert that AI never writes a rating and that manager final judgment remains
  independent and human-controlled.

- [ ] **Step 5: Update the feature register**

  Trace every T045–T054 capability to implementation and test evidence.

---

### Task E5: Complete Identified Manager Evaluation and Coaching engines

**Files:**

- Create: `docs/superpowers/specs/2026-08-05-identified-manager-evaluation-engine-design.md`
- Create: `docs/superpowers/specs/2026-08-05-coaching-development-engine-design.md`
- Create: `docs/superpowers/plans/2026-08-05-identified-manager-evaluation-engine.md`
- Create: `docs/superpowers/plans/2026-08-05-coaching-development-engine.md`
- Modify: `docs/product/ENGINE_FEATURE_REGISTER.md`
- Modify: `docs/product/ENGINE_CAPABILITY_MATRIX.md`
- Trace: `TASKS.md` tasks T055–T063

**Interfaces:**

- Consumes: frozen cycle visibility mode, identified eligible submitters, completed employee evaluations,
  source-supported coaching inputs, AI Router, permissions, audit, and notifications.
- Produces: identified upward submissions, completion state, authorized response detail, optional grounded
  aggregates, non-scoring coaching insights, employee-controlled actions, and formal development plans.

- [x] **Step 1: Design the active Identified-mode engine**

  The manager can see identity, completion status, ratings, comments, and timestamps. The product makes
  no anonymity claim. Future modes remain configurable and fail closed without changing the active pilot.

- [x] **Step 2: Design coaching and development boundaries**

  Coaching has source references, confidence limits, and optional actions but no rating, rank, prediction,
  or productivity score. Private employee actions and rejection reasons remain private until explicitly
  shared.

- [x] **Step 3a: Write the two detailed TDD plans**

  The identified manager-evaluation and coaching/development plans name exact contracts, migration
  ownership, privacy and authorization tests, AI schema evaluations, recovery behavior, technical
  verification journeys, and their separate checkpoints.

- [ ] **Step 3b: Execute T055–T063 backend contracts**

  Use separate technical checkpoints for visibility/privacy and coaching/development. Defer final screens
  while preserving complete APIs, states, authorization, and recovery.

- [ ] **Step 4: Verify and register**

  Prove identified visibility, peer isolation, leave-aware completion, future-mode field isolation,
  source-grounded summaries, and private/shared development behavior. Update feature evidence.

---

### Task E6: Complete operational lifecycle and production-hardening engines

**Files:**

- Create: `docs/superpowers/specs/2026-08-05-continuity-offboarding-engine-design.md`
- Create: `docs/superpowers/specs/2026-08-05-notifications-reporting-administration-engine-design.md`
- Create: `docs/superpowers/specs/2026-08-05-security-recovery-readiness-engine-design.md`
- Create: `docs/superpowers/plans/2026-08-05-continuity-offboarding-engine.md`
- Create: `docs/superpowers/plans/2026-08-05-notifications-reporting-administration-engine.md`
- Create: `docs/superpowers/plans/2026-08-05-security-recovery-readiness-engine.md`
- Modify: `docs/product/ENGINE_FEATURE_REGISTER.md`
- Modify: `docs/product/ENGINE_CAPABILITY_MATRIX.md`
- Trace: `TASKS.md` tasks T064–T077

**Interfaces:**

- Consumes: identity, responsibility windows, Projects/Workstreams, audit, storage, queues, notifications,
  evaluation snapshots, manager-feedback visibility, and deployment infrastructure.
- Produces: leave exclusions, handover, time-bounded delegation, return, reassignment-required state,
  deactivation/history preservation, retention foundation, notifications, report/export contracts,
  observability, hardened privacy/security, backup/restore evidence, and pilot dry-run readiness.

- [x] **Step 1: Separate engine scope from final frontend scope**

  Implement domain, API, integration, operational, and security behavior for T064–T077. Defer final
  dashboards and visual reports to the frontend program while completing their authorized read/export
  contracts.

- [x] **Step 2: Write the bounded designs**

  Preserve time-bounded authority, historical foreign keys, manager-only reassignment, audit-before-read
  for future private modes, and forward-only migration rules. Specify operational drills separately from
  feature code.

- [x] **Step 2b: Write the three detailed TDD plans**

  The continuity/offboarding, notifications/reporting/administration, and
  security/recovery/readiness plans name exact contracts, migrations, protected tests, operational
  drills, external gates, and technical checkpoints.

- [ ] **Step 3: Execute lifecycle services**

  Verify approved leave, handover, delegate confirmation, acting authority, return, deactivation,
  reassignment, retention/archive behavior, notification idempotency, and authorized exports.

- [ ] **Step 4: Execute hardening and drills**

  Complete threat modeling, protected-mode permission tests, prompt-injection controls, observability,
  backup/restore drill, and a technical pilot dry run. External production credentials or administrator
  approval remain explicit gates rather than simulated completion.

- [ ] **Step 5: Update the feature register**

  Record drill evidence, remaining external gates, and every intentionally deferred frontend surface.

---

### Task E7: Audit the completed engine and hand off to full frontend design

**Files:**

- Create: `docs/superpowers/specs/2026-08-05-engine-integration-audit-design.md`
- Create: `docs/superpowers/plans/2026-08-05-engine-integration-audit.md`
- Modify: `docs/product/ENGINE_FEATURE_REGISTER.md`
- Modify: `docs/product/ENGINE_CAPABILITY_MATRIX.md`
- Modify: `docs/product/ENGINE_FRONTEND_HANDOFF_SCHEMA.md`
- Create: `docs/reviews/ENGINE_COMPLETION_AUDIT.md`
- Create: `docs/product/ENGINE_CUSTOMER_JOURNEY_MAP.md`
- Modify: `project-state/SYSTEM_MAP.html`
- Modify: `project-state/PROJECT_STATE.md`
- Modify: `TASKS.md`

**Interfaces:**

- Consumes: all completed engine PRs, migrations, APIs, events, AI routes/schemas, tests, acceptance
  reports, operational drills, and external-gate records.
- Produces: approved engine completion evidence and the authoritative input to a separate full-frontend
  brainstorming/specification process.

- [x] **Step 0: Approve the bounded integration-audit design**

  Define capability reconciliation, bidirectional trace, cross-domain seams, employee/manager/admin
  journeys, restore integrity, extensibility audit, and the exact `READY_FOR_FINAL_FRONTEND_DESIGN` gate.

- [x] **Step 0b: Write the detailed integration-audit plan**

  The audit plan defines exact trace artifacts, complete fixtures, cross-role journeys, verification
  commands, two bounded independent reviews, remediation limits, and the final handoff decision.

- [ ] **Step 1: Reconcile every capability row**

  No row may remain `PLANNED` when the engine is declared complete. Resolve it to `COMPLETE`, `PARTIAL`,
  `EXTERNAL_GATE`, `DEFERRED_APPROVED`, or `SUPERSEDED`, with cited evidence and a reason.

- [ ] **Step 2: Run source-to-code and code-to-source audits**

  Confirm every authoritative pilot requirement maps to an engine capability, and every public engine
  capability maps to an approved requirement. Flag orphan features, duplicate concepts, hidden coupling,
  and package boundaries that would leak into the future user experience.

- [ ] **Step 3: Build the customer-journey map**

  Map employee daily work, Tasks, Projects, connected context, research/experiments, updates/evidence,
  Project-owner progress, manager operations, evaluation, upward feedback/coaching, leave/delegation, and
  administration. Identify primary actions, AI assistance, human gates, recovery, and cross-role handoffs.

- [ ] **Step 4: Run the final engine verification**

  Run:

  ```bash
  pnpm verify
  pnpm test:integration
  pnpm test:ai
  pnpm db:verify
  pnpm test:e2e
  pnpm scan:secrets
  pnpm scan:performance-inputs
  pnpm scan:ai-boundary
  git diff --check
  ```

  Add realistic API/worker journeys for every capability that cannot be proved through the provisional
  browser suite. Record exact counts, intentional skips, external gates, and unresolved P2/P3 backlog.

- [ ] **Step 5: Publish the Engine Completion Audit**

  `ENGINE_COMPLETION_AUDIT.md` must separate production code, test fixtures, provisional verification UI,
  external integrations, and deferred final frontend work. It must state whether the engine is ready for
  frontend design and list any P0/P1 blocker.

- [ ] **Step 6: Begin the separate full-frontend design process**

  Only after the engine audit has no unresolved P0/P1 blocker, invoke `superpowers:brainstorming` for the
  full frontend. Use the feature register, capability matrix, customer-journey map, system map, and
  handoff schema as inputs. Produce visible information architecture and high-fidelity role journeys
  before writing the frontend implementation plan.

---

## Durable Checkpoint Requirements

After each E0–E7 bounded bundle:

1. Run focused tests and the bundle's required integration/security checks.
2. Commit.
3. Push the branch.
4. Create or update the relevant Pull Request.
5. Update `TASKS.md`, the feature register, and `PROJECT_STATE.md` when their state meaningfully changes.
6. Record completed capabilities, remaining work, known limitations, and external gates.
7. Continue immediately unless the next step is a genuine protected or external human gate.

## Completion Definition

The engine-first program is complete when:

- all approved pilot capabilities are implemented, explicitly externally gated, or explicitly deferred
  by an approved decision;
- daily work, research/experiments, Project progress, evaluation, upward feedback/coaching, operational
  lifecycle, and administration work through stable protected contracts;
- every capability has authorization, privacy, history/audit, failure/recovery, and test evidence;
- the full engine suite and operational drills pass;
- the final feature inventory and customer-journey map contain no unresolved P0/P1 gap;
- final frontend work has not been mistaken for engine completion;
- the frontend program can design one simple intelligent experience over the complete verified engine.
