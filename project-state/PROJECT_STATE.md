# PROJECT_STATE.md

## Current Goal

Present the approved final Phase 2 production specification, feature map, and implementation plan for product-owner review before any production implementation.

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
- The active production planning artifacts are `docs/superpowers/specs/2026-07-18-phase-2-daily-work-progress-design.md`, `docs/product/PHASE_2_FEATURE_MAP.md`, and `docs/superpowers/plans/2026-07-18-phase-2-daily-work-progress-plan.md`.

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
- Phase 2 production work remains gated on product-owner review of the pushed final specification, feature map, and implementation plan.

## Active Risks

- Uploaded content remains untrusted; deployed size/archive policy values and ClamAV signatures require active operational maintenance.
- Live-model quality and production queue/storage operations still require deployment-time evaluation and monitoring; deterministic verification confirms governed contracts, not provider output quality.
- Arabic employee release remains blocked at T016's protected human semantic-review gate.
- The known non-blocking T013 recovered-running attempt-count telemetry issue remains outside Phase 1 scope.
- The prototype is not production storage. Its state resets on reload, voice is simulated, and its deterministic update structuring must not be promoted as a production AI provider.
- The production plan contains multiple security-, migration-, AI-, privacy-, and immutability-critical slices. Fast Controlled Execution remains the default, with bounded critical reviews only where those boundaries are touched.

## Protected Areas

- All protected product, AI, privacy, historical-record, authorization, audit, localization, and evaluation rules in `AGENTS.md`.
- `docs/PROJECT_REFERENCE.md`, `docs/EVALUATION_RUBRIC.md`, and `docs/IMPLEMENTATION_PLAN.md` cannot be rewritten to fit implementation without explicit approval.
- T016 artifacts must not be imported, activated, or merged into the Phase 1 branch.

## Next Recommended Action

Product owner reviews the pushed final specification, feature map, and implementation plan and chooses **Approve Phase 2 production execution** or **Request planning changes**. Do not implement a production slice before that gate.

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
- `docs/product/PHASE_2_FEATURE_MAP.md`
- `docs/product/PHASE_2_DAILY_WORK_EXPERIENCE.md`
- `docs/product/PHASE_2_BACKEND_DELTA.md`
- `docs/product/PHASE_2_VERTICAL_SLICES.md`
- `docs/product/PHASE_2_INTERACTION_REFERENCE_REGISTER.md`
- `docs/superpowers/plans/2026-07-17-phase-1-bundle-a-project-responsibility.md`
- `docs/superpowers/plans/2026-07-17-phase-1-bundle-b-documents.md`
- `docs/superpowers/plans/2026-07-17-phase-1-bundle-c-analysis-criteria.md`
- `docs/superpowers/plans/2026-07-18-phase-1-bundle-d-project-workstream-ui.md`
- GitHub issue #2 and `deferred/arabic-rubric-v1`
