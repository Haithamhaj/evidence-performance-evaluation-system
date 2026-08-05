# Employee Evaluation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one complete, immutable English `Calibration — Non-Baseline` employee-evaluation cycle with neutral facts, independent assessments, human final judgment, acknowledgment/reservation, and safe report projections.

**Architecture:** Add one `@evaluation/employee-evaluation` domain package and one protected NestJS module. The domain owns templates, snapshots, assessments, comparison, final decisions, closure, and report projections; it consumes facts, eligibility, criteria, audit, and AI only through public interfaces. The web route is a bounded verification surface, not the final frontend.

**Tech Stack:** Node.js 24.18.0, pnpm 11.13.0, TypeScript 7.0.2, NestJS 11.1.28, Next.js App Router, Prisma 7.8.0/PostgreSQL, Zod 4.4.3, Vitest 4.1.10, Playwright 1.61.1, existing OIDC, audit, Evaluation Fact View, and AI Router.

## Global Constraints

- Preserve every protected rule in `AGENTS.md` and the exact rubric wording in `docs/EVALUATION_RUBRIC.md`.
- AI starts only after a human rating is selected and never suggests, predicts, challenges, normalizes, or changes a rating.
- Employee and manager use the same frozen criterion IDs, anchors, rating scale, and cycle period.
- The manager draft remains independent: employee ratings and comparison are inaccessible until manager submission.
- Project Contribution is one human judgment; never average Projects, Workstreams, dynamic criteria, activity, or readiness.
- Documentation Readiness values/rankings and employee rankings are absent from evaluation projections.
- Cycle 1 is `CALIBRATION_NON_BASELINE` and cannot be retroactively converted to a baseline.
- Active templates, submitted assessments, final snapshots, and closed cycles are immutable.
- Arabic evaluation content/export remains disabled until T016 approval; keep the Arabic/RTL shell testable.
- Protected mutations and audit append succeed or roll back together; retries are idempotent.
- No direct cross-domain table reads; use public readers/commands.

---

## File and ownership map

| Area         | Files                                                          | Responsibility                                         |
| ------------ | -------------------------------------------------------------- | ------------------------------------------------------ |
| Contracts    | `packages/contracts/src/employee-evaluation.ts`                | Strict versioned public schemas                        |
| Domain       | `packages/employee-evaluation/src/`                            | Template, cycle, assessment, finalization, projections |
| Persistence  | migration `0028_employee_evaluation`                           | Append-only evaluation records and constraints         |
| API          | `apps/api/src/employee-evaluation/*`                           | OIDC policy, controllers, public-owner composition     |
| Verification | `apps/web/src/platform/employee-evaluation-*`, localized route | Minimal full-cycle proof                               |
| Acceptance   | seed, integration, AI, and Playwright tests                    | Deterministic evidence and screenshots                 |

---

### Task 1: Define versioned contracts and the domain package

**Files:**

- Create: `packages/contracts/src/employee-evaluation.ts`
- Create: `packages/contracts/src/employee-evaluation.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/employee-evaluation/package.json`
- Create: `packages/employee-evaluation/tsconfig.json`
- Create: `packages/employee-evaluation/src/index.ts`
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: `EvaluationFactView`, UUID/UTC conventions, `AppError`, audit writer, and `PerformanceRatingSchema`.
- Produces: `EvaluationCycleState`, `AssessmentKind`, `AssessmentDraft`, `EvaluationComparison`, `FinalEvaluationSnapshot`, and strict command/result schemas.

- [ ] **Step 1: Write the failing contract tests**

```ts
expect(() =>
  AssessmentEntrySchema.parse({
    criterionId: crypto.randomUUID(),
    rating: 4,
    justification: "Source-grounded explanation",
    suggestedRating: 5,
    sourceReferences: [],
  }),
).toThrow();
expect(EvaluationCycleTypeSchema.parse("CALIBRATION_NON_BASELINE")).toBe(
  "CALIBRATION_NON_BASELINE",
);
```

- [ ] **Step 2: Run RED**

Run `pnpm exec vitest run --root . packages/contracts/src/employee-evaluation.test.ts`.

Expected: FAIL because the contract module does not exist.

- [ ] **Step 3: Implement strict schemas**

```ts
export const EvaluationCycleStateSchema = z.enum([
  "DRAFT",
  "OPEN_PREPARATION",
  "SELF_ASSESSMENT",
  "MANAGER_ASSESSMENT",
  "COMPARISON",
  "FINALIZATION",
  "ACKNOWLEDGMENT",
  "CLOSED",
  "CANCELLED",
]);
export const AssessmentKindSchema = z.enum(["SELF", "MANAGER_INITIAL"]);
export const AcknowledgmentKindSchema = z.enum([
  "ACKNOWLEDGED",
  "ACKNOWLEDGED_WITH_RESERVATION",
  "NO_RESPONSE",
]);
export const AssessmentEntrySchema = z
  .object({
    criterionId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    justification: z.string().trim().min(1).max(8000),
    sourceReferences: z.array(z.string().uuid()).max(100),
    directObservationBasis: z.string().trim().max(4000).nullable(),
  })
  .strict();
```

Also define strict schemas for template activation, cycle opening/transition, eligibility decision, draft save, AI wording request/output, submission, discussion entry, final decision, acknowledgment/reservation, closure, employee report projection, and department report projection. Every persisted/result root carries `schemaVersion: 1` and `version` where optimistic concurrency applies.

- [ ] **Step 4: Add the workspace package**

Use package name `@evaluation/employee-evaluation` with workspace dependencies on contracts, database, audit, ai-routing, and evaluation-preparation only. Export named domain services from `src/index.ts`; add no provider SDK.

- [ ] **Step 5: Verify GREEN and boundaries**

Run:

```bash
pnpm install --lockfile-only
pnpm exec vitest run --root . packages/contracts/src/employee-evaluation.test.ts
pnpm --filter @evaluation/employee-evaluation typecheck
pnpm scan:ai-boundary
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml apps/api/package.json apps/web/package.json packages/contracts packages/employee-evaluation
git commit -m "feat: define employee evaluation contracts"
```

---

### Task 2: Add the forward-only evaluation schema

**Files:**

- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0028_employee_evaluation/migration.sql`
- Create: `packages/database/src/employee-evaluation-schema.integration.test.ts`
- Modify: `scripts/run-integration-tests.mjs`

**Interfaces:**

- Consumes: `User`, `Department`, `RubricVersion`, `EligibilitySnapshot`, `AiRun`, and append-only audit conventions.
- Produces: Prisma models used by Tasks 3–6.

- [ ] **Step 1: Write the failing schema assertions**

```ts
expect(tableNames).toEqual(
  expect.arrayContaining([
    "EvaluationTemplate",
    "EvaluationTemplateVersion",
    "EmployeeEvaluationCycle",
    "EmployeeEvaluationCycleSnapshot",
    "EvaluationAssignment",
    "Assessment",
    "AssessmentRevision",
    "AssessmentSubmission",
    "EvaluationDiscussionEntry",
    "FinalEvaluationDecision",
    "FinalEvaluationSnapshot",
    "EvaluationAcknowledgment",
  ]),
);
expect(columnNames).not.toContain("suggestedRating");
```

- [ ] **Step 2: Run RED**

Run `pnpm exec vitest run --root . packages/database/src/employee-evaluation-schema.integration.test.ts`.

Expected: FAIL because migration `0028` is absent.

- [ ] **Step 3: Implement models and constraints**

Add immutable template versions/items/locales, cycle/snapshot/assignments, append-only assessment revisions, single submissions per kind, discussion entries, final decisions/snapshot, acknowledgment/reservation, eligibility decision events, and transition history. Enforce unique `(cycleId, employeeId)`, `(assignmentId, kind)`, stable criterion IDs, optimistic version checks, and `ON DELETE RESTRICT` for historical references. Add database triggers rejecting updates/deletes to active template versions, submissions, final snapshots, and acknowledgments.

- [ ] **Step 4: Verify empty and upgrade migration**

Run:

```bash
pnpm db:verify
pnpm exec vitest run --root . packages/database/src/employee-evaluation-schema.integration.test.ts
```

Expected: empty-database and previous-snapshot upgrade pass.

- [ ] **Step 5: Commit**

```bash
git add packages/database scripts/run-integration-tests.mjs
git commit -m "feat: add employee evaluation schema"
```

---

### Task 3: Implement templates, cycle snapshots, and eligibility

**Files:**

- Create: `packages/employee-evaluation/src/template-service.ts`
- Create: `packages/employee-evaluation/src/template-service.integration.test.ts`
- Create: `packages/employee-evaluation/src/cycle-service.ts`
- Create: `packages/employee-evaluation/src/cycle-service.integration.test.ts`
- Create: `packages/employee-evaluation/src/ports.ts`
- Modify: `packages/employee-evaluation/src/index.ts`
- Modify: `packages/database/src/seed-pilot.ts`

**Interfaces:**

- Consumes: `EligibilitySnapshotReader.readCycleEligibility`, rubric/template readers, `AuditWriter.write`, and a Prisma transaction client.
- Produces: `EvaluationTemplateService.activateVersion`, `EmployeeEvaluationCycleService.openCycle`, `transitionCycle`, and `recordEligibilityDecision`.

- [ ] **Step 1: Write template and snapshot RED tests**

```ts
await expect(
  service.activateVersion({ versionId, actorId, expectedVersion: 1 }),
).rejects.toMatchObject({
  code: "EVALUATION_TEMPLATE_WEIGHT_INVALID",
});
expect(opened.snapshot.cycleType).toBe("CALIBRATION_NON_BASELINE");
await expect(service.openCycle(sameInput)).resolves.toEqual(opened);
```

- [ ] **Step 2: Run RED**

Run `pnpm --filter @evaluation/employee-evaluation test:integration`.

Expected: FAIL because the services are missing.

- [ ] **Step 3: Implement template activation**

Validate organization/department inheritance, exact protected criterion IDs, section and fixed-criterion weights of 100%, rating scale 1–5, English locale availability, and allowed ranges. Seed Version 1 from the existing rubric seed reader; never duplicate rubric wording in the service.

- [ ] **Step 4: Implement transactional cycle opening**

```ts
return this.db.$transaction(async (tx) => {
  const eligibility = await this.eligibilityReader.readCycleEligibility(input, tx);
  const snapshot = await this.repository.freezeSnapshot(tx, input, eligibility);
  await this.audit.write(tx, "evaluation.cycle.opened", input.actorId, snapshot.id);
  return snapshot;
});
```

Reject non-quarterly Cycle 1 type changes, mutable active template access, visibility changes, and silent current-membership resnapshotting. Record approved-leave changes as append-only decisions.

- [ ] **Step 5: Verify GREEN**

Run `pnpm --filter @evaluation/employee-evaluation test:integration`.

Expected: weight, immutability, snapshot, leave, audit atomicity, idempotency, and stale-version tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/employee-evaluation packages/database/src/seed-pilot.ts
git commit -m "feat: govern evaluation templates and cycles"
```

---

### Task 4: Implement independent assessments and post-rating AI wording

**Files:**

- Create: `packages/employee-evaluation/src/assessment-service.ts`
- Create: `packages/employee-evaluation/src/assessment-service.integration.test.ts`
- Create: `packages/employee-evaluation/src/ai-wording-service.ts`
- Create: `packages/employee-evaluation/src/ai-wording-service.test.ts`
- Create: `packages/employee-evaluation/src/prompts.ts`
- Create: `tests/ai/evaluation-justification.eval.test.ts`
- Modify: `packages/employee-evaluation/src/index.ts`

**Interfaces:**

- Consumes: frozen assignment/template, authorized Fact View, AI Router route `evaluation.justification`, and audit writer.
- Produces: `AssessmentService.saveDraft`, `submit`, and `EvaluationWordingService.draftJustification`.

- [ ] **Step 1: Write independence and no-rating RED tests**

```ts
await expect(managerReader.readSelfAssessment({ assignmentId, managerId })).rejects.toMatchObject({
  code: "EVALUATION_INDEPENDENCE_GATE",
});
await expect(
  wording.draftJustification({ selectedRating: null, sourceIds: [] }),
).rejects.toMatchObject({
  code: "RATING_REQUIRED_BEFORE_AI",
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm --filter @evaluation/employee-evaluation test:integration
pnpm exec vitest run --project ai-evals tests/ai/evaluation-justification.eval.test.ts
```

Expected: missing-service failures.

- [ ] **Step 3: Implement draft/save/submit**

Autosave append-only revisions under optimistic version, validate all 12 fixed criteria plus one Project Contribution judgment, pin selected Fact View source IDs, and freeze submissions transactionally. Duplicate submission returns the original receipt; stale draft returns current version without overwrite.

- [ ] **Step 4: Implement AI route and evaluations**

Use prompt `evaluation-justification.v1` and schema `evaluation-justification.v1`. Input includes only the human-selected rating/anchor, chosen authorized facts, locale, and user draft. Output contains `draft`, `sourceReferences`, and `limitations`; its strict schema excludes every rating/rank/recommendation field.

- [ ] **Step 5: Verify GREEN**

Run both commands from Step 2 plus `pnpm scan:performance-inputs` and `pnpm scan:ai-boundary`.

Expected: all pass, including proof that the manager cannot access self content before manager submission.

- [ ] **Step 6: Commit**

```bash
git add packages/employee-evaluation tests/ai
git commit -m "feat: add independent evaluation assessments"
```

---

### Task 5: Implement comparison, finalization, acknowledgment, and projections

**Files:**

- Create: `packages/employee-evaluation/src/comparison-service.ts`
- Create: `packages/employee-evaluation/src/comparison-service.test.ts`
- Create: `packages/employee-evaluation/src/finalization-service.ts`
- Create: `packages/employee-evaluation/src/finalization-service.integration.test.ts`
- Create: `packages/employee-evaluation/src/report-reader.ts`
- Create: `packages/employee-evaluation/src/report-reader.integration.test.ts`
- Modify: `packages/employee-evaluation/src/index.ts`

**Interfaces:**

- Consumes: two immutable submissions, authorized discussion entries, pinned facts, transaction/audit ports.
- Produces: `ComparisonService.read`, `FinalizationService.finalize`, `acknowledge`, `close`, and audience-specific report readers.

- [ ] **Step 1: Write RED tests**

```ts
expect(comparison.entries[0]).toMatchObject({
  criterionId,
  selfRating: 4,
  managerRating: 3,
  gap: 1,
});
expect(comparison).not.toHaveProperty("recommendedRating");
await expect(finalizer.finalize(inputTwice)).resolves.toEqual(firstReceipt);
await expect(repository.updateClosedSnapshot(snapshotId)).rejects.toThrow();
```

- [ ] **Step 2: Run RED**

Run `pnpm --filter @evaluation/employee-evaluation test:integration`.

- [ ] **Step 3: Implement explainable comparison only**

Return rating gaps, high-weight gaps, cited-source differences, missing rationale, responsibility-duration interpretation, and disputed attribution. Do not calculate midpoint, compromise, automatic average, or recommendation.

- [ ] **Step 4: Implement transactional finalization and closure**

Persist per-criterion and Project Contribution final decisions, reason for manager-initial change, selected source references, immutable snapshot, and audit in one transaction. Preserve reservation without changing the final result or blocking authorized closure.

- [ ] **Step 5: Implement safe report readers**

Employee projection exposes own cycle. Department projection exposes permitted distributions/trends only; strip readiness, rankings, peer narratives, private upward content, and identifiers not required by policy.

- [ ] **Step 6: Verify GREEN and commit**

Run:

```bash
pnpm --filter @evaluation/employee-evaluation test:integration
pnpm exec vitest run --root . tests/ai/evaluation-fact-view-neutrality.eval.test.ts
pnpm scan:performance-inputs
```

Then commit with `git commit -m "feat: finalize immutable employee evaluations"`.

---

### Task 6: Expose protected APIs and the full technical journey

**Files:**

- Create: `apps/api/src/employee-evaluation/employee-evaluation.module.ts`
- Create: `apps/api/src/employee-evaluation/templates.controller.ts`
- Create: `apps/api/src/employee-evaluation/cycles.controller.ts`
- Create: `apps/api/src/employee-evaluation/assessments.controller.ts`
- Create: `apps/api/src/employee-evaluation/finalization.controller.ts`
- Create: `apps/api/src/employee-evaluation/employee-evaluation-policy.guard.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/web/src/platform/employee-evaluation-client.ts`
- Create: `apps/web/src/app/[locale]/evaluations/[cycleId]/page.tsx`
- Create: `tests/integration/employee-evaluation-api.integration.test.ts`
- Create: `scripts/seed-employee-evaluation-acceptance.ts`
- Create: `tests/e2e/employee-evaluation-cycle.spec.ts`
- Create: `docs/acceptance/EMPLOYEE_EVALUATION_ENGINE.md`

**Interfaces:**

- Consumes: Tasks 1–5 public services, existing auth/session gateway, Fact View endpoint, localization shell.
- Produces: `/api/v1/employee-evaluation/*` protected routes and one runnable cycle-verification route.

- [ ] **Step 1: Write API authorization RED tests**

```ts
expect(await api.getAssignment(otherEmployeeToken, assignmentId)).toMatchObject({ status: 403 });
expect(await api.getManagerDraft(employeeToken, assignmentId)).toMatchObject({ status: 403 });
expect(await api.finalize(systemAdminOnlyToken, assignmentId)).toMatchObject({ status: 403 });
```

- [ ] **Step 2: Run RED**

Run `pnpm exec vitest run --root . tests/integration/employee-evaluation-api.integration.test.ts`.

- [ ] **Step 3: Implement controllers and server-side policies**

Validate UUIDs and strict bodies, resolve frozen assignment scope server-side, reauthorize every read/write, require expected versions/idempotency keys, and map domain errors without internal IDs or private content.

- [ ] **Step 4: Build the minimal bilingual verification surface**

Show Fact View before narrative, self assessment, a separately authenticated manager draft, comparison, discussion, final human decision, acknowledgment/reservation, and closed snapshot. Arabic route verifies shell/RTL only and states that rubric content is unavailable pending approval.

- [ ] **Step 5: Seed and run the complete journey**

Run:

```bash
pnpm exec tsx scripts/seed-employee-evaluation-acceptance.ts
pnpm exec vitest run --root . tests/integration/employee-evaluation-api.integration.test.ts
pnpm exec playwright test tests/e2e/employee-evaluation-cycle.spec.ts
pnpm --filter @evaluation/api typecheck
pnpm --filter @evaluation/web typecheck
```

Expected: one real employee/manager cycle closes without direct DB edits; negative roles fail; screenshots and acceptance evidence are produced.

- [ ] **Step 6: Run the E4 checkpoint and commit**

Run related unit/integration/AI/migration tests, `pnpm lint`, `pnpm typecheck`, both protected scans, and `pnpm validate:task-graph`. Record exact results, complete T045–T054/CAP-028–032 evidence, commit `feat: complete employee evaluation engine`, push, and update the phase PR.
