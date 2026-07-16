# T011 Sixth Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the sixth-review ranking/order and AST-provenance gaps without changing protected AI product rules or expanding T011 scope.

**Architecture:** Keep one shared output-field decision in `output-validator.ts`, replacing contextual token exceptions with an exact reviewed neutral-key set. Keep the repository boundary scanner fail-closed by deriving local-generator trust from all writes to a binding, accepting only statically transparent wrappers and recursively recognizing prohibited `generate` extraction patterns.

**Tech Stack:** TypeScript, Zod, Vitest, Babel TypeScript AST, pnpm/Turborepo.

## Global Constraints

- AI must never assign, predict, suggest, or recommend performance ratings or employee rankings.
- Schema governance and runtime validation must continue to share the same field decision.
- Neutral ranking/order exceptions are exact normalized keys only; no new people synonym list or name heuristic.
- Any opaque write invalidates local-generator provenance globally and conservatively.
- Work only in the isolated `codex/phase-0-foundation` worktree; do not push or amend.
- Add tests before implementation and capture exact RED/GREEN counts.

---

### Task 1: Exact neutral ranking and order keys

**Files:**
- Modify: `packages/ai-routing/src/router.test.ts`
- Modify: `packages/ai-routing/src/output-validator.ts`

**Interfaces:**
- Consumes: `validateAiOutputSchema(routeKey, schema)` and `validateAiOutput(routeKey, schema, output)`.
- Produces: one shared `forbiddenField` result that permits only the reviewed normalized keys and rejects every other `rank`, `ranked`, `ranking`, `leaderboard`, or `order` field on every route.

- [ ] **Step 1: Write failing schema and runtime probes**

Add parameterized assertions for `staffPriorityRank`, `employeeLeaderboardTitle`, `peopleRiskLeaderboard`, `candidateRelevanceRank`, `applicantOrder`, `directReportOrder`, and `associateOrder`, using `document.analyze` for both schema and runtime validation. Add passing schema/runtime controls for `searchRanking`, `priorityRanking`, `riskRanking`, `relevanceRanking`, `leaderboardTitle`, `leaderboardLabel`, `leaderboardDescription`, `displayOrder`, `criterionOrder`, `sortOrder`, and `resultOrder`.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @evaluation/ai-routing test`

Expected: the seven dangerous fields fail their rejection assertions because contextual token exceptions still override the ranking/order prohibition.

- [ ] **Step 3: Implement the minimal exact-key policy**

Replace neutral subject/metadata and people-subject lists with:

```ts
const EXACT_NEUTRAL_RANKING_FIELDS = new Set([
  "searchranking",
  "priorityranking",
  "riskranking",
  "relevanceranking",
  "leaderboardtitle",
  "leaderboardlabel",
  "leaderboarddescription",
  "displayorder",
  "criterionorder",
  "sortorder",
  "resultorder",
]);
```

Treat a field as prohibited when its token set contains `rank`, `ranked`, `ranking`, `leaderboard`, or `order` and its normalized name is not in that set.

- [ ] **Step 4: Verify GREEN and report checkpoint**

Run: `pnpm --filter @evaluation/ai-routing test`

Expected: all package tests pass, including both schema and runtime controls. Send exact RED/GREEN counts to the parent reviewer.

---

### Task 2: Conservatively invalidatable local-generator provenance

**Files:**
- Create: `tests/repository/fixtures/ai-provider-boundary/forbidden/reassigned-local-generate.ts.fixture`
- Create: `tests/repository/fixtures/ai-provider-boundary/forbidden/defaulted-destructured-parameter-generate.ts.fixture`
- Create: `tests/repository/fixtures/ai-provider-boundary/forbidden/nested-destructured-parameter-generate.ts.fixture`
- Create: `tests/repository/fixtures/ai-provider-boundary/forbidden/opaque-wrapped-generate.ts.fixture`
- Create: `tests/repository/fixtures/ai-provider-boundary/allowed/local-provenance-controls.ts.fixture`
- Modify: `tests/repository/ai-provider-boundaries.test.ts`
- Modify: `scripts/validate-boundaries.mjs`

**Interfaces:**
- Consumes: Babel AST nodes parsed with TypeScript and JSX plugins.
- Produces: `isLocalGeneratorExpression` that unwraps only transparent expressions and a binding-trust set computed from every declaration/assignment write; recursive `patternExtractsGenerate` for declarations, assignments, and parameters.

- [ ] **Step 1: Write failing provenance and wrapper fixtures**

Add forbidden probes for a local alias later overwritten by a provider, defaulted/nested destructured parameters, and opaque TypeScript/sequence wrappers. Add allowed controls for later assignment from a proven local generator, top-level object-rest declaration/assignment from a local generator, and parenthesized, sequence-last, `as`, type-assertion, non-null, and `satisfies` wrappers around a proven local generator.

- [ ] **Step 2: Verify RED**

Run: `pnpm exec vitest run tests/repository/ai-provider-boundaries.test.ts`

Expected: the forbidden reassignment/defaulted/nested probes are missed and the new valid local provenance controls are rejected.

- [ ] **Step 3: Implement transparent unwrapping and all-write provenance**

Add `unwrapTransparentExpression` for `ParenthesizedExpression`, sequence-last, `TSAsExpression`, `TSTypeAssertion`, `TSNonNullExpression`, `TSSatisfiesExpression`, and equivalent Babel transparent nodes. Collect identifier writes from declarations and `=` assignments plus top-level object-rest bindings; trust a binding only when every recorded write resolves to a direct local generator or another finally trusted binding. This makes one opaque write win globally.

- [ ] **Step 4: Implement recursive extraction inspection**

Make `patternExtractsGenerate` recurse through `AssignmentPattern`, nested `ObjectPattern` values, and `RestElement`. Apply it unchanged at variable declarations, assignments, and every function parameter. Preserve local destructuring exceptions only where the source is finally proven local.

- [ ] **Step 5: Verify GREEN and report checkpoint**

Run: `pnpm exec vitest run tests/repository/ai-provider-boundaries.test.ts`

Expected: both repository boundary tests pass. Send exact RED/GREEN counts to the parent reviewer.

---

### Task 3: Full verification, evidence, and clean handoff

**Files:**
- Modify only if the operational state materially changes: `project-state/PROJECT_STATE.md`

**Interfaces:**
- Consumes: the completed T011 remediation.
- Produces: verification evidence, a new non-amended local commit, clean containers/volumes, restored Homebrew PostgreSQL 16, and a clean worktree.

- [ ] **Step 1: Run focused combined verification**

Run: `pnpm --filter @evaluation/ai-routing test && pnpm exec vitest run tests/repository/ai-provider-boundaries.test.ts`

- [ ] **Step 2: Run database and full repository verification**

Run: `pnpm db:verify`, `pnpm test:integration`, and `TURBO_FORCE=true pnpm verify`.

- [ ] **Step 3: Inspect scope and protected-rule integrity**

Run diff/stat checks, search the diff for rating/ranking/productivity/readiness regressions, and confirm no approved product/rubric document was changed.

- [ ] **Step 4: Commit once without push**

Stage only bounded T011 files and create a new commit with message `fix: close ai router review gaps`.

- [ ] **Step 5: Restore the environment and prove cleanliness**

Remove task-created Docker containers and volumes, restore Homebrew PostgreSQL 16, verify it with `pg_isready`, and verify `git status --short` is empty.
