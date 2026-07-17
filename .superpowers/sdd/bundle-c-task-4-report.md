# Bundle C Task 4 Report

## Task

T026/T027 criteria proposals and mandatory owner review.

## What changed

- Added a public, persistence-isolated criteria review reader that resolves one active owner and sorted distinct active contributors at a half-open responsibility timestamp.
- Added versioned project/workstream criteria-generation prompt construction with separate trusted prompt metadata and explicit untrusted document, readiness, and owner-feedback boundaries.
- Added `ProposalService.requestGeneration` to authorize the active owner, pin the current Ready document/readiness/artifact snapshot, and atomically persist the request, versioned ID/hash-only outbox message, and audit event.
- Kept model/source execution outside the API transaction and outside `requestGeneration`; worker completion enters through `persistValidatedGeneration`.
- Added strict kind-specific criterion count enforcement, stale document/readiness/owner suppression, complete seven-field proposal-item persistence, initial append-only transition history, and mandatory owner review.
- Owner review appends proposal transition and audit history without updating proposal items. Project approval becomes approved; workstream approval advances to contributor review for Task 5's frozen-snapshot workflow.

## Files changed

- `packages/projects/src/criteria-review-reader.ts`
- `packages/projects/src/criteria-review-reader.integration.test.ts`
- `packages/projects/src/index.ts`
- `packages/criteria/src/prompts.ts`
- `packages/criteria/src/prompts.test.ts`
- `packages/criteria/src/proposal-service.ts`
- `packages/criteria/src/proposal-service.integration.test.ts`
- `packages/criteria/src/index.ts`

## Database changes

None.

## TDD evidence

RED:

```text
pnpm exec vitest run --root . packages/projects/src/criteria-review-reader.integration.test.ts packages/criteria/src/prompts.test.ts packages/criteria/src/proposal-service.integration.test.ts
```

Failed because `packages/criteria/src/proposal-service.js` did not exist; reader and prompt suites already passed.

GREEN and exact gate, using the repository-pinned runtime:

```text
export PATH=/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:/usr/bin:/bin
node -v
pnpm -v
pnpm exec vitest run --root . packages/projects/src/criteria-review-reader.integration.test.ts packages/criteria/src/invariants.test.ts packages/criteria/src/prompts.test.ts packages/criteria/src/proposal-service.integration.test.ts
pnpm --filter @evaluation/projects typecheck
pnpm --filter @evaluation/criteria lint
pnpm --filter @evaluation/criteria typecheck
pnpm exec prettier --check packages/projects/src/criteria-review-reader.ts packages/projects/src/criteria-review-reader.integration.test.ts packages/projects/src/index.ts packages/criteria/src/prompts.ts packages/criteria/src/prompts.test.ts packages/criteria/src/proposal-service.ts packages/criteria/src/proposal-service.integration.test.ts packages/criteria/src/index.ts
git diff --check
```

Results:

- Node `v24.18.0`; pnpm `11.13.0`.
- 4 test files passed; 29 tests passed.
- Projects typecheck passed.
- Criteria lint and typecheck passed.
- Prettier and diff check passed with clean output.

## Security and privacy impact

- No rating, ranking, productivity, automatic-average, or readiness-score fields were introduced.
- No document bytes, URLs, comments, credentials, or readiness detail enter the outbox payload.
- Prompt metadata remains structurally separate from all untrusted content.
- Request, outbox, and audit records share one transaction.
- Owner review is server-side, current-owner scoped, append-only, and cannot mutate criterion content.

## Remaining risk / next boundary

- Task 5 owns the frozen workstream owner/contributor review snapshot and contributor-response workflow after owner approval.
- Task 7 owns the durable outbox dispatcher and worker orchestration that loads sources, invokes the AI Router outside database transactions, and calls `persistValidatedGeneration`.
- No live provider call, migration, protected-rule change, or project-state update was made.
