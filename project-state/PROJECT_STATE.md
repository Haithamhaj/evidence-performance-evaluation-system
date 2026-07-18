# PROJECT_STATE.md

## Current Goal

Execute Phase 1 — Projects, Workstreams, Documents, and Criteria — in bounded Fast Controlled Execution bundles.

## Current Reality

- Phase 0 was squash-merged through Pull Request #1 to `main` at `04c42c5`; hosted CI run `29540996315` passed integrity, quality, build, and integration on the merged commit.
- Phase 1 work is isolated on `codex/phase-1-projects-workstreams-documents` in `.worktrees/phase-1-projects-workstreams-documents`.
- The bounded Phase 1 design is `docs/superpowers/specs/2026-07-17-phase-1-projects-workstreams-documents-design.md` and covers T018–T029 through four dependency-ordered bundles.
- Bundle A is complete: T018–T020 implement governed projects, workstreams, membership/contributor periods, atomic permanent and acting owner transfers, half-open responsibility history, terminal-state controls, scoped API authorization, same-transaction audit, and UTC database sessions.
- Bundle A task commits are `ac496ee`, `4677af8`, and `46ba63e`. One bounded final independent review approved the combined implementation with no P0/P1 blockers.
- Bundle B is complete: T021–T023 implement protected organization/department templates, immutable template and document history, fail-closed streamed uploads, private S3-compatible storage, ClamAV scanning, short-lived authorized reads, and one versioned document per project or workstream.
- Bundle B task commits are `6a1760e`, `20056a6`, and `d23583b`; final DOCX archive-hardening is `1475daf`. One bounded independent review approved the combined implementation with no remaining P0/P1 blockers. Fresh verification passed the full repository gate, 217 integration tests, 34 migration tests across empty/previous/rebuild paths, 133 AI evaluations with one intentional skip, 11 browser tests, 62 targeted document tests, infrastructure verification, secret scanning, and the 234-file boundary check.
- Bundle C is complete: T024–T028 implement source-bound readiness and material-change analysis, append-only human review, human-approved project and workstream criteria, frozen contributor responses and retained objections, and atomic prospective criteria activation with historical timestamp resolution.
- Bundle C uses deterministic local Router fixtures only; no live paid model request was made. Fresh verification passed the full repository gate, 351 integration tests with 13 intentional skips, 49 migration integration tests across empty/previous/rebuild paths, 142 AI evaluations with one intentional skip, 11 browser tests, infrastructure verification, secret scanning, and the 323-file boundary check.
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

- Uploaded content remains untrusted; deployed size/archive policy values and ClamAV signatures require active operational maintenance.
- Live-model quality and production queue/storage operations still require deployment-time evaluation and monitoring; deterministic verification confirms the governed contracts, not provider output quality.
- Arabic employee release remains blocked at T016's protected human semantic-review gate.
- The known non-blocking T013 recovered-running attempt-count telemetry issue remains outside Phase 1 scope.

## Protected Areas

- All protected product, AI, privacy, historical-record, authorization, audit, localization, and evaluation rules in `AGENTS.md`.
- `docs/PROJECT_REFERENCE.md`, `docs/EVALUATION_RUBRIC.md`, and `docs/IMPLEMENTATION_PLAN.md` cannot be rewritten to fit implementation without explicit approval.
- T016 artifacts must not be imported, activated, or merged into the Phase 1 branch.

## Next Recommended Action

Execute Bundle D T029: build the Arabic-first responsive project and workstream interface with English support over the verified Phase 1 APIs.

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
- GitHub issue #2 and `deferred/arabic-rubric-v1`
