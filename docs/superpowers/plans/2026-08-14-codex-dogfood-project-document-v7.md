# Codex Dogfood Project Document v7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Append a current Project Document v7 and generate a human-review-only Progress Contract draft from it through the governed AI Router.

**Architecture:** Keep Documents, Projects, and AI Router as the existing authorities. The dogfood runtime selects one bounded repository document, preserves exact current pull-request lineage, appends the source as a new immutable version, and requests a schema-validated draft without crossing the human activation gate.

**Tech Stack:** TypeScript, Vitest, PostgreSQL/Prisma, existing Documents and Projects services, existing AI Router, Next.js acceptance UI.

## Global Constraints

- Do not change protected product rules.
- Do not calculate progress from Tasks, Updates, GitHub activity, commits, files, or lines changed.
- Do not create employee performance ratings, rankings, readiness scores, or productivity scores.
- Preserve Project Document v6 and all historical rows.
- Do not save, submit, approve, or activate the generated contract without direct human approval.
- Do not expose, print, move, or commit credentials.

---

### Task 1: Bound the current dogfood source and lineage

**Files:**

- Create: `docs/product/CODEX_DOGFOOD_PROJECT_DOCUMENT_V7.md`
- Modify: `scripts/codex-dogfood-runtime.ts`
- Test: `scripts/codex-dogfood-runtime.test.ts`

**Interfaces:**

- Produces: `CODEX_DOGFOOD_SOURCE_PATHS` containing only the v7 document.
- Produces: `CODEX_DOGFOOD_PULL_REQUEST_NUMBER` equal to `30`.
- Consumes: existing `resolveCodexDogfoodPullRequestLineage()` and `runSeed()`.

- [ ] **Step 1: Write the failing source-selection test**

```ts
expect(CODEX_DOGFOOD_SOURCE_PATHS).toEqual(["docs/product/CODEX_DOGFOOD_PROJECT_DOCUMENT_V7.md"]);
expect(CODEX_DOGFOOD_PULL_REQUEST_NUMBER).toBe("30");
```

- [ ] **Step 2: Run the focused test and observe the missing exports**

Run: `pnpm exec vitest run scripts/codex-dogfood-runtime.test.ts`

Expected: FAIL because the v7 selection and current PR number are not exported.

- [ ] **Step 3: Add the bounded document and minimal runtime constants**

The document states the current verified baseline, the seven remaining stage gates, `stage_gate`
calculation, the zero-violation operational KPI, acceptable evidence, protected exclusions, prospective
effective behavior, and the direct human activation gate. `runSeed()` reads only the exported v7 path.

- [ ] **Step 4: Run the focused test and observe it pass**

Run: `pnpm exec vitest run scripts/codex-dogfood-runtime.test.ts`

Expected: PASS.

### Task 2: Verify and publish the bounded implementation

**Files:**

- Modify: `project-state/PROJECT_STATE.md`
- Create: `.superpowers/sdd/2026-08-14-codex-dogfood-v7-report.md`

**Interfaces:**

- Consumes: Task 1 constants and document.
- Produces: a durable repository checkpoint before changing local dogfood state.

- [ ] **Step 1: Run focused verification**

Run the runtime test, affected TypeScript check, affected lint/format checks, and changed-file secret
scan. Do not run the full repository suite.

- [ ] **Step 2: Record the current goal and gate**

Update Project State to say v7 is the current approved source design and contract activation remains a
Product Owner gate.

- [ ] **Step 3: Commit and push**

Commit only the bounded v7 artifacts and push `codex/ai-native-frontend-phase-1`.

### Task 3: Append v7 and prepare the real contract draft

**Files:**

- No production-code changes expected.

**Interfaces:**

- Consumes: `pnpm dogfood:seed`, `pnpm dogfood:draft-contract`.
- Produces: Project Document v7 receipt and one AI draft receipt bound to v7.

- [ ] **Step 1: Resolve exact Pull Request #30 lineage**

Read `baseRefOid`, `headRefOid`, and URL from GitHub and pass them explicitly to the local command.

- [ ] **Step 2: Append the Project Document version**

Run the seed against the local acceptance database and existing private storage. Confirm the safe
receipt identifies the Project and new source version without printing secrets.

- [ ] **Step 3: Generate the AI draft**

Run the existing draft command with the existing local OpenAI credential through the AI Router. Confirm
the receipt is tied to source document version 7 and says `human_activation_required`.

- [ ] **Step 4: Review in the authenticated product**

Reload the Progress Contract settings page, inspect all proposed components, capture the review state,
and stop without clicking save, apply, submit, approve, or activate.
