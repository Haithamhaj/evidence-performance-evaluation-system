# AI-first Daily Workspace — Slice 5 Acceptance

**Status:** Ready for Product Owner review

**Branch:** `codex/phase-2-slice-5-operational-readiness`

**Pull Request:** [#10](https://github.com/Haithamhaj/evidence-performance-evaluation-system/pull/10)

**Acceptance date:** 2026-08-04

**Confidence:** High for the deterministic product, authorization, immutability, localization, and browser journeys described below.

## Outcome

Slice 5 moves Project-progress governance out of the employee's daily update flow. A Project owner now reviews and edits an AI-prepared proposal in a short guided setup, then explicitly creates, submits, and activates the contract. Employees receive a compact operational pulse, Thursday check-ins only when needed, and non-scoring monthly record gaps. Managers receive action queues instead of employee score-like dashboards.

This slice does not implement employee performance evaluation. Project progress remains operational Project state only.

## Accepted journeys

### 1. Project owner progress setup

1. The approved Project document supplies the versioned source.
2. Deterministic AI proposes measurable components as a draft only.
3. The owner reviews the proposal and its ambiguity.
4. The owner edits the measurable rules and records a reason.
5. Applying creates an ordinary contract draft.
6. Submission is a separate human action.
7. Activation is a separate protected human action.

The browser journey proves that no activation control exists while the proposal is still an AI draft. It also proves the complete revision, draft, submission, and activation sequence.

### 2. Employee Project pulse

The employee sees, in this order:

- what changed;
- what is blocked;
- which evidence is still required;
- the next milestone;
- the last accepted official Project progress.

When source coverage is incomplete, the previous official percentage remains unchanged. The percentage is explicitly labelled as Project progress and not employee performance.

### 3. Thursday check-in and monthly readiness

The Thursday card appears only when a responsible employee has no substantive confirmed update for the current Workstream week. Starting it prefills the existing Updates & Evidence composer instead of introducing another update lifecycle.

Monthly readiness returns named documentation gaps and corrective actions. It contains no readiness percentage, evidence quota, automatic penalty, employee rank, or performance result.

### 4. Manager operations

The manager receives five operational queues:

- approvals waiting;
- blocked Projects;
- ambiguous progress evidence;
- ownership gaps;
- upcoming commitments.

The response contains no employee identifier, individual readiness value, ranking, productivity score, predicted rating, or completion leaderboard. Employee quick-add and quick-update controls are absent from the manager operations page.

## Protected-boundary verification

| Boundary | Verified result |
| --- | --- |
| AI activation | AI produces a versioned proposal only; human revision, submission, and activation remain mandatory. |
| Official progress | No direct overall-percentage entry or override was added. Incomplete sources retain the last accepted value. |
| Prohibited inputs | Work Item volume, update frequency, commits, files, and lines changed are not progress-calculation inputs. |
| Employee evaluation | Project progress and documentation readiness do not produce employee ratings or recommendations. |
| Manager privacy | Manager operations omit individual readiness values, employee rankings, and score-like projections. |
| History | Contract decisions and official progress continue through versioned or append-only domain services. |
| Authorization | Owner scope, current responsibility, department-manager scope, and negative access cases are enforced server-side. |
| Localization | English/LTR and Arabic/RTL journeys pass, including a 390 px manager view without horizontal overflow. |

## Visual evidence

- [Owner activates a human-reviewed contract](../product/screenshots/ai-first-daily-workspace/slice-5/01-en-owner-progress-contract.png)
- [Employee Project pulse](../product/screenshots/ai-first-daily-workspace/slice-5/02-en-employee-project-pulse.png)
- [Thursday check-in enters the normal Update flow](../product/screenshots/ai-first-daily-workspace/slice-5/03-en-check-in-update.png)
- [Non-scoring monthly readiness](../product/screenshots/ai-first-daily-workspace/slice-5/04-en-monthly-readiness.png)
- [Manager operational queues](../product/screenshots/ai-first-daily-workspace/slice-5/05-en-manager-operations.png)
- [Arabic manager operations at 390 px](../product/screenshots/ai-first-daily-workspace/slice-5/06-ar-manager-operations-mobile.png)

## Executed verification

| Check | Result |
| --- | --- |
| Repository verification (`pnpm verify`) | Passed: task graph, secret scan, performance-input scan, formatting, 23 lint tasks, AI boundary and copy checks, 23 typechecks, 1004 unit/coverage tests, and 23 builds. |
| Related integration suite | Passed: 586 tests; 13 intentional skips. |
| Migration verification | Passed: 26 migrations on an empty database, previous snapshot, drift check, and rebuild equivalence; 49 database integration checks. Slice 5 itself adds no migration. |
| Complete browser suite | Passed: 38 journeys; 4 intentional skips for superseded Update flows. |
| Slice 5 browser checkpoint | Passed: 4 owner, employee, manager, and Arabic-mobile journeys. |
| AI evaluations | Not rerun because Slice 5 changes no AI prompt, output schema, or model route. Existing AI boundary checks passed. |

## Bounded reviews

### Specification compliance

The implementation was compared with the seven global Slice 5 constraints and every S5-T1 through S5-T6 acceptance item. No unresolved P0/P1 deviation remains.

### Authorization, security, and immutability

The review covered contributor denial, expired owner responsibility, cross-Project/Workstream access, stale revisions, active-version immutability, manager department scope, protected response fields, and AI Router/provider boundaries. No unresolved P0/P1 finding remains.

## Known, non-blocking limitations

1. The check-in service has an approved-leave boundary and verified exclusion behavior, but the production adapter currently returns no leave because the broader live leave source is not yet present. Connecting that source must preserve the existing exclusion test and authorization boundary.
2. Manager operations links documentation readiness and evaluation to separate route namespaces, as required. Their complete destination experiences are intentionally not implemented in Slice 5: manager readiness is a later bounded experience, and the complete evaluation workflow remains Phase 3.
3. The acceptance browser uses deterministic AI and deterministic operational fixtures. No paid provider call is needed because this slice changes no prompt or schema.

## Technical acceptance checkpoint

Slice 5 is technically accepted. Its domain behavior, authorization, privacy, history, localization
foundation, integration, and recovery paths are verified with no unresolved P0/P1 finding.

The owner setup, employee pulse, readiness, and manager-queue pages are provisional verification
surfaces. They are not the final frontend and do not provide sufficient evidence for Product Owner
usability, visual-design, or customer-journey acceptance.

The approved engine-first sequence permits Slice 6 to begin after Pull Request #10 merges with all
required checks green. Product acceptance is deferred until the complete engine has been inventoried and
exposed through the dedicated final frontend.
