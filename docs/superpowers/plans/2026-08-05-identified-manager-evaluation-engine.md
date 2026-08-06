# Identified Manager Evaluation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the separate pilot upward manager-evaluation cycle in truthful `IDENTIFIED` mode with immutable named submissions, immediate manager visibility, leave-aware completion, and optional source-grounded summaries.

**Architecture:** Add one `@evaluation/manager-evaluation` package and protected API module. The domain owns its template/cycle snapshot, eligibility, identified responses, completion, summary revisions, and projection policies; it consumes E4 timing, continuity eligibility, identity, audit, notifications, and AI through public contracts only. Future private modes remain fail-closed policy contracts, not pilot features.

**Tech Stack:** Node.js 24.18.0, pnpm 11.13.0, TypeScript 7.0.2, NestJS 11.1.28, Next.js App Router, Prisma/PostgreSQL, Zod, Vitest, Playwright, AI Router, audit, OIDC.

## Global Constraints

- Pilot visibility is exactly `IDENTIFIED`; the interface must not promise anonymity, confidentiality, delayed publication, or manager blinding.
- The authorized manager sees submitter identity, completion, ratings, comments, and timestamps immediately after each submission.
- Employees see only their own eligibility and submission; they never see peer status/content.
- The manager cannot submit on behalf of an employee.
- Every response is immutable and follows the cycle's frozen rubric, eligibility, dates, and visibility policy.
- AI does not select/rewrite ratings or judge the manager; themes remain cited, support-bounded revisions.
- Unique or low-support content is not generalized as a theme.
- System Administrator has configuration/health authority, not response-content authority merely by role.
- Unknown, `MANAGER_BLINDED`, and `ANONYMOUS_AGGREGATED` projections fail closed in the pilot.

---

### Task 1: Define manager-evaluation contracts and package boundary

**Files:**

- Create: `packages/contracts/src/manager-evaluation.ts`
- Create: `packages/contracts/src/manager-evaluation.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/manager-evaluation/package.json`
- Create: `packages/manager-evaluation/tsconfig.json`
- Create: `packages/manager-evaluation/src/index.ts`
- Modify: root/API/web manifests and `pnpm-lock.yaml`

**Interfaces:**

- Consumes: UUID/UTC, rating 1–5, `FeedbackVisibilityMode`, `AppError`.
- Produces: strict cycle, eligibility, response, completion, identified projection, summary, and policy schemas.

- [ ] **Step 1: Write RED contract tests**

```ts
expect(ManagerEvaluationVisibilitySchema.parse("IDENTIFIED")).toBe("IDENTIFIED");
expect(() => IdentifiedManagerResponseSchema.parse({ ...valid, submitterId: undefined })).toThrow();
expect(() => ManagerThemeSchema.parse({ ...validTheme, recommendedManagerRating: 5 })).toThrow();
```

- [ ] **Step 2: Run RED**

Run `pnpm exec vitest run --root . packages/contracts/src/manager-evaluation.test.ts`.

- [ ] **Step 3: Implement exact schemas**

```ts
export const ManagerEvaluatorStateSchema = z.enum([
  "ELIGIBLE_PENDING",
  "SUBMITTED",
  "APPROVED_LEAVE",
  "POSTPONED",
  "EXCLUDED_BY_AUTHORIZED_MANAGER",
]);
export const ManagerEvaluationVisibilitySchema = z.enum([
  "IDENTIFIED",
  "MANAGER_BLINDED",
  "ANONYMOUS_AGGREGATED",
]);
export const ManagerCriterionResponseSchema = z
  .object({
    criterionId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(8000),
  })
  .strict();
```

Define cycle-open, eligibility-decision, submit, receipt, manager-completion, identified-response, theme revision, report projection, and sensitive-access hook contracts. The pilot projection factory accepts only `IDENTIFIED`.

- [ ] **Step 4: Add package, verify, commit**

Run lockfile update, contract test, package typecheck, AI/performance scans; then commit `feat: define identified manager evaluation contracts`.

---

### Task 2: Add the forward-only manager-evaluation schema

**Files:**

- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0029_manager_evaluation/migration.sql`
- Create: `packages/database/src/manager-evaluation-schema.integration.test.ts`
- Modify: `scripts/run-integration-tests.mjs`

**Interfaces:**

- Consumes: `User`, `Department`, `RubricVersion`, E4 cycle identity, `AiRun`.
- Produces: manager template/cycle snapshot, evaluator eligibility, response/criteria/comments, summary revisions/sources, policy snapshots, and transitions.

- [ ] **Step 1: Write RED schema test**

```ts
expect(tableNames).toEqual(
  expect.arrayContaining([
    "ManagerEvaluationCycle",
    "ManagerEvaluationCycleSnapshot",
    "ManagerEvaluatorEligibility",
    "ManagerEvaluationResponse",
    "ManagerCriterionResponse",
    "ManagerEvaluationSummaryRevision",
  ]),
);
```

- [ ] **Step 2: Run RED**

Run the new schema integration test; expect missing tables.

- [ ] **Step 3: Implement schema and immutability**

Enforce one response per `(cycleId, evaluatorId)`, five criterion responses per submitted response, frozen `IDENTIFIED` policy, append-only eligibility decisions/summaries, immediate readable timestamp, and update/delete denial after submission. Include isolated identity-link table contracts for disabled future modes without enabling any selector.

- [ ] **Step 4: Verify migration and commit**

Run `pnpm db:verify` and the schema test; commit `feat: add manager evaluation schema`.

---

### Task 3: Implement cycle, eligibility, immutable submission, and completion

**Files:**

- Create: `packages/manager-evaluation/src/cycle-service.ts`
- Create: `packages/manager-evaluation/src/cycle-service.integration.test.ts`
- Create: `packages/manager-evaluation/src/submission-service.ts`
- Create: `packages/manager-evaluation/src/submission-service.integration.test.ts`
- Create: `packages/manager-evaluation/src/completion-reader.ts`
- Create: `packages/manager-evaluation/src/ports.ts`
- Modify: `packages/manager-evaluation/src/index.ts`

**Interfaces:**

- Consumes: E4 cycle timing reader, continuity eligibility reader, identity relationship reader, transaction/audit ports.
- Produces: `ManagerEvaluationCycleService.open`, `recordEligibilityDecision`, `ManagerEvaluationSubmissionService.submit`, `IdentifiedCompletionReader.read`.

- [ ] **Step 1: Write RED behavior tests**

```ts
expect(opened.visibilityMode).toBe("IDENTIFIED");
await expect(
  submitter.submit({ ...input, identifiedNoticeConfirmed: false }),
).rejects.toMatchObject({
  code: "IDENTIFIED_NOTICE_REQUIRED",
});
expect((await completion.read({ cycleId, managerId })).submitted).toBe(1);
```

- [ ] **Step 2: Run RED**

Run `pnpm --filter @evaluation/manager-evaluation test:integration`.

- [ ] **Step 3: Implement transactional services**

Freeze manager/employee relationships, leave state, dates, rubric version, five criteria, and visibility. Validate all criterion responses and configured comment requirements; persist response, criterion rows, timestamp, state transition, and audit atomically. Retry returns the original receipt.

- [ ] **Step 4: Implement completion from frozen eligibility**

Return named eligible rows and their exact states to the cycle manager only. A current organization change never alters the snapshot; approved leave uses an authorized append-only decision.

- [ ] **Step 5: Verify and commit**

Run integration tests including peer isolation, other-manager denial, deactivated-history, leave completion, atomicity, and idempotency; commit `feat: submit identified manager evaluations`.

---

### Task 4: Implement identified projections and grounded optional summaries

**Files:**

- Create: `packages/manager-evaluation/src/projection-policy.ts`
- Create: `packages/manager-evaluation/src/projection-policy.test.ts`
- Create: `packages/manager-evaluation/src/summary-service.ts`
- Create: `packages/manager-evaluation/src/summary-service.test.ts`
- Create: `packages/manager-evaluation/src/prompts.ts`
- Create: `tests/ai/manager-evaluation-summary.eval.test.ts`
- Modify: `packages/manager-evaluation/src/index.ts`

**Interfaces:**

- Consumes: submitted identified responses, AI Router route `manager-evaluation.summary`, audit-before-read hook.
- Produces: `IdentifiedProjectionPolicy.readResponse`, `ManagerEvaluationSummaryService.generate`.

- [ ] **Step 1: Write RED privacy and AI tests**

```ts
expect(() => createProjectionPolicy("MANAGER_BLINDED")).toThrowError(/disabled/i);
expect(summary.themes.every((theme) => theme.sourceResponseIds.length >= 2)).toBe(true);
expect(summary).not.toHaveProperty("managerRating");
```

- [ ] **Step 2: Run RED**

Run package tests and `pnpm exec vitest run --project ai-evals tests/ai/manager-evaluation-summary.eval.test.ts`.

- [ ] **Step 3: Implement projections and AI route**

Identified projection always returns name, status, ratings, comments, and timestamp to the frozen manager. Summary prompt/schema `manager-evaluation-summary.v1` returns criterion distributions and themes with `sourceResponseIds`, support count, limits, and period. Suppress themes with fewer than two distinct supporting responses.

- [ ] **Step 4: Verify and commit**

Run privacy-mode, source-grounding, no-judgment, audit, and AI boundary tests; commit `feat: add identified manager feedback projections`.

---

### Task 5: Expose protected APIs and truthful verification UI

**Files:**

- Create: `apps/api/src/manager-evaluation/manager-evaluation.module.ts`
- Create: `apps/api/src/manager-evaluation/cycles.controller.ts`
- Create: `apps/api/src/manager-evaluation/submissions.controller.ts`
- Create: `apps/api/src/manager-evaluation/manager-view.controller.ts`
- Create: `apps/api/src/manager-evaluation/manager-evaluation-policy.guard.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/web/src/platform/manager-evaluation-client.ts`
- Create: `apps/web/src/app/[locale]/manager-feedback/[cycleId]/page.tsx`
- Create: `tests/integration/manager-evaluation-api.integration.test.ts`
- Create: `tests/e2e/identified-manager-evaluation.spec.ts`

**Interfaces:**

- Consumes: Tasks 1–4 services and current auth/localization gateway.
- Produces: protected cycle/submission/manager-view routes and bilingual Identified notice journey.

- [ ] **Step 1: Write RED API tests**

```ts
expect(await api.readPeerResponse(employeeToken, responseId)).toMatchObject({ status: 403 });
expect(await api.readManagerCycle(otherManagerToken, cycleId)).toMatchObject({ status: 403 });
expect(await api.readManagerCycle(systemAdminToken, cycleId)).toMatchObject({ status: 403 });
```

- [ ] **Step 2: Run RED**

Run the new API integration test.

- [ ] **Step 3: Implement routes and UI**

Reauthorize on every request. Employee page states plainly that name, ratings, comments, and submission time are visible to the manager. Manager page shows immediate named originals and leave-aware completion. Arabic shell translates the notice without claiming the Arabic manager rubric is released.

- [ ] **Step 4: Verify and commit**

Run API integration, English identified Playwright journey, RTL notice/focus test, API/web typecheck, and user-visible copy scan; commit `feat: expose identified manager evaluation`.

---

### Task 6: Complete deterministic acceptance and the E5A checkpoint

**Files:**

- Create: `scripts/seed-manager-evaluation-acceptance.ts`
- Create: `docs/acceptance/IDENTIFIED_MANAGER_EVALUATION_ENGINE.md`
- Modify: `TASKS.md`
- Modify: `project-state/PROJECT_STATE.md`

**Interfaces:**

- Consumes: the full E5A public surface.
- Produces: reproducible evidence for CAP-033–034 and T055–T059.

- [ ] **Step 1: Seed realistic deterministic data**

Create one manager, three eligible employees, one submitted response, one pending response, and one approved-leave row. Include no anonymity promise, ranking, readiness percentage, or AI judgment.

- [ ] **Step 2: Run the complete journey**

Run seed, API integration, package tests, AI eval, migration verification, and Playwright. Capture employee notice, manager immediate original, completion states, and optional grounded summary.

- [ ] **Step 3: Run critical reviews**

Request one specification/visibility review and one security/code-quality review. Fix only confirmed P0/P1 findings and re-run only corrected findings plus related tests.

- [ ] **Step 4: Record and checkpoint**

Run lint/typecheck, protected scans, task graph, and related suites. Record exact commands/results, update tasks/state, commit `feat: complete identified manager evaluation engine`, push, and update the phase PR.
