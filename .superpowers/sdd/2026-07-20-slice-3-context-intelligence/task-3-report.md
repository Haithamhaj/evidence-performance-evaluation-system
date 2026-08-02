# Slice 3 Task 3 Report — Routed Context Summaries and Task Drafts

## Status

Complete.

- Task ID: `P2R-S3 / S3-T3`
- Feature commit: `ad8dc30c1d5ac1962432fae8fc8a9c95bc99945d`
- Commit message: `feat(context-ai): add routed summaries and task drafts`
- Branch: `codex/phase-2-updates-evidence-readiness`
- Worktree: `.worktrees/phase-2-updates-evidence-readiness`
- Push: not performed

## RED evidence

Tests and AI evaluations were written before production implementation. The first RED command used
the repository-pinned Node.js `24.18.0` and pnpm `11.13.0`:

```text
pnpm exec vitest run \
  packages/context-intelligence/src/prompts.test.ts \
  packages/context-intelligence/src/analysis-service.integration.test.ts \
  packages/context-intelligence/src/task-draft-service.integration.test.ts \
  apps/api/src/ai-routing/system-ai-scope.test.ts \
  tests/ai/context-intelligence.eval.test.ts

Test Files  5 failed (5)
```

Four suites failed because the required prompt, analysis, and Task-draft production modules did not
exist. The system-scope suite loaded and its new test failed because
`resolveContextIntelligenceSystemAiScopes` did not exist; its three pre-existing tests passed. This
was the expected missing-behavior failure rather than a baseline failure.

A later hardening RED added two regressions before their implementation:

```text
pnpm exec vitest run packages/context-intelligence/src/prompts.test.ts

Test Files  1 failed (1)
Tests       2 failed | 3 passed (5)
```

Those tests proved that a derived Context Analysis was not yet re-delimited before Task drafting and
that the AI Task output schema still accepted an empty description. Both now fail closed.

## What changed

- Added one versioned route manifest with the exact governed routes:
  - `context.summarize.v1`
  - `context.project-match.v1`
  - `task.draft.v1`
- Added independent input-schema, output-schema, and prompt-template versions for every route.
- Added strict structured-output schemas and trusted prompts that keep output source-labelled,
  grounded, uncertain when context is missing, and free of rating, ranking, productivity,
  activity-volume, readiness-conversion, and employee-quality judgments.
- Added bounded input builders for email, event, document, code, and comment sources. Untrusted
  content is normalized, control characters and spoofed boundaries are escaped, and each source is
  strongly delimited. Approved Project document context and derived Context Analysis are also
  delimited before model reuse.
- Added `ContextAnalysisService`, which obtains only registered prompt artifacts, sends summary and
  Project-explanation requests through the existing `AiRouter`, validates source grounding and the
  succeeded immutable run trace, encrypts the structured summary output, and appends the governed
  Context Analysis.
- Combined the Task 2 deterministic Project decision with an AI explanation while leaving the
  deterministic decision authoritative. The AI output contains no decision field and cannot turn
  `REVIEW` or `NO_MATCH` into `AUTO_LINK`.
- Added `TaskDraftService`, which runs only `task.draft.v1`, rejects a model-supplied Project that
  conflicts with the deterministic decision, validates grounding and route lineage, encrypts the
  full structured draft, and appends only a pending employee-reviewable Task-draft record.
- Added exact system-scope resolution for the three Context Intelligence routes and no others.
- Added the required AI-evaluation workspace pattern so `tests/ai/context-intelligence.eval.test.ts`
  runs under the existing `ai-evals` project.

No provider SDK, direct provider endpoint, official Task creation, Project mutation, or live Google
integration was added. No paid live-model call was required for this task; the executable tests use
deterministic governed-router fixtures.

## Files changed

- `apps/api/package.json`
- `apps/api/src/ai-routing/system-ai-scope.ts`
- `apps/api/src/ai-routing/system-ai-scope.test.ts`
- `packages/context-intelligence/package.json`
- `packages/context-intelligence/src/index.ts`
- `packages/context-intelligence/src/project-link-suggestion-service.ts`
- `packages/context-intelligence/src/prompts.ts`
- `packages/context-intelligence/src/prompts.test.ts`
- `packages/context-intelligence/src/analysis-service.ts`
- `packages/context-intelligence/src/analysis-service.integration.test.ts`
- `packages/context-intelligence/src/task-draft-service.ts`
- `packages/context-intelligence/src/task-draft-service.integration.test.ts`
- `tests/ai/context-intelligence.eval.test.ts`
- `vitest.workspace.ts`
- `pnpm-lock.yaml`

The lockfile was regenerated with pnpm `11.13.0`; its final diff is nine additions and no removals,
covering only the API workspace link and the package's direct AI Router and Zod dependencies.

## Database changes

None. Task 1 already supplied the append-only encrypted Context Analysis, Project-link suggestion,
Task-draft, correction, and immutable AI-run persistence contracts. This task adds domain services
and narrow persistence ports but no migration or schema change.

## Verification

All final commands used Node.js `24.18.0` and pnpm `11.13.0`.

| Check                                                 | Result                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| Focused Task 3 suite                                  | 5 files, 29 tests passed                                    |
| `pnpm --filter @evaluation/context-intelligence test` | 7 files, 34 tests passed                                    |
| `pnpm test:ai -- context-intelligence`                | 6 files, 163 passed and 1 skipped                           |
| API system-scope suite                                | 1 file, 4 tests passed                                      |
| `pnpm scan:ai-boundary`                               | 580 source files valid                                      |
| `pnpm lint`                                           | 22/22 packages passed; boundary and user-copy checks passed |
| `pnpm typecheck`                                      | 22/22 packages passed                                       |
| `pnpm test`                                           | task graph 14/14; 127 files and 873 tests passed            |
| `pnpm scan:performance-inputs`                        | 476 files valid                                             |
| `pnpm scan:secrets`                                   | 950 files valid                                             |
| `pnpm format:check`                                   | passed                                                      |
| `git diff --check`                                    | passed                                                      |
| Lockfile diff check                                   | 9 additions, 0 removals                                     |

## Security and privacy impact

- All model execution stays behind the existing governed AI Router; the AI boundary scanner found
  no direct-provider path.
- The services accept only registered prompt artifacts whose route, version, trusted body, and
  SHA-256 hash exactly match the compiled manifest.
- Every persisted result must match a succeeded immutable AI-run trace, exact route, output-schema
  version, prompt-template version, output reference, and governed source-reference set.
- Provider credentials, access tokens, model keys, provider names, usage, and cost are not copied
  into Context Intelligence persistence.
- Connected-source content is classified `confidential`. Derived summary and Task-draft payloads are
  sealed before append, and the persistence ports receive the ciphertext and key version required
  by Task 1's encrypted-at-rest schema alongside the validated domain record.
- Source references are opaque governed identifiers. Invented or out-of-scope references are
  rejected before feature persistence.
- Prompt-injection fixtures cover email, event, document, code, and comment content, including
  spoofed boundaries. Arabic and mixed Arabic/English technical text remain intact.
- AI failure does not alter or delete raw source input, and the services expose no official Task
  creation capability.
- Employee review remains mandatory: all AI runs request human approval and every new governed
  record starts in `PENDING` with `AI` revision origin.

## Protected-rule confirmation

- AI does not assign, predict, or recommend a rating, employee rank, productivity score, readiness
  conversion, activity-count performance inference, or employee quality judgment.
- Documentation Readiness does not become a performance score.
- Deterministic Project matching remains authoritative; model confidence is not an anchor and AI
  cannot upgrade `REVIEW` or `NO_MATCH`.
- AI output remains a source-labelled draft interpretation rather than a source fact.
- No official Task is created or assigned automatically.
- No raw activity count becomes a metric and no Project/evaluation weighting or rating behavior is
  introduced.
- No historical row is overwritten and no protected evaluation, feedback-visibility, privacy,
  Arabic-release, or retention rule changes.

## Remaining risk and follow-up boundary

The existing `AiRouter.commitSucceededRun` contract creates the immutable `AiRun` only after its
validated-output callback returns. Task 1's Context Intelligence rows have a foreign key to that
`AiRun`, so this task must append the feature row after the router transaction completes. If the
post-run encryption or append fails, the raw/manual workflow remains available and no invalid
feature row is written, but a succeeded `AiRun` can remain without its corresponding Context
Intelligence row. Resolving that narrow atomicity gap requires an approved AI Router transaction
extension or a reconciler; changing the shared router contract was outside Task 3 scope.

Task 4 still owns concrete persistence/API adapters, server-side employee/source ownership and
Project authorization enforcement, idempotent employee confirmation, and official Work Item
creation only after that confirmation. Live Google remains outside this task's scope.

## Self-review

- Re-read the exact Task 3 brief, Slice 3 plan, protected product rules, Task 1 contracts, Task 2
  deterministic matcher, and existing AI Router before implementation.
- Confirmed the route strings occur only as the exact three approved keys and that the feature
  package has no Work Items dependency.
- Confirmed prompt/schema changes are versioned and covered by the required AI evaluations,
  including Arabic/mixed text and prompt-injection cases.
- Confirmed the final lockfile contains only the intended importer changes.
- Confirmed the branch-finishing choice is to keep the named branch and its worktree as-is; the
  parent task explicitly prohibited pushing or merging from this subtask.

## Project-state update

None. This bounded Task 3 implementation does not change the current Slice 3 goal, architecture
direction, protected decisions, or external Product Owner gates. The parent Slice 3 checkpoint owns
the meaningful project-state update after the slice boundary is integrated.
