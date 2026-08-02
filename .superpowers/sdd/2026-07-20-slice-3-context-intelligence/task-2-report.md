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
