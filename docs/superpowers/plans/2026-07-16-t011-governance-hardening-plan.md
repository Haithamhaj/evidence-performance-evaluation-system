# T011 AI Router Governance Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the fresh T011 re-review findings while preserving the approved provider-neutral router, protected performance rules, and human approval gates.

**Architecture:** Keep runtime routing on the ordinary `@evaluation/ai-routing` surface, but move every governance mutation behind a restricted API-only composition subpath. Persist local trust and portable schema identities as immutable versions, validate invocation scope before side effects, and use one deadline object across resolution and all provider attempts.

**Tech Stack:** TypeScript 7, Zod 4, NestJS 11, Prisma/PostgreSQL, Vitest, TypeScript compiler API.

## Global Constraints

- AI never assigns or recommends performance ratings, rankings, or productivity scores.
- Raw activity quantity never becomes a performance input.
- Only an active System Administrator with `system.configure` may change AI governance configuration.
- Every governance mutation requires a trimmed reason and an atomic audit event.
- Migration `0006_ai_routing` remains coherent because it is not shared or pushed.
- Tests precede every production behavior change.

---

### Task 1: Protected output predicate

**Files:**

- Modify: `packages/ai-routing/src/output-validator.ts`
- Test: `packages/ai-routing/src/router.test.ts`

**Interfaces:**

- Consumes: output field names from static Zod JSON Schema and recursively parsed runtime values.
- Produces: one shared predicate that rejects protected token/morphology pairs without rejecting neutral operational fields.

- [ ] Add tests for `managerPerformanceScore`, `performanceGrade`, `rankedTeamMemberIds`, `workerRanking`, `commitTotal`, `numberOfCommits`, `numUpdates`, and `totalActivities`, plus neutral false-positive controls.
- [ ] Run `pnpm --filter @evaluation/ai-routing test` and record the expected policy-test failures.
- [ ] Implement token singularization and required pair matching in the existing shared predicate.
- [ ] Re-run the package suite and require all policy cases to pass.

### Task 2: Exact portable schema identity

**Files:**

- Modify: `packages/ai-routing/src/configuration.ts`
- Modify: `packages/ai-routing/src/router.ts`
- Test: `packages/ai-routing/src/router.test.ts`
- Test: `tests/integration/ai-run-trace.integration.test.ts`

**Interfaces:**

- Consumes: `z.ZodType` supplied for schema registration and execution.
- Produces: `assertPortableOutputSchema(schema)` and a canonical artifact hash whose persisted identity exactly represents allowed runtime parsing.

- [ ] Add failing tests for custom refinement, opposing refinements, transform, preprocess, coerce, default, catch, and concurrent identical registration.
- [ ] Verify the tests fail because runtime-only semantics are accepted and create races.
- [ ] Reject custom checks and unsupported wrappers before JSON Schema conversion; compute the hash only after this check.
- [ ] Recover an identical unique conflict by re-reading and comparing the immutable artifact.
- [ ] Re-run focused unit and integration tests.

### Task 3: Audited governance composition and local trust policy

**Files:**

- Create: `apps/api/src/ai-routing/admin-composition.ts`
- Move: `packages/ai-routing/src/route-config.ts` to `apps/api/src/ai-routing/route-config.ts`
- Modify: `packages/ai-routing/src/index.ts`
- Modify: `packages/ai-routing/package.json`
- Modify: `apps/api/src/ai-routing/ai-routing.module.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Modify: `packages/database/prisma/migrations/0006_ai_routing/migration.sql`
- Test: `tests/integration/ai-route-audit.integration.test.ts`
- Test: `tests/integration/ai-run-trace.integration.test.ts`

**Interfaces:**

- Consumes: authenticated server principal, untrusted mutation body, database client, and audit writer.
- Produces: restricted methods to register trust policy/provider/schema and change route, each authorizing `system.configure` and committing state plus audit atomically.

- [ ] Add failing authorization, rollback, audit-detail, trust-policy concurrency/immutability, schema-evidence, and endpoint-policy constraint tests.
- [ ] Remove governance functions from the ordinary export and add the restricted subpath.
- [ ] Add immutable `AiLocalTrustPolicy` and allowed-IP versions; bind local providers to the exact allowed row with composite foreign keys.
- [ ] Require HTTPS for non-loopback local providers and exact host/policy binding in application and database constraints.
- [ ] Record schema reason, expected behavior, evidence references, administrator, and audit snapshots.
- [ ] Re-run focused integration tests.

### Task 4: Adapter identity, scope validation, and whole-run deadline

**Files:**

- Modify: `packages/ai-routing/src/contracts.ts`
- Modify: `packages/ai-routing/src/adapters/openai-compatible.ts`
- Modify: `packages/ai-routing/src/adapters/fake.ts`
- Modify: `packages/ai-routing/src/prisma-repository.ts`
- Modify: `packages/ai-routing/src/router.ts`
- Test: `packages/ai-routing/src/adapters/openai-compatible.test.ts`
- Test: `packages/ai-routing/src/router.test.ts`
- Test: `tests/integration/ai-run-trace.integration.test.ts`

**Interfaces:**

- Consumes: one caller `timeoutMs`, authoritative scope UUIDs, and exact provider/trust configuration.
- Produces: one monotonic deadline and prevalidated scope; adapter matching includes provider, adapter, locality, endpoint, and trust-policy identity.

- [ ] Add failing tests for resolution plus fallback exceeding the total budget, late settlement, adapter-key mismatch, trust-policy mismatch, and wrong scope type before provider execution.
- [ ] Add repository scope validation and call it before route resolution.
- [ ] Replace per-hop timers with one monotonic deadline and shared signal.
- [ ] Bind adapter matching to every identity field.
- [ ] Re-run focused unit and database integration tests.

### Task 5: Structural provider boundaries

**Files:**

- Modify: `scripts/validate-boundaries.mjs`
- Modify: `tests/repository/ai-provider-boundaries.test.ts`
- Create: bypass fixtures under `tests/repository/fixtures/ai-provider-boundary/forbidden/`

**Interfaces:**

- Consumes: TypeScript/JavaScript source syntax trees.
- Produces: deterministic violations for forbidden provider imports, adapter calls, dynamic provider HTTP, and restricted governance imports outside the protected API module.

- [ ] Add fixtures for computed import/require, bracket/aliased generation, environment provider URLs, dynamic provider routes, and restricted composition imports.
- [ ] Run the repository test and verify every new fixture is missed by the current scanner.
- [ ] Parse source with the TypeScript compiler API, resolve bounded static string expressions, and inspect calls/imports structurally.
- [ ] Re-run boundary tests and repository lint.

### Task 6: Verification, report, and commit

**Files:**

- Modify: `.superpowers/sdd/task-11-report.md`

**Interfaces:**

- Consumes: executed RED/GREEN and migration evidence.
- Produces: review-ready T011 remediation commit and operational handoff.

- [ ] Run focused AI-routing, database, API, and boundary suites.
- [ ] Run full integration verification.
- [ ] Run `pnpm db:verify` from empty and previous migration states with drift/rebuild checks.
- [ ] Run `TURBO_FORCE=true pnpm verify`.
- [ ] Update the task report with exact evidence and remaining risks.
- [ ] Remove project Docker containers/volumes, restore Homebrew PostgreSQL 16, review the staged diff, and commit `fix: close ai router governance gaps` without pushing.
