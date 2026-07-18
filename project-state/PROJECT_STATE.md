# PROJECT_STATE.md

## Current Goal

Plan Phase 2 — Updates, Evidence, GitHub, Check-ins, and Monthly Readiness — as the next bounded Fast Controlled Execution phase.

## Current Reality

- Phase 0 was squash-merged through Pull Request #1 to `main` at `04c42c5`; hosted CI run `29540996315` passed integrity, quality, build, and integration on the merged commit.
- Phase 1 is complete on `codex/phase-1-projects-workstreams-documents` through Bundles A–D (T018–T029): governed responsibility, safe immutable documents, source-bound analysis, human-approved prospective criteria, and the Arabic-first bilingual workspace.
- Bundle D exposes browser data and mutations only through the same-origin Next.js gateway. Server-side sessions and bearer tokens stay outside Client Components; upstream calls use exact approved paths, and role-scoped controls refresh from protected API actions after every successful mutation.
- A frozen eligible contributor whose current workstream access ended receives only the authorized criteria snapshot: no current people, document, or readiness data. Contributor responses become immutable after one submission.
- Deterministic browser verification covers Arabic/English routing, RTL/LTR, mixed technical text, 390px layout, keyboard focus, project/workstream details, frozen contributor responses, historical criteria-only access, and manager-safe readiness. It makes no live paid model call.
- Phase 1 introduced no protected product-rule change and no T029 database migration.
- T016 remains draft and inactive on `deferred/arabic-rubric-v1` at `3ebbe54`, tracked by GitHub issue #2. It is an Arabic employee-release gate, not an engineering-phase dependency.

## Active Decisions

- Use a modular monolith with three Phase 1 domain packages: `projects`, `documents`, and `criteria`; controllers do not access another module's tables directly.
- Use inline `executing-plans` for routine bounded work. Use independent review for security, authorization, audit, migrations, AI boundaries, and immutability.
- English-only pilot use is permitted. Arabic employee use still requires approved Arabic rubric content and semantic review; localization and RTL foundations remain required.
- AI never assigns or recommends ratings, rankings, productivity scores, or automatic project averages. Documentation Readiness remains a non-scoring operational aid.
- Historical ownership, documents, criteria, acknowledgments, and objections are preserved through append-only rows or prospective versions.
- T011 remains accepted under its product-owner-bounded direct import/call/meta-call enforcement; provider-key isolation, CI scanning, and human review cover documented static-flow limitations.

## Active Risks

- Uploaded content remains untrusted; deployed size/archive policy values and ClamAV signatures require active operational maintenance.
- Live-model quality and production queue/storage operations still require deployment-time evaluation and monitoring; deterministic verification confirms governed contracts, not provider output quality.
- Arabic employee release remains blocked at T016's protected human semantic-review gate.
- The known non-blocking T013 recovered-running attempt-count telemetry issue remains outside Phase 1 scope.

## Protected Areas

- All protected product, AI, privacy, historical-record, authorization, audit, localization, and evaluation rules in `AGENTS.md`.
- `docs/PROJECT_REFERENCE.md`, `docs/EVALUATION_RUBRIC.md`, and `docs/IMPLEMENTATION_PLAN.md` cannot be rewritten to fit implementation without explicit approval.
- T016 artifacts must not be imported, activated, or merged into the Phase 1 branch.

## Next Recommended Action

Prepare the bounded Phase 2 design and dependency-ordered execution bundles for T030–T043 without importing or activating T016.

## Critical References

- `AGENTS.md`
- `TASKS.md`
- `docs/PROJECT_REFERENCE.md`
- `docs/EVALUATION_RUBRIC.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/superpowers/specs/2026-07-17-phase-1-projects-workstreams-documents-design.md`
- `docs/superpowers/plans/2026-07-17-phase-1-bundle-a-project-responsibility.md`
- `docs/superpowers/plans/2026-07-17-phase-1-bundle-b-documents.md`
- `docs/superpowers/plans/2026-07-17-phase-1-bundle-c-analysis-criteria.md`
- `docs/superpowers/plans/2026-07-18-phase-1-bundle-d-project-workstream-ui.md`
- GitHub issue #2 and `deferred/arabic-rubric-v1`
