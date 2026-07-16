# PROJECT_STATE.md

## Current Goal

Execute Phase 1 — Projects, Workstreams, Documents, and Criteria — in bounded Fast Controlled Execution bundles.

## Current Reality

- Phase 0 was squash-merged through Pull Request #1 to `main` at `04c42c5`; hosted CI run `29540996315` passed integrity, quality, build, and integration on the merged commit.
- Phase 1 work is isolated on `codex/phase-1-projects-workstreams-documents` in `.worktrees/phase-1-projects-workstreams-documents`.
- The bounded Phase 1 design is `docs/superpowers/specs/2026-07-17-phase-1-projects-workstreams-documents-design.md` and covers T018–T029 through four dependency-ordered bundles.
- T016 remains draft and inactive on `deferred/arabic-rubric-v1` at `3ebbe54`, tracked by GitHub issue #2. It is an Arabic employee-release gate, not an engineering-phase dependency.

## Active Decisions

- Use a modular monolith with three Phase 1 domain packages: `projects`, `documents`, and `criteria`; controllers do not access another module's tables directly.
- Execute four bounded bundles: project responsibility (T018–T020), documents (T021–T023), analysis and criteria (T024–T028), then UI (T029).
- Use inline `executing-plans` for routine bounded work. Use independent review for security, authorization, audit, migrations, AI boundaries, and immutability.
- English-only pilot use is permitted. Arabic employee use still requires approved Arabic rubric content and semantic review; localization and RTL foundations remain required.
- AI never assigns or recommends ratings, rankings, productivity scores, or automatic project averages. Documentation Readiness remains a non-scoring operational aid.
- Historical ownership, documents, criteria, acknowledgments, and objections are preserved through append-only rows or prospective versions.
- T011 remains accepted under its product-owner-bounded direct import/call/meta-call enforcement; provider-key isolation, CI scanning, and human review cover documented static-flow limitations.

## Active Risks

- Ownership transfer requires transactional locking and database uniqueness; application-only checks are insufficient.
- Uploaded content is untrusted and must fail closed on type, size, archive, or malware-safety failure.
- AI readiness and criteria output must retain source references, route traces, schema versions, and human gates.
- Arabic employee release remains blocked at T016's protected human semantic-review gate.
- The known non-blocking T013 recovered-running attempt-count telemetry issue remains outside Phase 1 scope.

## Protected Areas

- All protected product, AI, privacy, historical-record, authorization, audit, localization, and evaluation rules in `AGENTS.md`.
- `docs/PROJECT_REFERENCE.md`, `docs/EVALUATION_RUBRIC.md`, and `docs/IMPLEMENTATION_PLAN.md` cannot be rewritten to fit implementation without explicit approval.
- T016 artifacts must not be imported, activated, or merged into the Phase 1 branch.

## Next Recommended Action

Complete independent review of the Phase 1 design, commit it, write and review the Bundle A implementation plan for T018–T020, then execute the bundle with TDD, migration verification, authorization tests, and fresh CI evidence.

## Critical References

- `AGENTS.md`
- `TASKS.md`
- `docs/PROJECT_REFERENCE.md`
- `docs/EVALUATION_RUBRIC.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/superpowers/specs/2026-07-17-phase-1-projects-workstreams-documents-design.md`
- GitHub issue #2 and `deferred/arabic-rubric-v1`
