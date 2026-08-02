# Slice 3 Task 4 Report — Protected Review and Human Confirmation APIs

## Status

Complete.

- Task ID: `P2R-S3 / S3-T4`
- Feature commit: `7714f8fc8718f4d01abe54502ff5936f9ffbb76a`
- Commit message: `feat(api): expose context review and task confirmation`
- Branch: `codex/phase-2-updates-evidence-readiness`
- Push: not performed

## RED evidence

All RED/GREEN commands used the repository-pinned Node.js `24.18.0` and pnpm `11.13.0`.

The protected HTTP integration test was created before its controllers and guard. Its first valid
run failed during collection with the expected missing production boundary:

```text
Cannot find module './context-analysis.controller.js'
Test Files  1 failed (1)
Tests       no tests
```

The public Work Items transaction test was also written before implementation. With the local test
database configured, its first focused run reached the real service and failed for the intended
missing method:

```text
TypeError: service.createConfirmedTask is not a function
Test Files  1 failed (1)
Tests       1 failed | 3 skipped (4)
```

The minimal transaction-aware Work Items entry point was then implemented and the same test passed
before the API workflow composition was added.

## What changed

The API now exposes the six exact protected endpoints:

```text
POST /api/v1/context/items/:id/analyze
GET  /api/v1/context/review-queue
POST /api/v1/context/project-suggestions/:id/confirm
POST /api/v1/context/project-suggestions/:id/correct
POST /api/v1/context/task-drafts
POST /api/v1/context/task-drafts/:id/confirm
```

- Added one active-principal Context Intelligence guard over both controllers.
- Registered `ContextIntelligenceModule` in `AppModule`.
- Composed private source reads through `ConnectedWorkContextQueryService`; the Context module does
  not read Connected Work Context tables.
- Reused the existing connected-context Project-link service for employee confirmation/correction
  effects and exported its existing governed protector to the importing module.
- Reused `ProjectService` for current employee Project authorization; no Project table is read by
  Context Intelligence.
- Wired Task 3's Router-backed analysis, suggestion, and Task-draft services to concrete encrypted,
  append-only Context Intelligence persistence adapters.
- Added an employee-only review queue that filters every derived row through the currently
  accessible connected-source set before decrypting it.
- Returned useful editable Task drafts even when optional due date, Workstream, or acceptance
  conditions remain uncertain. Focused clarification contains only missing confirmation-required
  `projectId` and responsible `assigneeId` fields.
- Added `WorkItemService.createConfirmedTask(transaction, command)` as the public transaction-aware
  Work Items boundary. A stable Work Item identity makes response-loss retries return the same Task;
  a changed retry payload fails with `IDEMPOTENCY_CONFLICT`.

`apps/api/package.json` already contained the direct `@evaluation/context-intelligence` dependency
from Task 3, so no duplicate manifest or lockfile edit was necessary.

## Authorization and transaction behavior

- Every route authenticates on the server and rejects an inactive principal before feature work.
- Analysis and draft preparation call the owner-scoped connected-context public reader. Missing,
  cross-employee, excluded, disconnected, deleted, or otherwise inaccessible private sources fail
  closed.
- Review queue rows are selected by authenticated employee ID and then intersected with the public
  reader's currently accessible source IDs. Another employee or manager receives an empty queue and
  no private derived text, source ID, or Project suggestion.
- Project confirmation/correction loads only the authenticated employee's suggestion, checks the
  exact expected revision, rejects an already-superseded revision, and rechecks current Project
  access before applying a link.
- Task confirmation locks the route-bound Task draft, requires the exact expected revision, rejects
  an existing non-confirmation superseder, and rechecks source access before starting the write.
- The public Work Items service rechecks the Project state, current employee membership, Workstream
  scope/state, and responsible assignee eligibility inside the same serializable transaction.
- Official Task creation, initial assignment history, Work Item audit, append-only confirmed Task
  draft revision, and Context confirmation audit commit or roll back together.
- Stable confirmation and Work Item IDs plus payload comparison make retry after response loss safe.
  A retry cannot create a second Task, assignment history row, or confirmation revision.
- AI preparation never calls the Work Items service. Only the authenticated human confirmation
  endpoint can create and assign the official Task.

## Files changed

- `apps/api/src/context-intelligence/context-intelligence.module.ts`
- `apps/api/src/context-intelligence/context-analysis.controller.ts`
- `apps/api/src/context-intelligence/task-drafts.controller.ts`
- `apps/api/src/context-intelligence/context-intelligence-policy.guard.ts`
- `apps/api/src/context-intelligence/context-intelligence.e2e.integration.test.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/connected-work-context/connected-work-context.module.ts`
- `packages/work-items/src/service.ts`
- `packages/work-items/src/service.integration.test.ts`

## Database changes

None.

- No migration, schema, constraint, index, seed, or backfill changed.
- Task 1's append-only `ContextAnalysis`, `ProjectLinkSuggestion`, `TaskDraft`, and
  `SourceLinkCorrection` tables are reused.
- Confirmation is a new employee-authored revision; no historical Context Intelligence row is
  updated or deleted.
- The existing Work Item and assignment-history records are written through the Work Items domain.

## Verification

Fresh final verification after formatting:

| Check                                                                      | Result                                                                |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Full API package tests                                                     | 38 files passed, 1 intentionally skipped; 171 tests passed, 1 skipped |
| Full Work Items package tests                                              | 5 files, 22 tests passed                                              |
| Focused Context Intelligence HTTP/transaction suite after final formatting | 1 file, 8 tests passed                                                |
| API typecheck                                                              | passed                                                                |
| Work Items typecheck                                                       | passed                                                                |
| API lint                                                                   | passed                                                                |
| Work Items lint                                                            | passed                                                                |
| AI/module boundary scan                                                    | 585 source files valid                                                |
| Protected performance-input scan                                           | 481 files valid                                                       |
| Secret scan                                                                | 959 files valid                                                       |
| Repository formatting check                                                | passed                                                                |
| `git diff --check`                                                         | passed                                                                |

The transaction suite uses the real `ContextIntelligenceApplicationService` and real public
`WorkItemService` with a rollback-capable deterministic persistence fixture. It proves one official
Task/assignment/confirmation across two identical requests and proves both Task and confirmation
are absent when the protected audit fails.

## Security and privacy impact

- Private connected content is decrypted only through the existing governed protector and only
  after owner/current-source authorization.
- Context Analysis, Project-match explanation, Task draft, and employee reasons remain encrypted at
  rest with key-version lineage. No raw private body is written to audit metadata.
- No controller accepts actor identity, source references, AI route/provider/model selection,
  ciphertext, key version, or storage identity from the client.
- Confirmation accepts only shareable official Task fields. Private uncertainties and source
  references remain server-owned and are not copied into the official Task.
- Audit safe diffs contain identifiers and lifecycle state only. No credentials, tokens, source
  content, model output, or protected reason text is logged.
- Live Google remains behind the existing external OAuth, credential, scope, retention, deletion,
  consent, and production-key gates. This task did not enable or simulate a live connector.

## Protected-rule confirmation

- No rating, rating recommendation, rank, productivity score, readiness percentage, evidence quota,
  Project average, or activity-volume metric was added.
- No AI path creates or assigns an official Task.
- No Project progress, Progress Contract, performance, evidence, evaluation, or manager-feedback
  behavior changed.
- No historical Context Intelligence or protected Project row is updated in place.
- No protected product rule, rubric, weight, visibility mode, Arabic release gate, or retention rule
  changed.

## Self-review

- Authorization mutation: removing the owner/source check exposes the cross-employee analysis test;
  removing current Project authorization exposes the revoked-membership test.
- Privacy mutation: returning unfiltered queue rows exposes the other-employee/manager empty-response
  and private-text assertions.
- Concurrency mutation: removing the Task-draft lock/version check exposes the stale-version test;
  removing stable identity or payload validation exposes the public Work Items retry/conflict test.
- Atomicity mutation: moving Work Item creation outside the serializable transaction exposes the
  protected-audit rollback test.
- Human-gate mutation: calling Work Items from analysis/draft preparation would create a Task before
  the confirmation tests and violates the workflow separation.
- Boundary review: Context Intelligence reads only its own tables plus the generic AI trace/prompt
  records required by Task 3; Connected Context and Projects remain behind public services.
- Response review: source references, credentials, ciphertext, key versions, provider settings, and
  raw protected content are absent from controller response construction.

## Remaining risk

- Actual model execution still depends on Task 3's registered Router routes, trusted prompt
  artifacts, approved provider configuration, and runtime credential. Configuration absence fails
  closed; the API integration suite does not make a live paid-model call.
- The current production anchor composition exposes the deterministic employee-confirmed source
  Project mapping available from Connected Work Context. Additional governed sender, Calendar,
  repository, and approved-document anchor adapters can be added through Task 2's public reader
  ports without changing these protected confirmation contracts.
- As already recorded for Task 3, a Router run can commit before a later feature-row append fails,
  leaving an orphan succeeded run. It cannot create an official Task or persist an invalid draft;
  the shared Router reconciler/transaction extension remains a deferred P2.

## Project-state update

None. This bounded API task advances the existing Slice 3 goal without changing architecture,
protected decisions, active risks, or the recommended slice-level next action. The parent Slice 3
checkpoint should update project state when the full slice reaches its meaningful boundary.
