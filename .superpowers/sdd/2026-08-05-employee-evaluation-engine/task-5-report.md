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
- Added self-only employee reports and assigned-manager department completion aggregates. Department projections contain no employee identifiers, individual narratives, citations, reservation text, readiness values, rankings, or private upward-feedback content.

## Files changed

- `.superpowers/sdd/2026-08-05-employee-evaluation-engine/task-5-report.md`
- `packages/employee-evaluation/package.json`
- `packages/employee-evaluation/src/index.ts`
- `packages/employee-evaluation/src/comparison-service.ts`
- `packages/employee-evaluation/src/comparison-service.test.ts`
- `packages/employee-evaluation/src/finalization-service.ts`
- `packages/employee-evaluation/src/finalization-service.integration.test.ts`
- `packages/employee-evaluation/src/report-reader.ts`
- `packages/employee-evaluation/src/report-reader.integration.test.ts`

## Database changes

None. This task uses the existing append-only final snapshot, final decision, acknowledgment, cycle transition, idempotency, and audit schema introduced by the preceding E4 engine tasks. The existing database triggers reject updates and deletes of final snapshots, decisions, and acknowledgments.

## TDD evidence

- Comparison tests were written first and failed because `comparison-service.js` did not exist, then passed after the minimal explainable comparison implementation.
- Finalization integration tests were written first and failed because `finalization-service.js` did not exist, then passed after transactional finalization, acknowledgment, closure, and audit behavior was implemented.
- Report-reader integration tests were written first and failed because `report-reader.js` did not exist, then passed after the fail-closed employee and department readers were implemented.

## Tests run and result

All commands used Node 24 by prepending `/opt/homebrew/opt/node@24/bin` to `PATH`.

- Employee-evaluation integration suite: 5 files, 21 tests passed.
- Employee-evaluation unit suite: 2 files, 6 tests passed.
- Evaluation Fact View neutrality evaluation: 1 file, 7 tests passed.
- Employee-evaluation package typecheck: passed.
- Employee-evaluation package lint: passed.
- Performance-input scan: passed; 686 files inspected.
- Scoped Prettier check: passed.
- `git diff --check`: passed.

## Security and privacy impact

- Finalization enforces assigned-manager scope, eligible assignment state, the finalization stage, optimistic version, both immutable submissions, frozen template completeness, change reasons, and source authorization on the server-side domain boundary.
- Final snapshots, decisions, and acknowledgments remain protected by existing database append-only triggers.
- Finalization, acknowledgment, and closure mutation plus audit append share serializable transactions, preventing unaudited partial completion.
- Closure requires the cycle-administration actor recorded on cycle creation and fails when any eligible final snapshot is missing; Task 6 will additionally bind that actor to the authenticated cycle-administration permission.
- Employee report access is self-only. Department report access requires exact department and assigned-manager scope, filters every count to that manager's assignments, and returns only strict aggregate fields.

## Remaining risk

- The protected API composition, authentication binding, discussion-entry write endpoint, and full technical journey are intentionally deferred to E4 Task 6.
- Department reporting currently exposes the strict approved completion aggregate contract. Richer anonymous distributions or longitudinal trends require a future versioned contract and privacy review; this task does not infer or add them.
- Arabic employee evaluation content and exports remain gated pending T016 approval and semantic review.

## Project-state update

None. This bounded task implements the already-approved E4 design without changing protected rules, architecture direction, active risks, or the recommended program-level next action.
