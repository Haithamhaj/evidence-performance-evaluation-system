# S4-T1 — GitHub App binding and governed event persistence

## Status

Complete. This change establishes the persistence and contract boundary only. It deliberately does not receive or process GitHub webhooks over the network; that belongs to Slice 4 Task 2.

## What changed

- Added `@evaluation/github-integration`, initially as the module boundary that re-exports the governed GitHub event contract.
- Added the strict `GitHubSourceEvent` contract with only installation, repository, delivery, event/source identifiers, source URL, occurrence time, and `VERIFIED` or `REJECTED` state.
- Added `GitHubAppInstallation`, `GitHubProjectBinding`, `GitHubSourceEvent`, and `GitHubReconciliationCursor` persistence models.
- Added `0022_github_integration` (the approved correction because `0020` and `0021` are already occupied).
- Enforced one active binding per Project/repository pair with a PostgreSQL partial unique index. A binding may close once, but immutable history cannot be reopened or rewritten.
- Enforced delivery idempotency globally, source event append-only behavior, binding-scoped event/cursor ownership, and one cursor per binding.
- Stored normalized `governedFacts` as a JSON array, without raw webhook payloads, GitHub credentials, activity counts, productivity scores, ratings, or rankings.

## RED evidence (TDD)

1. Contract test run before the contract existed:

   ```text
   Cannot find module './github-integration.js'
   ```

   Command:

   ```sh
   PATH=/opt/homebrew/opt/node@24/bin:$PATH corepack pnpm --filter @evaluation/contracts test -- github-integration.test.ts
   ```

2. Schema integration test run before the migration existed:

   ```text
   Raw query failed. Code: 42P01. Message: relation "GitHubAppInstallation" does not exist
   ```

   Command:

   ```sh
   set -a; source .env.test; set +a
   PATH=/opt/homebrew/opt/node@24/bin:$PATH corepack pnpm exec vitest run --project integration packages/database/src/github-integration-schema.integration.test.ts
   ```

3. Binding-history regression test was run against a deliberately trigger-free test schema before restoring the migration trigger:

   ```text
   AssertionError: promise resolved "1" instead of rejecting
   ```

   This demonstrated that a closed binding could be reopened without the guard. Restoring the minimal trigger made the test pass.

## Files changed

- `packages/contracts/src/github-integration.ts`
- `packages/contracts/src/github-integration.test.ts`
- `packages/contracts/src/index.ts`
- `packages/github-integration/package.json`
- `packages/github-integration/tsconfig.json`
- `packages/github-integration/src/index.ts`
- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/0022_github_integration/migration.sql`
- `packages/database/src/github-integration-schema.integration.test.ts`
- `pnpm-lock.yaml`

`pnpm-workspace.yaml` already includes `packages/*`; therefore no workspace-pattern change was needed for the new package.

## Database changes

- New enum: `GitHubEventVerificationState` (`VERIFIED`, `REJECTED`).
- New tables: `GitHubAppInstallation`, `GitHubProjectBinding`, `GitHubSourceEvent`, and `GitHubReconciliationCursor`.
- `GitHubProjectBinding_one_active_project_repository` is a partial unique index for active bindings while retaining prior closed rows.
- Composite foreign keys guarantee events and cursors retain the installation/repository identity of their binding.
- `GitHubSourceEvent.deliveryId` is unique for idempotency, and source events cannot be updated or deleted.
- The migration passed empty-database, prior-snapshot, drift, and rebuild-equivalence verification.

## Verification

All commands passed:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH corepack pnpm db:generate
PATH=/opt/homebrew/opt/node@24/bin:$PATH corepack pnpm --filter @evaluation/contracts test -- github-integration.test.ts
set -a; source .env.test; set +a
PATH=/opt/homebrew/opt/node@24/bin:$PATH corepack pnpm exec vitest run --project integration packages/database/src/github-integration-schema.integration.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH corepack pnpm --filter @evaluation/contracts lint
PATH=/opt/homebrew/opt/node@24/bin:$PATH corepack pnpm --filter @evaluation/github-integration lint
PATH=/opt/homebrew/opt/node@24/bin:$PATH corepack pnpm --filter @evaluation/database lint
PATH=/opt/homebrew/opt/node@24/bin:$PATH corepack pnpm --filter @evaluation/contracts typecheck
PATH=/opt/homebrew/opt/node@24/bin:$PATH corepack pnpm --filter @evaluation/github-integration typecheck
PATH=/opt/homebrew/opt/node@24/bin:$PATH corepack pnpm --filter @evaluation/database typecheck
PATH=/opt/homebrew/opt/node@24/bin:$PATH corepack pnpm scan:performance-inputs
PATH=/opt/homebrew/opt/node@24/bin:$PATH corepack pnpm format:check
set -a; source .env.local; set +a
PATH=/opt/homebrew/opt/node@24/bin:$PATH corepack pnpm db:verify
```

Results: 101 contract tests passed; 4 GitHub schema integration tests passed; affected lint/type checks passed; performance-input scan inspected 504 files with no violations; formatting passed; migration verification passed and also ran 49 existing database integration tests successfully.

## Security and privacy impact

- No GitHub App private key, installation token, access token, raw webhook payload, or private employee content is stored.
- Event records preserve source identifiers and URLs for traceability, not activity-volume metrics.
- There are no performance scores, counts, ratings, ranking fields, or automatic attribution fields.
- Authorization and webhook-signature/network handling are intentionally deferred to the next task; this task exposes no API or network route.

## Remaining risk

- Task 2 must validate webhook signatures before persistence and use the binding/event schema transactionally.
- A future reconciliation worker must use the cursor without turning fetched GitHub activity into performance metrics, and must keep employee confirmation as the gate before evidence becomes a contribution record.
- Binding lifecycle authorization/audit commands are not introduced in this persistence-only task and must be owned by the relevant application workflow.

## Project state

No `project-state/PROJECT_STATE.md` update: this is a bounded persistence foundation within an active Slice, not a completed architectural phase or a protected-rule change.

## Fix Round 1 — binding-history immutability

### Finding addressed

The initial binding-history trigger protected updates but allowed an event-free/cursor-free binding to be deleted. It also allowed `createdAt` to change during the single permitted close transition. Both paths violated preserved binding history.

### RED evidence

Added two integration regressions, then ran:

```sh
set -a; source .env.test; set +a
PATH=/opt/homebrew/opt/node@24/bin:$PATH corepack pnpm exec vitest run --project integration packages/database/src/github-integration-schema.integration.test.ts
```

Result: 2 failures, both expected:

```text
does not allow an event-free binding history row to be deleted
AssertionError: promise resolved "1" instead of rejecting

does not allow creation history to change while closing a binding
AssertionError: promise resolved "1" instead of rejecting
```

### GREEN implementation and evidence

- Extended `GitHubProjectBinding_guard_history` to run `BEFORE UPDATE OR DELETE`.
- Deleted bindings now always raise `23514`.
- The one permitted close transition now compares `createdAt` along with every other immutable binding field; it therefore permits only `unboundAt` and `updatedAt` to change.

After applying the changed migration definition to the local test schema, the focused test command passed:

```text
Test Files  1 passed (1)
Tests  6 passed (6)
```

Follow-up verification also passed:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH corepack pnpm --filter @evaluation/database lint
PATH=/opt/homebrew/opt/node@24/bin:$PATH corepack pnpm --filter @evaluation/database typecheck
PATH=/opt/homebrew/opt/node@24/bin:$PATH corepack pnpm scan:performance-inputs
PATH=/opt/homebrew/opt/node@24/bin:$PATH corepack pnpm format:check
set -a; source .env.local; set +a
PATH=/opt/homebrew/opt/node@24/bin:$PATH corepack pnpm db:verify
```

Results: database lint/typecheck passed; performance scan inspected 504 files with no violations; formatting passed; and migration verification passed for empty database, previous snapshot, drift, and rebuild equivalence.
