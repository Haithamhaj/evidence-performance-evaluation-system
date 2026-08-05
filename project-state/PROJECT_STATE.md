# PROJECT_STATE.md

## Current Goal

Complete and verify the detailed TDD plans for every remaining bounded engine subsystem before starting
Subagent-Driven execution. Then execute E3 through E7 in dependency order. Keep the final frontend
program and live connector installations behind their existing sequence and external gates.

## Current Reality

- Phase 0 was squash-merged through Pull Request #1 to `main` at `04c42c5`; hosted CI run `29540996315` passed integrity, quality, build, and integration on the merged commit.
- Phase 1 is complete on `codex/phase-1-projects-workstreams-documents` through Bundles A–D (T018–T029): governed responsibility, safe immutable documents, source-bound analysis, human-approved prospective criteria, and the Arabic-first bilingual workspace.
- Bundle D exposes browser data and mutations only through the same-origin Next.js gateway. Server-side sessions and bearer tokens stay outside Client Components; upstream calls use exact approved paths, and role-scoped controls refresh from protected API actions after every successful mutation.
- A frozen eligible contributor whose current workstream access ended receives only the authorized criteria snapshot: no current people, document, or readiness data. Contributor responses become immutable after one submission.
- Deterministic browser verification covers Arabic/English routing, RTL/LTR, mixed technical text, 390px layout, keyboard focus, project/workstream details, frozen contributor responses, historical criteria-only access, and manager-safe readiness. It makes no live paid model call.
- Phase 1 introduced no protected product-rule change and no T029 database migration.
- T016 remains draft and inactive on `deferred/arabic-rubric-v1` at `3ebbe54`, tracked by GitHub issue #2. It is an Arabic employee-release gate, not an engineering-phase dependency.
- The Open-Source Reuse Assessment approved interaction patterns only. No candidate source, assets, translations, schema, backend, authentication, or sync logic may be copied.
- The previous T030–T044 execution order and prototype-era backend/vertical-slice drafts are superseded and must not resume.
- An isolated Arabic-first Product Reset acceptance prototype now demonstrates My Work, Inbox, Projects, Workstreams, shared Work Item views, text/voice updates, evidence confirmation, manager operations, and Evaluation Fact View using synthetic in-memory data only.
- The prototype adds no production database, API, queue, authentication, AI provider call, or Phase 1 backend change.
- The product owner approved the final production structure: preserve Phase 0/1; add only bounded Work Items and Updates & Evidence modules; keep versioned Progress Contracts inside Projects; compose authorized daily-work reads at the application layer; keep GitHub and voice as connectors.
- The approved Progress Contract forbids Work Item/task/update/GitHub volume as progress inputs, has no direct percentage override, retains the previous official percentage when source coverage is insufficient, and preserves source-explained decreases through append-only snapshots.
- The 2026-07-18 design/plan remain the historical Slice 1/2 foundation and the active source for unchanged Check-ins/Readiness and Manager View tasks only; the 2026-07-19 correction governs the affected journey.
- Phase 2 production execution is approved. Slice 1 is complete on `codex/phase-2-updates-evidence-readiness`: migrations `0012`–`0013`, bounded Work Items, versioned document-sourced Progress Contracts, append-only official progress snapshots, protected daily-work APIs, Arabic/English My Work and Project progress screens, a real-database synthetic seed, and Playwright screenshots.
- Slice 1 progress is operational Project state only. Work Item volume and employee activity are not calculation inputs, and cross-Project contract decisions are rejected server-side.
- Slice 2 is complete on the same branch: migration `0014`, bounded Updates & Evidence, live multi-turn AI structuring only through `update.structure`, employee-edited drafts, private manual evidence, confirmation gates, protected APIs, and source-labelled Timeline.
- The Arabic/English production UI preserves one question at a time, prefills the evidence claim from the employee-reviewed AI draft, keeps evidence entry inside the update flow, and uses a visible mobile bottom sheet.
- A real local Keycloak login, live GPT-5.5 clarification, evidence confirmation, update confirmation, and Timeline were exercised against PostgreSQL. The configured provider credential was neither printed, moved, nor committed.
- Slice 2 acceptance screenshots are under `docs/product/screenshots/phase-2-production/slice-2/`; the runnable preview is `http://127.0.0.1:3300/ar/my-work`.
- Product-owner review found that the current Work-Item-first question form does not match the intended daily journey. The approved correction requires Project-first scope, optional Workstream/Work Item, a useful draft before conditional clarification, unified sources, a compact result card, and precise recovery.
- The product owner approved the written correction on 2026-07-19. A verified GitHub event may prove a deterministic condition mapped in the active Progress Contract and update operational Project progress; raw GitHub volume remains prohibited, ambiguous events require Project review, and personal contribution evidence still requires employee confirmation.
- The active correction artifacts are `docs/superpowers/specs/2026-07-19-unified-daily-work-github-progress-design.md` and `docs/superpowers/plans/2026-07-19-unified-daily-work-github-progress-plan.md`.
- The correction plan replaces the old Slice 2–4 behavior and Fact View task. The previously approved Check-ins/Monthly Readiness and Manager Operational View tasks remain active and execute between the corrected source bundles and Fact View preparation.
- Bundle 1 correction is implemented through Tasks 1–4: authorized Project-first scope composition; draft-first AI structuring and readable results; corrected bilingual drawer/sheet interaction; deterministic acceptance data and Playwright coverage.
- The corrected flow requires a Project while Workstream and Work Item remain optional, shows an evolving draft before each next clarification, keeps manual evidence in the same flow, and ends in a compact result card plus append-only Timeline.
- The checkpoint uses the existing deterministic Phase 2 seed (two Projects, five Workstreams, twenty Work Items, and approved Progress Contracts) instead of creating a second seed path. No employee performance values are seeded.
- Product-owner screenshots are under `docs/product/screenshots/phase-2-production/daily-update-correction/`; the local review routes are `http://127.0.0.1:3300/ar/my-work` and `http://127.0.0.1:3300/en/my-work`.
- Bundle 1 verification passed at the repository-pinned Node.js 24.18.0 and pnpm 11.13.0: 57 focused unit tests, 27 related integration tests, 145 passing AI evaluation checks (one intentional skip), 4 related browser journeys, both protected scans, lint/boundaries/copy checks, and all 20 workspace typechecks.
- The local governed `update.structure` route now has prompt v4 and output schema v2 registered against the approved GPT-5.5 model route. The provider credential remained outside the repository and was not printed, moved, or committed.
- The verified Bundle 1 implementation checkpoint was pushed at commit `99ac870`; execution is stopped at the Product Owner gate and Bundle 2 has not started.
- Product Owner gate feedback confirmed that `/{locale}` still exposed the Phase 0 diagnostics page and the English acceptance preview retained Arabic synthetic records. The root route now opens localized My Work, and the English-pilot seed is English and safely rerunnable for mutable records; existing immutable contract history and employee-authored source content remain unmodified.
- The Product Owner approved the full-real dogfood direction on 2026-07-19: this repository becomes the real Project, the local employee persona is `Codex`, live AI drafts but never activates the Progress Contract, and Bundle 2 implements the GitHub App path before the end-to-end run.
- The bounded dogfood design is `docs/superpowers/specs/2026-07-19-codex-dogfood-project-design.md`; the Product Owner approved it in writing on 2026-07-19.
- The active execution plan now inserts Bundle 1.5 before GitHub automation: versioned `project.progress-contract.draft` artifacts, durable AI proposals and human revisions, the protected review/activation UI, and the real Codex Project seed/acceptance journey.
- The subsequent GitHub bundle uses the same active human-approved Codex contract and real repository; deterministic fixtures verify safety before live GitHub App reconciliation.
- The real local Codex Project seed is safely rerunnable at repository commit `29da397`: one Project, one Workstream, exact approved DocumentVersion `3`, six remaining-plan Work Items, and no performance or raw-activity progress rows. Its audited lineage pins Pull Request #5 base `b5e679e` and head `29da397`.
- Live GPT-5.5 produced persisted proposal revision `1` for DocumentVersion `3` through the governed AI Router. The redacted trace is prompt `project-progress-contract-draft.v2`, output schema `project-progress-contract-draft.v1`, route config `2`, succeeded with human approval pending.
- The persisted proposal was reviewed through the real local API and signed Keycloak authentication in English and Arabic/RTL at desktop and 390px. No human edit, application, submission, approval, activation, GitHub binding, or official progress recalculation was performed.
- The bounded specification and security/code-quality reviews have no remaining P0/P1 finding. Deferred P2 maintenance observations are recorded in GitHub issue #6 and do not block the Product Owner gate.
- Acceptance evidence is `docs/acceptance/CODEX_DOGFOOD_ACCEPTANCE.md`; live screenshots are under `docs/product/screenshots/phase-2-production/codex-dogfood-contract/`.
- Product-owner review on 2026-07-20 rejected the current employee interaction model as too complex and approved an employee-experience reset rather than a full-system rewrite.
- The approved replacement is an AI-first Daily Workspace: smart Today brief, Project-required official Tasks, private Inbox capture, Gmail and Google Calendar work context, governed GitHub sources, universal manual capture, source-explained linking, and human-confirmed Task drafts.
- `docs/superpowers/specs/2026-07-20-ai-first-daily-workspace-design.md` governs the replacement employee experience after written-spec review. No production code changed during the design process.
- The Product Owner approved the written specification on 2026-07-20. The replacement execution authority is now one master map plus six bounded plans covering Today/Tasks, Google Workspace, Context Intelligence, GitHub/Updates/Evidence, Project-owner progress/manager operations, and neutral Evaluation Fact View preparation.
- The plans preserve the single database, existing authentication, AI Router, Work Items, Updates & Evidence, Projects/Progress Contract, and Daily Composition foundations. No production code changed during implementation planning.
- The Product Owner authorized execution on 2026-07-20. The active first checkpoint is documentation-only alignment of `IMPLEMENTATION_PLAN.md`, `TASKS.md`, and the three Phase 2 product maps; new Slice 1 begins after that checkpoint is verified and pushed.
- AI-first Slice 1 is implemented on Pull Request #5: private Quick Capture, Project-required official Tasks, editable List/Board/Calendar workspace, composed Today groups, draft recovery after authentication interruption, bilingual RTL/LTR UI, and protected employee-only Inbox access.
- Migration `0017_task_workspace` is applied locally. The real `Codex` dogfood fixture now contains six Project-linked Tasks and three private captures sourced from the current authoritative AI-first documents, with no employee score or activity-volume progress input.
- Acceptance evidence is `docs/acceptance/AI_FIRST_DAILY_WORKSPACE_SLICE_1.md`; three passing Playwright journeys and screenshots cover Arabic desktop, English draft recovery, and Arabic 390px.
- The final bounded specification remediation is complete: My/Team Tasks are visible within authorized scope; every new official Task write requires one responsible assignee; OIDC returns only to a validated encrypted same-origin localized path; and Today follows the approved value-before-input order. Independent re-review has no remaining P0/P1 finding.
- The Product Owner accepted Slice 1 and authorized continued execution. Slice 2 starts with deterministic synthetic Gmail/Calendar adapters; live Google OAuth remains behind the administrator, credential, scope, retention, deletion, and consent gate.
- Slice 2 deterministic implementation is complete on Pull Request #5: migration
  `0018_connected_work_context`, owner-only Gmail/Calendar context, governed connection and sync
  services, protected APIs, reversible source-scope exclusions, private manual Project links,
  truthful disconnect behavior, bilingual review UI, and four passing Playwright journeys.
- An active connection-generation lock prevents an in-flight old sync from committing an item or
  cursor after disconnect, including after reconnect. Disconnect stops sync and makes derived
  context inaccessible; it does not claim policy-dependent deletion.
- Acceptance evidence is `docs/acceptance/AI_FIRST_DAILY_WORKSPACE_SLICE_2.md`; screenshots are
  under `docs/product/screenshots/ai-first-daily-workspace/slice-2/`. Deferred P2 improvements are
  recorded in GitHub issue #7.
- The bounded specification/privacy and security/code-quality re-reviews passed with no remaining
  P0/P1 finding. Final verification passed 843 unit/coverage tests, 468 integration tests, 150 AI
  checks (one intentional skip), 49 migration checks, and 28 browser journeys (four intentional
  skips for superseded Update flows).
- The Product Owner accepted the deterministic Slice 2 journey on 2026-08-02 and authorized Slice 3.
  Live Google remains behind the existing external administrator, credential, scope, retention,
  deletion, consent, and vault gates; Slice 3 does not depend on enabling it.
- Slice 3 Tasks 1–6 are implemented through migrations `0019`–`0021`: encrypted append-only Context
  Analysis, deterministic two-anchor matching, versioned AI Router contracts, owner-only protected
  APIs, correction/rejection flows, and employee-confirmed Task drafts.
- Deterministic acceptance proves an explained strong match, uncertain correction, rejection, no
  official Task before confirmation, employee-confirmed assignment, AI-unavailable manual recovery
  with exact raw input preserved, empty manager/other-employee projections, and Arabic RTL at 390px.
- Acceptance evidence is `docs/acceptance/AI_FIRST_DAILY_WORKSPACE_SLICE_3.md`; screenshots are
  under `docs/product/screenshots/ai-first-daily-workspace/slice-3/`.
- The bounded final reviews are complete. Their five confirmed P1 findings are remediated in the
  production path: governed unlinked-source anchors and approved Document semantics are composed;
  employees can trigger analysis and draft preparation from source review; terminal queue rows are
  filtered without fixture-only deletion; Project-confirmation replay reauthorizes before decrypt
  or acknowledgment; and manual links / official Task confirmation use Projects transaction locks.
- Final remediation verification passed 903 unit tests, 517 integration tests, 166 AI evaluations,
  four Slice 3 browser journeys, all 22 lint/typecheck tasks, protected scans, formatting, and task
  graph validation. No database migration or protected product-rule change was introduced.
- The optional live Context Intelligence smoke was not run: the route registrar dry-run passes, but
  the current local database has none of the three route registrations and the current process has
  no available provider credential. No route configuration or provider result was simulated.
- The scoped final re-review's confirmed-sender P1 is remediated. Gmail title/summary text no longer
  emits `CONFIRMED_SENDER_DOMAIN`; a real regression proves that a stakeholder address mentioned
  only in that untrusted text cannot combine with `EXPLICIT_PROJECT_REFERENCE` to authorize
  `AUTO_LINK`. No provider-authenticated sender metadata was added. Focused verification passed 41
  Context Intelligence unit tests, 15 API/database integration tests, and API lint/typecheck.
- A real Google OAuth preview is now available only under the explicit `google-local` guards. It
  keeps credentials in process memory, encrypts new private titles with local AES-256-GCM, imports
  bounded Gmail metadata and future Calendar titles, and returns through a clean localized URL.
  Production `live` mode remains fail-closed behind the approved vault, key, policy, and review
  gates.
- The Product Owner accepted the verified Slice 3 trust gate and authorized continued execution.
- Slice 4 Task 1 is complete through migration `0022_github_integration`: governed GitHub App
  installation/Project binding history, delivery idempotency, append-only source events, and
  reconciliation cursors. The schema stores no raw payload, credential, score, ranking, or
  activity-volume progress input. Bounded review found no remaining P0/P1.
- Slice 4 Tasks 2–7 are complete on Pull Request #5: signed idempotent webhook ingestion and
  reconciliation, governed source suggestions, universal text/voice/image/file/code capture,
  employee-confirmed GitHub evidence, and one authorization-scoped Timeline.
- Deterministic acceptance keeps official Project progress at 62.5% after a raw event with 18
  commits and 42 changed files, routes the ambiguous contract match to the Project owner, records
  the human decision source/outcome, and creates zero employee-performance writes.
- Acceptance evidence is `docs/acceptance/AI_FIRST_DAILY_WORKSPACE_SLICE_4.md`; five screenshots
  cover English desktop, mobile evidence review, compact results, Arabic RTL at 390px, and the
  final GitHub/evidence/decision Timeline.
- Comprehensive local verification passed 988 unit/coverage tests, 569 integration tests with 13
  intentional skips, 172 AI checks with one intentional skip, 49 migration integration checks,
  34 browser journeys with four intentional skips, all 23 lint/typecheck/build workspace tasks,
  and protected boundary, secret, task-graph, and performance-input scans. Both bounded final
  reviews report no remaining P0/P1 finding.
- The Product Owner accepted Slice 4 and authorized the Pull Request #5 then Pull Request #3 merge
  sequence on 2026-08-04. Merge-gate remediation adds a deterministic local development entry
  point, isolates the optional provider key to API/worker processes, and stabilizes Next.js
  generated route-type files across development, typecheck, and build commands.
- The external audit's hosted-build concern was not reproduced on the supported toolchain: Pull
  Request #5's clean GitHub Actions merge-ref run passed integrity, quality, build, and integration.
  The audit used unsupported Node.js 22; local startup now rejects unsupported versions clearly.
- Slice 5 is complete on `codex/phase-2-slice-5-operational-readiness`: owner-only guided Progress
  Contract setup, compact employee Project pulse, Thursday check-ins through the normal Update
  lifecycle, non-scoring monthly readiness, and manager operational queues.
- Deterministic acceptance proves separate human revision/submission/activation, retained official
  progress with incomplete source coverage, missing-evidence actions, Arabic RTL at 390 px, and no
  protected manager scoring fields. Evidence is in
  `docs/acceptance/AI_FIRST_DAILY_WORKSPACE_SLICE_5.md`.
- Final verification passed 1004 unit/coverage tests, 586 integration tests, 49 database checks, 38
  browser journeys, all 23 lint/typecheck/build tasks, and the task-graph, secret, AI-boundary,
  copy, and performance-input scans. No Slice 5 migration or AI prompt/schema change was added.
- The Product Owner approved the engine-first sequence on 2026-08-05. Slice checkpoints prove technical
  behavior only; provisional screens are not UX or product acceptance. After the pilot engine is
  complete, a source-to-code feature inventory—including the required Research & Experiments
  capability—governs a separate full-frontend design and delivery program.
- Slice 6 is technically complete and merged to `main` at `1db6bb1`: a strict
  neutral Fact View contract, public authorized source readers, read-only preparation composition,
  protected employee/assigned-manager API, and bilingual verification surface separate source facts
  from employee interpretation without a rating or readiness value.
- Slice 6 adds no migration and no AI provider call. Full local verification passed 1,025 unit/coverage
  tests, 593 integration tests with 13 intentional skips, 179 AI evaluations with one intentional skip,
  49 database checks across all 26 migrations, and 41 browser journeys with four intentional skips.
- Slice 6 Pull Request #11 was squash-merged. Hosted `integrity`, `quality`, `build`, and `integration`
  all passed on the merged `main` commit; integration reported 41 browser journeys passed and four
  intentional skips.
- The complete Evaluation Template, immutable Cycle Snapshot, self-assessment, independent manager
  assessment, discussion, final human judgment, and closure remain later engine work. The current
  active-at-cycle-start rubric resolver is not a substitute for T045–T046 snapshot immutability.
- The E2 source-to-code baseline identifies 44 capabilities: 21 complete, 6 partial, 14 planned, 2
  externally gated, and 1 approved deferred capability. These counts are inventory states, not a
  percent-complete score.
- E2 Pull Request #12 passed hosted integrity, quality, build, and integration checks and was
  squash-merged to `main` at `0a06f97` on 2026-08-05.
- Research & Experiments is an authoritative daily-work and evaluation source requirement, but no
  dedicated production model, public API, domain lifecycle, history, recovery, or journey entry point
  exists. E3 must close this gap before the evaluation engine is completed.
- The E3 ownership audit is complete. The approved direction is one bounded Research & Experiments
  domain: every Research Record belongs to a Project, may optionally link a Workstream/Work Item, and
  may contain multiple versioned Experiments. Existing Projects, Work Items, Documents, Updates &
  Evidence, Timeline composition, and AI Router retain their current ownership.
- The Product Owner approved the written E3 specification on 2026-08-05. It includes a safe source-link
  intake and Project-relevance review: explicit GitHub/paper/document links are compared with an
  authorized version-pinned Project Context Snapshot, and Research/Experiment/Work Item proposals remain
  editable drafts until employee confirmation.
- The detailed E3 TDD implementation plan is
  `docs/superpowers/plans/2026-08-05-research-experiments-engine.md`. It maps thirteen independently
  testable tasks from strict contracts and migration through source security, AI routes, domain
  lifecycles, composition, bilingual verification, and the final technical checkpoint.
- The Product Owner approved the complete-engine architecture, dependency order, extensibility rules,
  cross-domain flow, verification-surface boundary, execution policy, and final completion gate on
  2026-08-05. The written program design is
  `docs/superpowers/specs/2026-08-05-complete-engine-program-design.md`.
- Bounded written designs now cover E4 Employee Evaluation, E5A Identified Upward Manager Evaluation,
  E5B Coaching & Development, E6A Continuity & Offboarding, E6B Notifications/Reporting/Administration,
  E6C Security/Recovery/Readiness, and E7 Full Engine Integration Audit. Detailed TDD plans are not yet
  written for those seven designs; no production implementation has started from them.

## Active Decisions

- Use a modular monolith with three Phase 1 domain packages: `projects`, `documents`, and `criteria`; controllers do not access another module's tables directly.
- Use inline `executing-plans` for routine bounded work. Use independent review for security, authorization, audit, migrations, AI boundaries, and immutability.
- English-only pilot use is permitted. Arabic employee use still requires approved Arabic rubric content and semantic review; localization and RTL foundations remain required.
- AI never assigns or recommends ratings, rankings, productivity scores, or automatic project averages. Documentation Readiness remains a non-scoring operational aid.
- Historical ownership, documents, criteria, acknowledgments, and objections are preserved through append-only rows or prospective versions.
- Project/Workstream progress is operational only, derives from a versioned human-approved document-sourced contract, and never becomes employee performance.
- No user can directly enter or override the official overall progress percentage. Contract-defined qualitative conditions may receive authorized human confirmation and then trigger recalculation.
- Phase 2 stops at Evaluation Fact View preparation; the complete employee self-assessment and manager assessment workflow remains Phase 3.
- T011 remains accepted under its product-owner-bounded direct import/call/meta-call enforcement; provider-key isolation, CI scanning, and human review cover documented static-flow limitations.
- Phase 2 execution proceeds autonomously through bounded slice checkpoints under Fast Controlled Execution; stop only at a protected human gate or genuine unresolved blocker.
- Preserve the Phase 0/1 and applicable Phase 2 domain foundations, but replace the current `My Work`, long Update composer, and employee-facing Progress Contract mechanics.
- Use one primary store and five bounded parts: Task domain, Connected Work Context, Context Intelligence through AI Router, Daily Composition, and Employee Experience.
- Official Tasks require a Project; private Inbox capture may remain unlinked until promoted. AI drafts Tasks but never creates or assigns them automatically.
- Gmail and Calendar summaries are private to the employee until the employee confirms a shared Task, Update, Evidence item, or decision record.
- Automatic source linking requires a deterministic mapping or at least two non-conflicting independent Project anchors; model confidence alone is insufficient.
- Research/Experiment structure, methods, immutable runs, human-confirmed conclusions, decisions, and
  applied learning belong to one bounded Research & Experiments domain. It reuses public Project,
  Work Item, Document, Evidence, Timeline, Fact View, and AI Router contracts and does not create a
  second evidence lifecycle or generic activity platform.
- Source relevance is not proof of benefit, progress, contribution, or performance. Explicit link
  retrieval is bounded and fail-closed; it runs no external code, uses no ambient credentials, and
  requires employee confirmation before Project sharing or official object creation.
- All remaining engine capabilities use versioned configuration, stable public contracts, additive
  migrations, append-only protected history, and narrow connector/provider adapters. Extensibility must
  follow real approved variation without introducing a speculative plugin platform or microservices.

## Active Risks

- Uploaded content remains untrusted; deployed size/archive policy values and ClamAV signatures require active operational maintenance.
- Live-model quality and production queue/storage operations still require deployment-time evaluation and monitoring; deterministic verification confirms governed contracts, not provider output quality.
- Arabic employee release remains blocked at T016's protected human semantic-review gate.
- The known non-blocking T013 recovered-running attempt-count telemetry issue remains outside Phase 1 scope.
- The prototype remains reference-only. Production Update structuring and voice use the governed
  AI Router. Live GitHub installation remains externally gated; Fact View preparation remains in
  Slice 6.
- The production plan contains multiple security-, migration-, AI-, privacy-, and immutability-critical slices. Fast Controlled Execution remains the default, with bounded critical reviews only where those boundaries are touched.
- CI remains the hosted confirmation after this checkpoint is pushed; local verification used the exact repository-pinned Node.js 24.18.0 and pnpm 11.13.0.
- Production Google Workspace integration requires organization-approved OAuth configuration, minimum scopes, retention/deletion policy, and administrator consent.
- Connected-source summaries create a new privacy boundary: manager access remains prohibited until the employee confirms a shared Project object.
- Live Google remains blocked on the approved OAuth client, exact redirect URIs, minimum scopes,
  administrator consent, retention/deletion policy, production credential vault, and production
  cryptographic key provider.
- The local Google preview is deliberately non-durable: process restart loses OAuth credentials,
  client-secret rotation makes earlier local AES rows unreadable, and disconnect hides rather than
  claims deletion of derived rows.
- Live Context Intelligence model quality remains unverified in this local environment because the
  governed routes and provider credential are not configured; deterministic route, schema, and
  recovery behavior is verified.
- A deferred P2 trace-hygiene risk remains: a failed follow-up persistence step can leave an
  orphaned successful AI-run trace. It does not bypass employee confirmation or privacy controls.
- Research/Experiment facts are currently representable only as generic Timeline/Evidence text; that
  is insufficient for hypotheses, baselines, measures, reproducibility, conclusions, and applied
  learning. E3 must not overload generic event JSON or duplicate the existing evidence lifecycle.
- `PARTIAL` administration, observability, security/retention, and offboarding capabilities require
  explicit E6 closure before pilot launch; existing foundations must not be mistaken for finished
  user workflows.

## Protected Areas

- All protected product, AI, privacy, historical-record, authorization, audit, localization, and evaluation rules in `AGENTS.md`.
- `docs/PROJECT_REFERENCE.md`, `docs/EVALUATION_RUBRIC.md`, and `docs/IMPLEMENTATION_PLAN.md` cannot be rewritten to fit implementation without explicit approval.
- T016 artifacts must not be imported, activated, or merged into the Phase 1 branch.

## Next Recommended Action

Review the written complete-engine and seven bounded subsystem specifications, then write and verify one
detailed TDD plan per approved design. Begin Subagent-Driven E3 execution only after the complete plan set
is ready. Do not start the final frontend yet. Live connector setup and Arabic evaluation release remain
behind their external human gates.

## Critical References

- `AGENTS.md`
- `TASKS.md`
- `docs/PROJECT_REFERENCE.md`
- `docs/EVALUATION_RUBRIC.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/superpowers/specs/2026-07-17-phase-1-projects-workstreams-documents-design.md`
- `docs/superpowers/specs/2026-07-18-product-direction-reset-prototype-design.md`
- `docs/superpowers/specs/2026-07-18-phase-2-daily-work-progress-design.md`
- `docs/superpowers/plans/2026-07-18-phase-2-daily-work-progress-plan.md`
- `docs/superpowers/specs/2026-07-19-unified-daily-work-github-progress-design.md`
- `docs/superpowers/specs/2026-07-19-codex-dogfood-project-design.md`
- `docs/superpowers/plans/2026-07-19-unified-daily-work-github-progress-plan.md`
- `docs/superpowers/specs/2026-07-20-ai-first-daily-workspace-design.md`
- `docs/superpowers/plans/2026-07-20-ai-first-daily-workspace-master-plan.md`
- `docs/superpowers/plans/2026-07-20-slice-1-daily-home-tasks.md`
- `docs/superpowers/plans/2026-07-20-slice-2-google-workspace-context.md`
- `docs/superpowers/plans/2026-07-20-slice-3-context-intelligence.md`
- `docs/superpowers/plans/2026-07-20-slice-4-github-updates-evidence.md`
- `docs/superpowers/plans/2026-07-20-slice-5-project-owner-progress.md`
- `docs/superpowers/plans/2026-07-20-slice-6-evaluation-preparation.md`
- `docs/superpowers/specs/2026-08-05-technical-completion-frontend-product-acceptance-design.md`
- `docs/superpowers/plans/2026-08-05-engine-first-completion-program.md`
- `docs/superpowers/specs/2026-08-05-research-experiments-engine-design.md`
- `docs/superpowers/plans/2026-08-05-research-experiments-engine.md`
- `docs/superpowers/specs/2026-08-05-complete-engine-program-design.md`
- `docs/superpowers/specs/2026-08-05-employee-evaluation-engine-design.md`
- `docs/superpowers/specs/2026-08-05-identified-manager-evaluation-engine-design.md`
- `docs/superpowers/specs/2026-08-05-coaching-development-engine-design.md`
- `docs/superpowers/specs/2026-08-05-continuity-offboarding-engine-design.md`
- `docs/superpowers/specs/2026-08-05-notifications-reporting-administration-engine-design.md`
- `docs/superpowers/specs/2026-08-05-security-recovery-readiness-engine-design.md`
- `docs/superpowers/specs/2026-08-05-engine-integration-audit-design.md`
- `docs/product/PHASE_2_FEATURE_MAP.md`
- `docs/product/PHASE_2_DAILY_WORK_EXPERIENCE.md`
- `docs/product/PHASE_2_BACKEND_DELTA.md`
- `docs/product/PHASE_2_VERTICAL_SLICES.md`
- `docs/product/PHASE_2_INTERACTION_REFERENCE_REGISTER.md`
- `docs/product/ENGINE_FEATURE_REGISTER.md`
- `docs/product/ENGINE_CAPABILITY_MATRIX.md`
- `docs/product/ENGINE_FRONTEND_HANDOFF_SCHEMA.md`
- `docs/superpowers/plans/2026-07-17-phase-1-bundle-a-project-responsibility.md`
- `docs/superpowers/plans/2026-07-17-phase-1-bundle-b-documents.md`
- `docs/superpowers/plans/2026-07-17-phase-1-bundle-c-analysis-criteria.md`
- `docs/superpowers/plans/2026-07-18-phase-1-bundle-d-project-workstream-ui.md`
- GitHub issue #2 and `deferred/arabic-rubric-v1`
