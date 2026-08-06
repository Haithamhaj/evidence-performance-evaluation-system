# E4 Task 5 Report — Finalization and Safe Projections

## Task ID

E4 Task 5 (comparison, finalization, acknowledgment, closure, and projections)

## What changed

- Added explainable comparison of immutable self and manager submissions, including signed rating gaps, relative high-weight gaps, source-citation differences, missing rationale flags, responsibility-period context, disputed attribution, and authorized discussion context.
- Kept comparison output descriptive only. It contains no reconciled rating, midpoint, compromise, automatic Project Contribution calculation, ranking, scoring, or readiness value.
- Added manager-only human finalization for all 12 fixed criteria and the single Project Contribution judgment.
- Required a written reason whenever the final human judgment differs from the manager's immutable initial rating.
- Restricted final source references to citations pinned by either submitted assessment or an authorized discussion entry.
- Wrote the immutable final snapshot, per-item decisions, optimistic assignment transition, and safe audit event in one serializable transaction with idempotent retry behavior.
- Added employee acknowledgment, acknowledgment with reservation, and manager-recorded no-response support. Reservations remain append-only and do not change ratings or block closure.
- Added authorized cycle closure only after every eligible assignment has a final snapshot; closure and audit are atomic and idempotent.
- Upgraded the versioned final snapshot and employee report projection to pin the cycle period, responsibility windows, work facts, Research/Experiments facts, neutral source-coverage notes, immutable self and manager submissions, explainable differences and discussion context, optional development-plan reference, final human decisions, and acknowledgment/reservation.
- Added assigned-manager department rating distributions and longitudinal cycle trends by stable criterion. The aggregation is manager-scoped and contains no employee identifiers, individual narratives, citations, reservation text, readiness values, rankings, automatic averages, or private upward-feedback content.

## Files changed

- `.superpowers/sdd/2026-08-05-employee-evaluation-engine/task-5-report.md`
- `packages/contracts/src/employee-evaluation.ts`
- `packages/contracts/src/employee-evaluation.test.ts`
- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/0029_employee_evaluation/migration.sql`
- `packages/database/src/employee-evaluation-schema.integration.test.ts`
- `packages/employee-evaluation/package.json`
- `packages/employee-evaluation/src/index.ts`
- `packages/employee-evaluation/src/comparison-service.ts`
- `packages/employee-evaluation/src/comparison-service.test.ts`
- `packages/employee-evaluation/src/finalization-service.ts`
- `packages/employee-evaluation/src/finalization-service.integration.test.ts`
- `packages/employee-evaluation/src/report-reader.ts`
- `packages/employee-evaluation/src/report-reader.integration.test.ts`

## Database changes

Because migration `0029_employee_evaluation` is still unshared, it was amended before merge to require a version-2 JSON report context on every final snapshot. The Prisma model now requires `reportSnapshot`, and `schemaVersion` defaults to `2`. The existing database triggers continue to reject updates and deletes of final snapshots, decisions, and acknowledgments. Migration verification passed from both an empty database and the previous release snapshot through migration 0028, with no drift.

## TDD evidence

- Comparison tests were written first and failed because `comparison-service.js` did not exist, then passed after the minimal explainable comparison implementation.
- Finalization integration tests were written first and failed because `finalization-service.js` did not exist, then passed after transactional finalization, acknowledgment, closure, and audit behavior was implemented.
- Report-reader integration tests were written first and failed because `report-reader.js` did not exist, then passed after the fail-closed employee and department readers were implemented.
- Version-2 contract tests first failed on the shallow version-1 snapshot/report shapes, then passed after the complete immutable report context and anonymous distribution/trend contracts were added.
- Database verification first failed because final snapshots had no required report JSON and still defaulted to schema version 1, then passed after the unshared migration and Prisma model were updated.
- A cross-cycle trend test first failed with only the current calibration fixture, then passed after adding distinct prior calibration and current standard-cycle immutable decisions.

## Tests run and result

All commands used Node 24 by prepending `/opt/homebrew/opt/node@24/bin` to `PATH`.

- Employee-evaluation integration suite: 5 files, 21 tests passed.
- Focused contracts and employee-evaluation unit suite: 3 files, 12 tests passed.
- Database migration/schema integration suite: 7 files, 73 tests passed as part of migration verification.
- Evaluation Fact View neutrality evaluation: 1 file, 7 tests passed.
- Contracts, database, and employee-evaluation package typechecks: passed.
- Contracts, database, and employee-evaluation package lint: passed.
- AI-boundary scan: passed; 838 source files inspected.
- Performance-input scan: passed; 686 files inspected.
- Migration verification from an empty database, from migration 0028, drift detection, and rebuild equivalence: passed.
- Scoped Prettier check: passed.
- `git diff --check`: passed.

## Security and privacy impact

- Finalization enforces assigned-manager scope, eligible assignment state, the finalization stage, optimistic version, both immutable submissions, frozen template completeness, change reasons, and source authorization on the server-side domain boundary.
- Final snapshots, decisions, and acknowledgments remain protected by existing database append-only triggers.
- Finalization, acknowledgment, and closure mutation plus audit append share serializable transactions, preventing unaudited partial completion.
- Closure requires the cycle-administration actor recorded on cycle creation and fails when any eligible final snapshot is missing; Task 6 will additionally bind that actor to the authenticated cycle-administration permission.
- Employee report access is self-only and returns the exact immutable context pinned during finalization. Department report access requires exact department and assigned-manager scope, reads only finalized decisions for that manager's eligible assignments, and returns strict anonymous criterion distributions/trends.
- Department reports intentionally omit workflow counts, employee identifiers, readiness values, ranking, narratives, source references, reservations, and private upward-feedback content. They expose no automatic averages.

## Remaining risk

- The protected API composition, authentication binding, discussion-entry write endpoint, and full technical journey are intentionally deferred to E4 Task 6.
- The report-context reader is an injected public boundary; Task 6 must compose it with the protected Evaluation Fact View and optional development-plan reader without bypassing owner-module permissions.
- Arabic employee evaluation content and exports remain gated pending T016 approval and semantic review.

## Project-state update

None. This bounded task implements the already-approved E4 design without changing protected rules, architecture direction, active risks, or the recommended program-level next action.
