# Slice 3 Task 2 Report — Deterministic Project Matching

## Status

Complete.

- Task ID: `P2R-S3 / S3-T2`
- Feature commit: `66b92174dfc1414db78fe226b47d8945bec86e9d`
- Commit message: `feat(context-ai): add explainable project matching policy`
- Branch: `codex/phase-2-updates-evidence-readiness`
- Worktree: `.worktrees/phase-2-updates-evidence-readiness`
- Push: not performed

## RED evidence

Tests were written before production code. The first valid RED run used the repository-pinned
Node.js `24.18.0` and pnpm `11.13.0`:

```text
corepack pnpm --filter @evaluation/context-intelligence test

Test Files  3 failed (3)
Tests       no tests

Cannot find module './matching-policy.js'
Cannot find module './project-anchor-reader.js'
Cannot find module './project-semantic-context-reader.js'
```

This was the intended failure: the focused tests loaded successfully far enough to prove the three
required production modules were absent. An earlier command attempt on Node.js 22/pnpm 9 was
rejected by the repository engine gate before test collection and was not counted as RED evidence.

## What changed

- Added a pure rejection-first `LinkDecision` policy.
- Added bounded, time-aware Project anchor signals through injected public Project/authorization
  readers; Context Intelligence does not read Project tables.
- Added an approved-version semantic context adapter through an injected Documents public reader;
  Context Intelligence does not read Document tables or arbitrary document fields.
- Re-exported the three Task 2 public modules from `@evaluation/context-intelligence`.
- Added focused unit and public-boundary integration coverage.

## Files changed

- `packages/context-intelligence/src/index.ts`
- `packages/context-intelligence/src/matching-policy.ts`
- `packages/context-intelligence/src/matching-policy.test.ts`
- `packages/context-intelligence/src/project-anchor-reader.ts`
- `packages/context-intelligence/src/project-anchor-reader.integration.test.ts`
- `packages/context-intelligence/src/project-semantic-context-reader.ts`
- `packages/context-intelligence/src/project-semantic-context-reader.integration.test.ts`

This report is the only additional file and is committed separately so it can reference the final
feature SHA truthfully.

## Behavior

### Automatic linking

`AUTO_LINK` is returned only when exactly one accessible Project has either:

1. a current, non-conflicting `EXPLICIT_USER_MAPPING`; or
2. at least two distinct, current, non-conflicting governed anchor kinds.

The returned anchors preserve source references for the governed persisted explanation.

### Rejection-first outcomes

- Conflicting anchors return `REVIEW` with `CONFLICTING_ANCHORS`.
- One governed anchor or duplicate anchors of one kind return `REVIEW` with
  `INSUFFICIENT_INDEPENDENT_ANCHORS`.
- A stale explicit mapping returns `REVIEW` with `STALE_MAPPING`.
- Model confidence without a governed anchor returns `REVIEW` with
  `MODEL_CONFIDENCE_IS_NOT_AN_ANCHOR`.
- Two independently eligible Projects return `REVIEW` with `COMPETING_PROJECTS`.
- When every candidate Project is inaccessible, the policy returns `NO_MATCH`; inaccessible
  Projects are not exposed as review candidates.

### Bounded anchors

The reader accepts only Task 1's governed anchor kinds:

- `CONFIRMED_SENDER_DOMAIN`
- `CALENDAR_CONTEXT`
- `EXPLICIT_PROJECT_REFERENCE`
- `PRIOR_EMPLOYEE_CORRECTION`
- `GOVERNED_REPOSITORY_BINDING`
- `EXPLICIT_USER_MAPPING`

An unknown kind such as model similarity fails closed before it reaches the matching policy.

### Approved Project semantic context

The adapter returns only these fields from the Documents-owned approved Project version reader:

- purpose
- outcomes
- milestones
- deliverables
- terminology
- stakeholders
- operational KPIs
- acceptance conditions
- evidence requirements

It also returns Project/document/version/source-reference provenance, rejects a mismatched Project
scope, and omits additional fields supplied by the upstream reader.

### Explanation persistence and reversibility

Task 1 already owns the governed `ProjectLinkSuggestion` explanation/anchor persistence and the
`SourceLinkCorrection` correction/rejection lifecycle. Task 2 deliberately does not create a
second store. Its reason codes and source-referenced anchors are the deterministic inputs later
Slice 3 services persist into those existing append-only records. The policy does not mutate an
official Project fact or create an official Task.

## Database changes

None. No migration or schema change was required for Task 2.

## Verification

All final commands used Node.js `24.18.0` and pnpm `11.13.0`.

| Check | Result |
| --- | --- |
| `pnpm --filter @evaluation/context-intelligence test` | 3 files, 15 tests passed |
| `pnpm --filter @evaluation/context-intelligence typecheck` | passed |
| `pnpm --filter @evaluation/context-intelligence lint` | passed |
| `pnpm typecheck` | 22/22 workspace packages passed |
| `pnpm test` | 125 files, 860 tests passed; task graph 14/14 passed |
| `pnpm scan:ai-boundary` | 572 source files valid |
| `pnpm scan:performance-inputs` | 468 files valid |
| `pnpm scan:secrets` | 940 files valid |
| `pnpm format:check` | passed |
| `git diff --check` | passed |

One initial boundary scan was launched concurrently with Prisma generation and encountered a
temporary missing generated file. It was invalid verification evidence. The scan was rerun
serially after generation and passed with 572 source files inspected.

## Security and privacy impact

- No direct Project or Document table read was added.
- Project authorization stays behind an injected public access reader.
- Approved document/version selection and authorization stay behind the Documents public reader.
- Inaccessible Projects are excluded from review output.
- Extra Document fields do not cross the semantic adapter.
- Unknown anchor kinds fail closed.
- No connected-source content, credentials, access tokens, provider keys, or private-mode content
  is logged or persisted by this task.
- No AI provider SDK or route is invoked; model confidence cannot upgrade a decision.
- No manager or cross-employee access surface was added.

## Protected-rule confirmation

- No performance rating, rating recommendation, rank, productivity score, activity-volume metric,
  Project average, or Documentation Readiness value was added.
- No official Task is created or assigned.
- No approved Project document is changed.
- No historical record is overwritten.
- No Project progress or Progress Contract state is changed.
- No protected product, evaluation, feedback-visibility, Arabic-release, or privacy rule changed.

## Self-review

- Requirement review: all Task 2 rejection and acceptance cases are represented in focused tests.
- Boundary review: the package imports only Task 1 contracts; Project/Document persistence remains
  behind narrow public-reader ports.
- Mutation review:
  - lowering the two-kind threshold breaks the one-anchor/duplicate-kind tests;
  - accepting stale anchors breaks the stale-mapping test;
  - trusting model confidence breaks the model-only test;
  - ignoring access breaks the inaccessible-Project test;
  - ignoring conflicts breaks the conflict test;
  - choosing one of two eligible Projects breaks the competition test;
  - widening anchor kinds breaks the fail-closed reader test;
  - leaking extra document fields or accepting mismatched scope breaks semantic-reader tests.
- Scope review: no generic matching platform, second store, official Task behavior, provider call,
  migration, UI, or API was introduced.

## Remaining risks and follow-up boundary

- Task 3/4 must persist these deterministic reasons and anchors into Task 1's governed suggestion
  records and must never allow AI to upgrade `REVIEW` or `NO_MATCH` to `AUTO_LINK`.
- Concrete Projects/Documents runtime adapters must implement the declared public-reader ports with
  the existing server-side authorization rules. These Task 2 tests validate the boundary contract,
  not a future API wiring path.
- User-facing reason copy remains a later localized UI concern; the policy emits stable reason codes
  rather than hard-coded English UI text.

## Project-state update

None. Task 2 does not change the current goal, architecture direction, protected decisions, or
Product Owner gate; the parent Slice 3 checkpoint should update project state when the meaningful
slice boundary changes.

---

# Fix Round 1 — Rejection Ordering and Reversible Persistence

## Status and commit

Complete.

- Fix commit: `c064092d802091b4ad785f4a07571c70ce0b1158`
- Commit message: `fix(context-ai): enforce reversible project link decisions`
- Push: not performed

This section supersedes the earlier statement that Task 3/4 must introduce suggestion persistence.
Task 2 now provides the bounded domain service and atomic persistence port. Later tasks still own
the concrete database adapter and API/runtime wiring.

## Review findings verified

1. `isEligibleForAutomaticLink` considered only current anchors, so a stale explicit mapping was
   ignored when two other current anchors made that same Project eligible.
2. Eligibility was calculated per candidate before any cross-candidate rejection gate, so a
   conflict on one accessible Project did not prevent a different Project from winning.
3. Task 1 had the append-only governed schemas and database records, but Task 2 had no domain
   service or persistence port that emitted those records or created correction/rejection lineage.

## RED evidence

All commands used the pinned Node.js `24.18.0` and pnpm `11.13.0`.

### Mixed stale mapping and cross-Project conflict

```text
corepack pnpm exec vitest run --root . \
  packages/context-intelligence/src/matching-policy.test.ts

Test Files  1 failed (1)
Tests       2 failed | 9 passed (11)
```

Both new regressions expected `REVIEW` but received `AUTO_LINK`:

- stale `EXPLICIT_USER_MAPPING` plus two current independent anchors;
- one otherwise eligible Project plus a conflicting accessible Project and one inaccessible
  Project.

### Missing persistence/reversibility service

```text
corepack pnpm exec vitest run --root . \
  packages/context-intelligence/src/project-link-suggestion-service.test.ts

Test Files  1 failed (1)
Tests       no tests
Error: Cannot find module './project-link-suggestion-service.js'
```

The service tests existed before production code and failed because the required domain service
did not exist.

## Fix behavior

### Rejection-first policy

- Current conflicts and stale explicit mappings are now collected across all accessible candidates
  before any eligibility calculation.
- Any relevant stale mapping returns `REVIEW` with `STALE_MAPPING`, including when that candidate
  also has two other current anchors.
- Any current conflict on an accessible candidate returns `REVIEW` with
  `CONFLICTING_ANCHORS`, including when another candidate is otherwise eligible.
- Inaccessible candidates are filtered before the rejection gate and remain absent from the public
  `REVIEW` result.

### Governed persistence and reversibility

`ProjectLinkSuggestionService` now:

- validates every emitted suggestion and correction with Task 1's existing
  `ProjectLinkSuggestionSchema` and `SourceLinkCorrectionSchema`;
- persists stable deterministic explanation reason codes;
- persists governed anchors and deduplicated source references;
- preserves schema version, prompt version, AI route trace, analysis identity, source identity, and
  revision provenance;
- checks current Project-link authorization through an injected public reader before persisting an
  automatic or employee-corrected Project link;
- scopes correction/rejection loading to the active employee through the persistence boundary;
- creates an employee correction as one `CORRECT` record plus an `AUTO_LINK` superseding revision
  with a deterministic `EXPLICIT_USER_MAPPING` correction anchor;
- creates an employee rejection as one `REJECT` record plus a `NO_MATCH` superseding revision;
- sends the correction and superseding suggestion through one atomic persistence-port method;
- never exposes a Project-fact write, Task write, provider call, or second persistence store.

The concrete adapter must implement `appendCorrectionRevision` transactionally against Task 1's
existing records and use the existing private-content encryption/key-version boundary. That runtime
adapter remains correctly scoped to later Slice 3 wiring.

## Files changed in Fix Round 1

- `packages/context-intelligence/src/index.ts`
- `packages/context-intelligence/src/matching-policy.ts`
- `packages/context-intelligence/src/matching-policy.test.ts`
- `packages/context-intelligence/src/project-link-suggestion-service.ts`
- `packages/context-intelligence/src/project-link-suggestion-service.test.ts`

No database schema, migration, API, UI, Project-fact, or official Task file changed.

## GREEN and final verification evidence

| Command | Result |
| --- | --- |
| focused `matching-policy.test.ts` after policy fix | 11/11 passed |
| focused `project-link-suggestion-service.test.ts` after service implementation | 5/5 passed |
| `pnpm --filter @evaluation/context-intelligence test` | 4 files, 22/22 passed |
| `pnpm --filter @evaluation/context-intelligence typecheck` | passed |
| `pnpm --filter @evaluation/context-intelligence lint` | passed |
| `pnpm typecheck` | 22/22 workspace packages passed |
| `pnpm scan:ai-boundary` | 574 source files valid |
| `pnpm scan:performance-inputs` | 470 files valid |
| `pnpm scan:secrets` | 943 files valid |
| `pnpm format:check` | passed |
| `git diff --check` | passed |

## Security and privacy impact

- Cross-Project rejection now evaluates conflicts only after filtering to accessible Projects, so
  inaccessible candidates neither authorize a link nor appear in the employee review result.
- The service cannot query database tables; it uses an injected owner-scoped persistence port and
  Project authorization public reader.
- A cross-employee correction/rejection receives the same not-found result and creates no revision.
- A correction to an inaccessible Project creates no correction or suggestion revision.
- Explanation/reason text is passed only to the Task 1 persistence boundary; the later concrete
  adapter remains responsible for ciphertext and key-version storage already required by Task 1.
- The atomic port shape prevents the domain service from partially committing a correction without
  its superseding revision.
- No private source content is logged, returned to managers, or converted into a Project fact.

## Protected-rule confirmation

- No rating, recommended rating, rank, productivity score, activity-volume metric, performance
  judgment, or employee evaluation field was added.
- No official Project fact, Project progress value, Progress Contract, Evidence, Update, or Task is
  created or changed.
- Model confidence still cannot authorize `AUTO_LINK`.
- No direct provider SDK, database table read, credential, token, or private-mode content path was
  added.
- No protected product, privacy, historical-record, localization, or evaluation rule changed.

## Self-review and mutation coverage

- Removing the pre-eligibility stale gate fails the new mixed stale/current-anchor regression.
- Removing the cross-candidate conflict gate fails the mixed accessible/inaccessible regression.
- Returning unfiltered candidates fails the inaccessible non-disclosure assertion.
- Dropping reason codes, anchors, or source references fails initial persistence assertions.
- Updating rather than superseding fails correction/rejection revision and lineage assertions.
- Omitting correction authorization or employee ownership fails the negative authorization tests.
- Removing Task 1 schema validation would allow malformed lineage, but the service currently parses
  both records before invoking persistence.

## Deferred P2 ledger candidate

The reviewer observation that exported `ProjectAnchorReader.read` can return candidates marked
`accessible: false` is intentionally deferred. Fix Round 1 preserves the existing internal contract
because the direct required behavior is already enforced mechanically in `decideProjectLink`:
inaccessible candidates are removed before reasons and public review candidates are produced.

Candidate follow-up: consider narrowing the exported reader surface or splitting an internal
diagnostic read from the authorized candidate read when the concrete runtime adapter is wired.
Any follow-up must preserve fail-closed `NO_MATCH`, avoid leaking Project identity, and retain enough
internal state to explain why an inaccessible candidate did not qualify.

## Remaining risk

- The later database adapter must use one transaction, enforce the existing supersession uniqueness
  constraints, seal private explanations/reasons with key versions, and reject a previous revision
  that has already been superseded.
- API/runtime wiring must keep the persistence read employee-owned and must not expose the internal
  inaccessible-candidate diagnostic shape.
