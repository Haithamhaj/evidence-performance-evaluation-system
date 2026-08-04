# Slice 4 — Task 2 Report: GitHub webhook verification and reconciliation

## Status

Completed in the current `phase-2-updates-evidence-readiness` worktree.

## RED / GREEN evidence

- **RED:** `packages/contracts/src/github-integration.test.ts` initially failed because
  `GovernedGitHubFactsSchema` was undefined. The package webhook and reconciliation tests then
  failed because `GitHubWebhookService` and `GitHubReconciliationService` did not exist.
- **GREEN:** the final focused run passed 102 contract tests, 6 GitHub integration package tests,
  3 HTTP boundary tests, and 6 schema integration tests.

## What changed

- Added a strict writer-side `GovernedGitHubFactsSchema`. It permits only bounded PR, check,
  deployment, and commit facts; strict records reject raw webhook payloads and activity-volume
  fields such as `commitCount`.
- Added constant-time `sha256` GitHub HMAC verification. A signature is checked over the raw
  request body before parsing or any durable receipt attempt.
- Added webhook normalization for supported `pull_request` events, active installation/repository
  binding verification, durable-delivery idempotency, and a `202` acknowledgment only after the
  receipt writer reports `created` or `duplicate`.
- Added a deterministic fake GitHub App client for tests and an externally gated production
  client. No live App, installation, provider request, private key, installation token, or
  webhook secret is created or persisted by this task.
- Added reconciliation that recovers normalized missed events and advances a binding cursor only
  after its receipts write. Deleted repositories and rate limits leave the cursor unchanged.
- Added the API module, raw-body webhook endpoint, one GitHub database/audit writer path, and an
  append-only audit event for every new durable source event.
- No evidence suggestion, employee contribution, progress change, performance input, score, or
  raw activity count was added; those remain Task 3 work.

## Files changed

- `packages/contracts/src/github-integration.ts`
- `packages/contracts/src/github-integration.test.ts`
- `packages/github-integration/src/{signature-verifier,webhook-service,reconciliation-service,github-app-client}.ts`
- `packages/github-integration/src/{webhook-service,reconciliation-service}.test.ts`
- `packages/github-integration/src/index.ts`
- `apps/api/src/github-integration/{github-webhook.controller,github-integration.module,github-integration.e2e.integration.test}.ts`
- `apps/api/src/app.module.ts`, `apps/api/package.json`
- `packages/github-integration/{package.json,tsconfig.json}` and `pnpm-lock.yaml`

## Database effect

No migration was added or changed. Task 2 uses Task 1's immutable `GitHubSourceEvent` and
`GitHubReconciliationCursor` tables. It writes only verified, schema-validated normalized facts;
the original raw webhook body is never stored. A new event receives an audit event in the same
database transaction; a replay resolves via the unique `deliveryId` constraint.

## Security and privacy impact

- Signature verification precedes database receipt, body parsing, and acknowledgment.
- Installation and repository identity must match an active governed binding.
- The endpoint uses HMAC as its provider-authentication boundary; it does not use an employee
  session or create a parallel authorization route.
- Default reconciliation is fail-closed behind the external approval gate for GitHub App creation,
  installation, organization approval, and webhook secret configuration.
- The audit diff has source identifiers and fact kinds only; it excludes raw payloads, keys,
  tokens, and secrets.

## Commands and results

All commands used the repository-pinned pnpm 11.13.0 through Corepack. The available Node runtime
was 24.11.1 rather than the repository-pinned 24.18.0; pnpm emitted an engine warning but every
listed command exited successfully.

```text
pnpm --filter @evaluation/contracts test -- github-integration.test.ts                         PASS (102 tests)
pnpm --filter @evaluation/github-integration test -- webhook-service.test.ts reconciliation-service.integration.test.ts  PASS (6 tests)
pnpm exec vitest run --project integration apps/api/src/github-integration/github-integration.e2e.integration.test.ts    PASS (3 tests)
TEST_DATABASE_URL=… pnpm exec vitest run --project integration packages/database/src/github-integration-schema.integration.test.ts  PASS (6 tests)
pnpm --filter @evaluation/api lint && pnpm --filter @evaluation/api typecheck                  PASS
pnpm --filter @evaluation/github-integration lint && pnpm --filter @evaluation/github-integration typecheck  PASS
pnpm scan:secrets && pnpm scan:performance-inputs                                                PASS
prettier --check (affected files)                                                                PASS
```

## Remaining risk

Live GitHub App creation, installation, webhook-secret provisioning, organization approval, and
real provider rate-limit/retry behavior intentionally remain blocked at the external human gate.
Task 3 is still required to turn stored source facts into employee-confirmable evidence or
separately governed progress suggestions.

## Fix Round 1 — webhook delivery integrity

### RED / GREEN evidence

- **RED:** the production bootstrap test failed when `NestFactory.create(AppModule)` omitted
  `{ rawBody: true }`; the assertion showed the missing option. The realistic GitHub payload test
  failed with `GITHUB_WEBHOOK_PAYLOAD_INVALID` because the external envelope schemas were strict.
  The Prisma-store tests initially failed because the store was not exported and P2002 handling
  treated a generic uniqueness error as a duplicate. The reconciliation replay test observed an
  incorrect `recovered: 1` for a duplicate receipt.
- **GREEN:** `main.ts` enables Nest raw-body capture. External GitHub input schemas now tolerate
  extra provider fields while the persisted `GovernedGitHubFactsSchema` remains strict. The Prisma
  receipt writer uses a transaction for event plus audit, returns duplicate only after a confirmed
  existing `deliveryId`, and rethrows audit/unrelated uniqueness failures. Reconciliation increments
  recovered only for newly created receipts.

### Added verification

- Production-bootstrap regression test for raw-body capture.
- Realistic GitHub webhook payload test containing sender, organization, repository, installation,
  PR user/labels/head/base fields; storage remains the bounded fact only.
- Prisma unit tests for an audit P2002 and a confirmed delivery replay.
- Real PostgreSQL integration tests proving event plus audit atomicity, rollback when audit append
  fails, and idempotent replay.

### Fix Round 1 commands and results

All final commands used `/opt/homebrew/opt/node@24/bin/node` **v24.18.0** and Corepack pnpm
**11.13.0**.

```text
pnpm exec vitest run --project unit main.test.ts github-integration.module.test.ts webhook-service.test.ts  PASS (7 tests)
TEST_DATABASE_URL=… pnpm exec vitest run --project integration github HTTP/store/reconciliation/schema tests  PASS (15 tests)
pnpm --filter @evaluation/api lint && pnpm --filter @evaluation/api typecheck                    PASS
pnpm --filter @evaluation/github-integration lint && pnpm --filter @evaluation/github-integration typecheck  PASS
pnpm scan:secrets && pnpm scan:performance-inputs                                                  PASS
prettier --check (affected files)                                                                  PASS
```
