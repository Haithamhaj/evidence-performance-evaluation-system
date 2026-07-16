# T011 Fifth Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining global ranking, opaque generator-member, and exact workspace-trust gaps in T011.

**Architecture:** Keep one schema/runtime field predicate and make rank/ranking/leaderboard globally fail closed with precise neutral exceptions; treat `order` separately and only protect it for explicit people subjects. Simplify provider enforcement to reject the opaque `generate` member access itself outside the exact scan-root-relative `packages/ai-routing` workspace, with fixture roots acting as explicit virtual repository roots.

**Tech Stack:** TypeScript, Zod 4, Babel AST, Vitest, Prisma 7, PostgreSQL 16, pnpm 11.

## Global Constraints

- AI must not rank employees or recommend performance ratings.
- No protected product-rule, rubric, privacy, migration, or scope change.
- Strict RED/GREEN TDD; no amend and no push.

---

### Task 1: Global ranking fail-closed policy

**Files:**
- Modify: `packages/ai-routing/src/router.test.ts`
- Modify: `packages/ai-routing/src/output-validator.ts`

**Interfaces:** Shared `forbiddenField(routeKey, field)` remains authoritative for schema and recursive runtime validation through the registered descriptor gate.

- [ ] Add failing schema/runtime tests on `document.analyze` for talent/candidate/subordinate rank/ranking/leaderboard fields.
- [ ] Add schema/runtime controls for `displayOrder`, `criterionOrder`, `sortOrder`, `resultOrder`, and neutral search/priority/risk/relevance rankings.
- [ ] Run the AI-routing package and record RED.
- [ ] Separate global ranking terms from people-only `order`, implement the minimal predicate change, and rerun GREEN.

### Task 2: Opaque generate-member access enforcement

**Files:**
- Modify: `scripts/validate-boundaries.mjs`
- Modify: `tests/repository/ai-provider-boundaries.test.ts`
- Add exact forbidden fixtures for optional access, bind/call, Reflect access, later assignment, declaration/assignment destructuring, and destructured function parameters.
- Add local object/class member, alias, optional, bind, Reflect, assignment, and destructuring controls.

**Interfaces:** Any opaque `generate` member access/extraction outside authoritative AI-routing is a boundary violation; only locally proven generator provenance is allowed.

- [ ] Add fixtures and focused assertions, then run RED.
- [ ] Extend member-property parsing to optional members; inspect every generate member, Reflect extraction, object-pattern declaration/assignment, and destructured parameter.
- [ ] Rerun boundary GREEN and the production boundary scan.

### Task 3: Exact scan-root workspace trust

**Files:**
- Modify: `scripts/validate-boundaries.mjs`
- Modify: `tests/repository/ai-provider-boundaries.test.ts`
- Add: `tests/repository/fixtures/ai-provider-boundary/forbidden/apps/api/src/packages/ai-routing/escape.ts`
- Add authoritative `packages/ai-routing/**` allowed controls.

**Interfaces:** `isAiRoutingFile(filePath)` trusts only paths beginning `packages/ai-routing/` relative to the actual scan root; `--root` supplies the virtual fixture root.

- [ ] Add the nested escape and exact authoritative fixtures and run RED.
- [ ] Replace repository-substring trust and marker extraction with scan-root-relative logical paths.
- [ ] Rerun focused and production boundary GREEN.

### Task 4: Verify and hand off

**Files:**
- Modify: `.superpowers/sdd/task-11-report.md`

- [ ] Run focused combined tests, `pnpm db:verify`, `pnpm test:integration`, and `TURBO_FORCE=true pnpm verify`.
- [ ] Run diff checks, update the report with exact evidence, and create a new commit without pushing.
- [ ] Remove isolated Docker services/volumes, restore Homebrew PostgreSQL 16, and verify a clean preserved worktree.
