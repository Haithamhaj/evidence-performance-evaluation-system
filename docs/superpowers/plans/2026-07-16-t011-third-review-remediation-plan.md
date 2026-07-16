# T011 Third Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the five remaining AI Router safety, governance, deadline, database-identity, and structural-boundary gaps without changing protected product rules or expanding T011.

**Architecture:** Keep the provider-neutral router and modular-monolith boundaries. Reuse one protected-field predicate at schema and runtime, keep all governance mutations behind one live-authorized API composition with the durable audit writer fixed internally, carry one abortable deadline through a bounded transaction, bind run/schema route identity with one composite foreign key, and enforce provider calls through AST data-flow checks rather than raw text.

**Tech Stack:** Node.js 24.18.0, pnpm 11.13.0, TypeScript 7.0.2, Zod 4.4.3, Prisma 7.8.0, PostgreSQL 17.10, Babel 8.0.1 AST, Vitest 4.1.10.

## Global Constraints

- AI must never assign, suggest, predict, or recommend a performance rating or employee ranking.
- Governance mutations require a live active System Administrator with `system.configure`, server-derived provenance, a reason, and an audit event in the same transaction.
- Successful feature output and its succeeded run trace remain one atomic transaction.
- Migration 0006 is not pushed; update it coherently rather than adding or editing an already-applied shared migration.
- All dependencies must be direct where used and pinned exactly; no dependency addition is expected.
- No push, protected-rule change, unrelated refactor, or project-state update unless an approved direction changes.

---

### Task 1: Protected Output Aliases

**Files:**

- Modify: `packages/ai-routing/src/router.test.ts`
- Modify: `packages/ai-routing/src/output-validator.ts`

**Interfaces:**

- Consumes: `validateAiOutputSchema(routeKey, schema)` and `validateAiOutput(routeKey, schema, output)`.
- Produces: one shared predicate rejecting performance-level suggestions and staff/contributor ranking aliases at both boundaries.

- [ ] Add schema-time and recursive-runtime cases for `suggestedPerformanceLevel`, `staffRanking`, and `contributorRank`, plus neutral `performanceLevelDescription`, `staffDirectory`, and `contributorRole` controls.
- [ ] Run the focused router tests and record the three protected aliases failing while neutral controls pass.
- [ ] Extend the token-pair predicate minimally: suggested/recommended/predicted + performance + level; staff/contributor join the existing people noun family for rank/ranking/order/leaderboard.
- [ ] Rerun the router tests and require all cases green.

### Task 2: Protected Governance Composition

**Files:**

- Modify: `tests/repository/ai-provider-boundaries.test.ts`
- Create: relative-import fixtures under `tests/repository/fixtures/ai-provider-boundary/forbidden/apps/feature/`
- Modify: `tests/integration/ai-governance.integration.test.ts`
- Modify: `tests/integration/ai-route-audit.integration.test.ts`
- Modify: `tests/integration/ai-run-trace.integration.test.ts`
- Modify: `apps/api/src/ai-routing/ai-routing.module.ts`
- Modify: `apps/api/src/ai-routing/admin-composition.ts`
- Delete: `apps/api/src/ai-routing/route-config.ts` after folding its private mutation into the protected composition.
- Modify: `scripts/validate-boundaries.mjs`

**Interfaces:**

- Consumes: authenticated principal, database client, and `databaseAuditWriter` fixed inside the API composition.
- Produces: protected API helpers with `(client, principal, input)` only; no caller-supplied audit writer or authorizer; no separately importable raw route mutation.

- [ ] Add type/runtime assertions that public helpers accept no fourth writer parameter and add forbidden fixtures importing `admin-composition` or `route-config` by relative path outside the one protected module.
- [ ] Replace injected-writer rollback cases with correlation-scoped PostgreSQL test triggers that reject the real durable `AuditEvent` insert, proving production-equivalent atomic rollback.
- [ ] Run boundary and governance/route integration tests and record failures from the current injection surface and missing relative-import rule.
- [ ] Fix the durable writer inside `createAiGovernanceComposition(client)`, remove writer parameters from helpers, fold route mutation into that composition, and allow its relative import only from `ai-routing.module.ts`.
- [ ] Rerun boundary and governance tests; require authorization, provenance, audit atomicity, and structural boundaries green.

### Task 3: Whole-Run Deadline Through Validation and Atomic Persistence

**Files:**

- Modify: `packages/ai-routing/src/router.test.ts`
- Modify: `packages/ai-routing/src/contracts.ts`
- Modify: `packages/ai-routing/src/router.ts`
- Modify: `packages/ai-routing/src/prisma-repository.ts`
- Modify: `tests/integration/ai-run-trace.integration.test.ts`

**Interfaces:**

- Consumes: `RunTraceRepository.commitSucceededRun({ output, persistValidatedOutput, buildTrace, signal, timeoutMs })`.
- Produces: remaining-time transaction timeout and abort checks before feature persistence, before trace insertion, and before commit; late settlement cannot create feature output or a succeeded trace.

- [ ] Add a unit regression whose persistence callback exceeds the whole-run deadline, then settles; assert prompt timeout return and zero eventual succeeded trace.
- [ ] Add a live-database regression that writes inside the success transaction, delays past the deadline, then resolves; assert the caller times out and, after late settlement, both the feature audit row and succeeded `AiRun` remain absent.
- [ ] Run focused unit/integration tests and record the current unbounded behavior.
- [ ] Race response validation and `commitSucceededRun` with the same monotonic deadline; pass `AbortSignal` and remaining milliseconds into the repository; configure Prisma interactive transaction timeout and assert the signal before trace creation/return so late success rolls back.
- [ ] Rerun the deadline tests and all router/run-trace tests.

### Task 4: Exact Run-to-Schema Route Identity

**Files:**

- Modify: `packages/ai-routing/src/router.test.ts`
- Modify: `tests/integration/ai-run-trace.integration.test.ts`
- Modify: `packages/ai-routing/src/contracts.ts`
- Modify: `packages/ai-routing/src/prisma-repository.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Modify: `packages/database/prisma/migrations/0006_ai_routing/migration.sql`

**Interfaces:**

- Consumes: schema artifact identity `{ id, routeKey, version, schemaHash }`.
- Produces: application equality validation and composite database relation `(outputSchemaArtifactId, routeKey, outputSchemaVersion, outputSchemaHash)`.

- [ ] Add a router case where a defective repository returns an artifact for another route and assert no provider side effect.
- [ ] Add a direct-database cross-route contradiction using an otherwise valid run and artifact identity; require rejection.
- [ ] Run focused tests and record both failures.
- [ ] Extend repository artifact identity with route key, reject mismatches, update Prisma relation/unique identity, and edit migration 0006 foreign key/index coherently.
- [ ] Run Prisma format/validate/generate, focused tests, and migration verification from empty and previous snapshots with no drift.

### Task 5: Provider-Aware AST Generation Boundary

**Files:**

- Modify: `tests/repository/ai-provider-boundaries.test.ts`
- Create: destructured-provider, neutral-generator, and comment-only fixtures.
- Modify: `scripts/validate-boundaries.mjs`

**Interfaces:**

- Consumes: Babel AST bindings and static-string evaluation.
- Produces: provider-tainted direct/member/aliased/destructured `generate` findings without blanket raw-source matching.

- [ ] Add a forbidden `const { generate } = adapter; generate(...)` fixture and allowed unrelated `report.generate()`, neutral destructuring, and comment-only fixtures.
- [ ] Run the boundary tests; record missed destructuring and false-positive allowed fixtures.
- [ ] Track provider-like bindings and destructured aliases in the AST; detect public adapter imports structurally; extend static URL construction as needed; remove blanket raw `.generate`/route scanning.
- [ ] Rerun repository boundary tests and full boundary validation.

### Task 6: Verification, Report, Cleanup, and Commit

**Files:**

- Modify: `.superpowers/sdd/task-11-report.md`

**Interfaces:**

- Produces: review-ready evidence and one new unpushed remediation commit.

- [ ] Run focused router, governance, run-trace, database, and boundary suites with exact counts.
- [ ] Run `pnpm db:verify`, `pnpm test:integration`, and `TURBO_FORCE=true pnpm verify`.
- [ ] Run `git diff --check`, update the task report with RED/GREEN evidence, and confirm dependency manifests remain direct and exactly pinned.
- [ ] Remove isolated Docker containers/network/volumes, restore Homebrew PostgreSQL 16, and verify the worktree/environment.
- [ ] Commit without amending or pushing, then report SHA, counts, remaining risks, project-state effect, and clean status.
