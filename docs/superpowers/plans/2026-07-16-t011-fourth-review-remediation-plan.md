# T011 Fourth Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the fourth review's remaining protected-output, governance, provider-boundary, import-normalization, and whole-run deadline gaps without changing protected product rules.

**Architecture:** Keep one protected-output invariant in `packages/ai-routing`, consumed by both schema artifact description and runtime output validation. Make the repository boundary conservative and provenance-based: only locally defined neutral generators are allowed outside AI-routing, while opaque/imported generator receivers are rejected independent of variable names. Reuse the existing monotonic deadline for every awaited trace persistence operation.

**Tech Stack:** TypeScript, Zod 4, Babel AST, Vitest, Prisma 7, PostgreSQL 16, pnpm 11.

## Global Constraints

- AI must never assign/recommend ratings or rank employees.
- Documentation Readiness must not become a performance score.
- No protected product rule, rubric, privacy mode, or approved artifact changes.
- Strict RED/GREEN TDD for every behavior change.
- Keep changes within T011; do not push.

---

### Task 1: Close the employee-ranking concept class

**Files:**
- Modify: `packages/ai-routing/src/router.test.ts`
- Modify: `packages/ai-routing/src/output-validator.ts`

**Interfaces:**
- Consumes: `validateAiOutputSchema(routeKey, schema)` and `validateAiOutput(routeKey, schema, output)`.
- Produces: one shared `forbiddenField` predicate recognizing people/workforce ranking concepts while preserving non-employee rankings.

- [ ] Add schema and recursive-output cases for `personnelRanking`, `workforceRank`, `colleagueRanking`, and additional people-class variants such as `peerLeaderboard`/`coworkerOrder`; add neutral `searchRanking`, `priorityRanking`, and `riskRanking` controls.
- [ ] Run `pnpm --filter @evaluation/ai-routing test` and record the expected protected-case failures.
- [ ] Replace the closed noun list with a named people-ranking noun class used by the shared schema/runtime predicate.
- [ ] Rerun the package tests and require all cases to pass.

### Task 2: Make protected schema validation authoritative at descriptor and governance boundaries

**Files:**
- Modify: `packages/ai-routing/src/router.test.ts`
- Modify: `packages/ai-routing/src/configuration.ts`
- Modify: `packages/ai-routing/src/router.ts`
- Modify: `tests/integration/ai-governance.integration.test.ts`

**Interfaces:**
- Consumes: `validateAiOutputSchema(routeKey, schema)`.
- Produces: `outputSchemaDescriptor(routeKey, version, schema)` that always enforces protected-output and portability invariants before hashing.

- [ ] Add a unit test proving `outputSchemaDescriptor` rejects a protected ranking schema.
- [ ] Add live governance tests registering protected schemas and asserting the transaction leaves no schema artifact or audit event.
- [ ] Run focused unit/integration tests and record failures showing descriptor/registration divergence.
- [ ] Call `validateAiOutputSchema` inside `outputSchemaDescriptor`; remove the redundant standalone router call so descriptor construction is the single schema gate.
- [ ] Rerun focused tests and require rollback, no-audit, and no-artifact assertions to pass.

### Task 3: Track generator provenance without variable-name heuristics

**Files:**
- Modify: `scripts/validate-boundaries.mjs`
- Modify: `tests/repository/ai-provider-boundaries.test.ts`
- Create: `tests/repository/fixtures/ai-provider-boundary/forbidden/apps/feature/client-generate.ts.fixture`
- Create: `tests/repository/fixtures/ai-provider-boundary/forbidden/apps/feature/gateway-destructured-generate.ts.fixture`
- Create: `tests/repository/fixtures/ai-provider-boundary/allowed/apps/feature/local-document-generator.ts.fixture`

**Interfaces:**
- Produces: AST provenance sets for locally defined neutral generator receivers/aliases; opaque receivers and aliases remain prohibited outside AI-routing.

- [ ] Add forbidden neutral-name receiver/alias/destructuring fixtures and local report/document class/object controls.
- [ ] Run the provider-boundary test and record missed provider calls.
- [ ] Remove `isProviderBinding` name-token logic. Discover local object/class generator definitions, propagate their provenance through aliases/destructuring, and reject every unproven `.generate` call.
- [ ] Rerun focused boundaries and full repository boundary validation.

### Task 4: Canonicalize protected governance imports

**Files:**
- Modify: `scripts/validate-boundaries.mjs`
- Modify: `tests/repository/ai-provider-boundaries.test.ts`
- Create normalized protected-import fixtures under the forbidden fixture tree.
- Create an exact allowed `ai-routing.module.ts` composition fixture/control.

**Interfaces:**
- Produces: canonical module-path comparison after resolving `.`/`..` and normalizing JS/TS module extensions.

- [ ] Add normalized admin-composition and route-config import variants that currently bypass the raw-specifier regex, plus the precise protected composition control.
- [ ] Run boundary tests and record failures.
- [ ] Resolve relative specifiers from the importing file, canonicalize extensions, compare to protected module stems, and allow admin composition only from the exact API module.
- [ ] Rerun boundary tests and require all normalized variants to be rejected without false positives.

### Task 5: Bound every non-success trace write by the whole-run deadline

**Files:**
- Modify: `packages/ai-routing/src/router.test.ts`
- Modify: `packages/ai-routing/src/router.ts`

**Interfaces:**
- Consumes: `WholeRunDeadline.race(start)`.
- Produces: bounded adapter-missing, fallback-policy, provider-failure, and quarantine trace writes with absorbed late settlements.

- [ ] Add never-settling trace repository tests for adapter missing, fallback policy denial, and invalid-output quarantine using a 20ms deadline and a bounded outer assertion.
- [ ] Run the focused package tests and record all hangs/time-bound failures.
- [ ] Pass the one deadline into `failRun` and wrap every awaited `appendTrace` path with `deadline.race`, preserving durable traces whenever time remains.
- [ ] Rerun the focused package tests and require timely timeout rejection with no unsafe success persistence.

### Task 6: Verify, document, commit, and restore the environment

**Files:**
- Modify: `.superpowers/sdd/task-11-report.md`

- [ ] Run focused AI-routing, governance, boundary, and integration suites.
- [ ] Run `pnpm db:verify`, `pnpm test:integration`, and `TURBO_FORCE=true pnpm verify`.
- [ ] Run `git diff --check`, update the implementer report with exact RED/GREEN evidence, and commit without amending or pushing.
- [ ] Remove isolated Docker containers/network/volumes, restart Homebrew PostgreSQL 16, and verify the worktree is clean.
