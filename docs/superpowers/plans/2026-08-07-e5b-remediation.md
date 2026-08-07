# E5B Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the confirmed P1 security, governance, privacy, history, concurrency, and integrity gaps in E5B without changing E5A.

**Architecture:** Keep the coaching-development modular monolith boundary. Strengthen its public services and PostgreSQL adapter, add explicit actor-safe projections and audit events, and enforce immutable history plus referential/current-pointer integrity in forward migration `0032_coaching_development_integrity`.

**Tech Stack:** TypeScript, NestJS, Zod, Prisma 7, PostgreSQL, Vitest.

## Global Constraints

- Do not edit migration `0031_coaching_development`; create forward migration `0032_coaching_development_integrity`.
- AI never emits or discusses ratings, ranking, scores, promotion, discipline, leave penalties, or evidence quotas.
- Private insight decisions, reasons, notes, and private action content remain employee-only.
- Use real PostgreSQL for persistence, concurrency, mutation, orphan, and protected API tests.
- Every behavior change follows RED → GREEN and lands in a small coherent commit.

---

### Task 1: Governed AI envelope and qualified facts

**Files:**

- Modify: `packages/coaching-development/src/prompts.ts`
- Modify: `packages/coaching-development/src/ai-insight-service.ts`
- Modify: `packages/coaching-development/src/insight-generator.ts`
- Modify: `apps/api/src/coaching-development/api-coaching-insight-draft.service.ts`
- Test: `packages/coaching-development/src/ai-insight-service.test.ts`
- Test: `packages/coaching-development/src/insight-generator.test.ts`

**Interfaces:**

- Consumes: exact registered `AnalysisPromptArtifact` descriptor and qualified public evaluation facts.
- Produces: prompt-aware `{ trustedInstruction, untrustedContent }` requests and semantic-safe coaching output.

- [x] Add tests proving the request contains the exact artifact descriptor, untrusted fact content, and an adapter-compatible shape; prove every prohibited semantic category is rejected.
- [x] Run focused tests and confirm failures arise from the current raw input envelope and incomplete semantic validation.
- [x] Add exact prompt/schema artifact reads, prompt-aware request construction, semantic rejection, and fact qualification that excludes volume, leave, and single-incident negative patterns.
- [x] Force one qualifying support to `REVIEW_REQUIRED`/`LIMITED` on the server even if the model claims `SUPPORTED`.
- [x] Run focused tests and commit.

### Task 2: Current authorization, projections, and audit

**Files:**

- Modify: `packages/coaching-development/src/ports.ts`
- Modify: `packages/coaching-development/src/persistence.ts`
- Modify: `packages/coaching-development/src/insight-service.ts`
- Modify: `packages/coaching-development/src/action-service.ts`
- Modify: `packages/coaching-development/src/formal-plan-service.ts`
- Modify: `packages/coaching-development/src/manager-support-service.ts`
- Modify: `apps/api/src/coaching-development/*.controller.ts`
- Modify: `apps/api/src/coaching-development/coaching-development.module.ts`
- Test: `tests/integration/coaching-development-journey.integration.test.ts`

**Interfaces:**

- Consumes: current active evaluation assignment bounded by cycle time and injected safe audit writer.
- Produces: employee insight projection, manager shared-action allowlist, participant-safe plan projection, and non-payload audit events.

- [x] Add failing PostgreSQL/API tests for expired assignment denial, projection field allowlists, private read denial, and audit metadata without private payloads.
- [x] Implement current/time-bounded relationship query, joined current revisions/sources, GET routes, and audit calls.
- [x] Run focused tests and commit.

### Task 3: Formal plan lifecycle and real idempotency

**Files:**

- Modify: `packages/contracts/src/coaching-development.ts`
- Modify: `packages/coaching-development/src/formal-plan-service.ts`
- Modify: `packages/coaching-development/src/persistence.ts`
- Modify: `apps/api/src/coaching-development/formal-plans.controller.ts`
- Test: `packages/coaching-development/src/formal-plan-service.test.ts`
- Test: `tests/integration/coaching-development-journey.integration.test.ts`

**Interfaces:**

- Produces: revise, withdraw-with-reason, close, non-empty confirmed-evidence completion, and idempotent retry semantics checked before mutable state.

- [x] Add failing tests for empty-evidence completion, approval invalidation on revise, withdraw reason, close, retry after version/state movement, and cross-employee links.
- [x] Implement minimal service and persistence behavior with ownership validation through domain records.
- [x] Run focused tests and commit.

### Task 4: Database integrity and atomic concurrency

**Files:**

- Create: `packages/database/prisma/migrations/0032_coaching_development_integrity/migration.sql`
- Modify: `packages/database/prisma/schema.prisma`
- Modify: `packages/coaching-development/src/persistence.ts`
- Test: `packages/database/src/coaching-development-integrity.integration.test.ts`
- Test: `tests/integration/coaching-development-journey.integration.test.ts`

**Interfaces:**

- Produces: immutable history triggers, current-revision ownership constraints, source/AI-run/evidence references, unique resulting versions, and atomic compare-and-swap writes.

- [x] Add failing database tests that attempt history mutation, cross-root current pointers, orphan sources/evidence/AI runs, and duplicate resulting versions; add concurrent writer tests.
- [x] Add forward migration and Prisma relations/uniqueness, then change persistence to update by `id + version + state/privacy` and serialize support inside a transaction.
- [x] Run database verification and focused integration tests, then commit.

### Task 5: Delivery evidence

**Files:**

- Modify: `.superpowers/sdd/2026-08-05-coaching-development-engine/progress.md`
- Modify: `.superpowers/sdd/2026-08-05-coaching-development-engine/bundle-report.md`
- Modify: `TASKS.md`
- Modify: `project-state/PROJECT_STATE.md`

- [x] Reconcile claims against exact passing evidence and document remaining deployment-only risks.
- [x] Run focused tests, `db:verify`, type checks, lint, and protected scans.
- [x] Confirm a clean worktree and commit documentation without pushing.
