# Coaching & Development Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver transparent, source-grounded, non-scoring coaching insights and employee-controlled development actions, including optional manager support and mutually agreed formal plans.

**Architecture:** Add one `@evaluation/coaching-development` domain package and protected API module. The domain owns insight revisions, employee decisions, development actions, manager support, and formal plans; all facts arrive through authorized public readers. AI drafts cited wording only, while employee acceptance/privacy and employee-manager formal agreement remain explicit human gates.

**Tech Stack:** Node.js 24.18.0, pnpm 11.13.0, TypeScript 7.0.2, NestJS, Next.js, Prisma/PostgreSQL, Zod, Vitest, Playwright, OIDC, audit, AI Router.

## Global Constraints

- Coaching is not continuous performance scoring and cannot change a closed evaluation.
- AI outputs exclude ratings, ranks, productivity scores, predicted evaluations, promotion/discipline recommendations, leave penalties, evidence quotas, and unsupported causal claims.
- Volume, leave, one incident, Project prestige, or visibility cannot create a negative insight.
- Employee insight drafts and private actions remain employee-only.
- The employee may accept, edit, defer, reject, or supersede; AI/manager cannot accept on the employee's behalf.
- A manager sees only separately authorized sources and employee-approved shared action fields.
- Identified upward feedback is not automatically converted into employee coaching.
- Formal plans require employee approval and manager agreement and preserve all revisions/history.

---

### Task 1: Define coaching contracts and package boundary

**Files:**

- Create: `packages/contracts/src/coaching-development.ts`
- Create: `packages/contracts/src/coaching-development.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/coaching-development/package.json`
- Create: `packages/coaching-development/tsconfig.json`
- Create: `packages/coaching-development/src/index.ts`
- Modify: root/API/web manifests and `pnpm-lock.yaml`

**Interfaces:**

- Consumes: UUID/UTC, evaluation fact/source references, Work Item/Evidence identities, `AppError`.
- Produces: insight, action, support, formal-plan, privacy, state, and command schemas.

- [ ] **Step 1: Write RED schema tests**

```ts
expect(CoachingInsightDecisionSchema.parse("EDIT_AND_ACCEPT")).toBe("EDIT_AND_ACCEPT");
expect(() => CoachingInsightSchema.parse({ ...validInsight, predictedRating: 4 })).toThrow();
expect(() =>
  DevelopmentActionSchema.parse({ ...validAction, privacy: "PRIVATE", managerNotes: "x" }),
).toThrow();
```

- [ ] **Step 2: Run RED**

Run `pnpm exec vitest run --root . packages/contracts/src/coaching-development.test.ts`.

- [ ] **Step 3: Implement strict contracts**

```ts
export const CoachingInsightDecisionSchema = z.enum([
  "ACCEPT",
  "EDIT_AND_ACCEPT",
  "DEFER",
  "REJECT",
  "SUPERSEDE",
]);
export const DevelopmentActionStateSchema = z.enum([
  "DRAFT",
  "ACCEPTED",
  "ACTIVE",
  "COMPLETED",
  "DEFERRED",
  "CANCELLED",
  "SUPERSEDED",
]);
export const DevelopmentActionPrivacySchema = z.enum(["PRIVATE", "SHARED"]);
export const FormalPlanStateSchema = z.enum([
  "DRAFT",
  "EMPLOYEE_APPROVED",
  "MANAGER_AGREED",
  "ACTIVE",
  "COMPLETED",
  "CLOSED",
  "WITHDRAWN",
]);
```

Add strict source-cited insight, decision, action revision, manager-support, formal-plan/agreement, evidence-link, and audience projection schemas. Persisted roots use `schemaVersion: 1` and optimistic `version`.

- [ ] **Step 4: Add package, verify, commit**

Run lockfile update, contract/package tests, typecheck, AI/performance scans; commit `feat: define coaching development contracts`.

---

### Task 2: Add the forward-only coaching schema

**Files:**

- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0030_coaching_development/migration.sql`
- Create: `packages/database/src/coaching-development-schema.integration.test.ts`
- Modify: `scripts/run-integration-tests.mjs`

**Interfaces:**

- Consumes: users, Projects/Research/Work Items, Evidence, completed E4 decisions, `AiRun`.
- Produces: coaching insight/revision/source/decision, development action/revision/transition, support entry/resource, formal plan/revision/agreement/transition/evidence link.

- [ ] **Step 1: Write RED migration test**

```ts
expect(tableNames).toEqual(
  expect.arrayContaining([
    "CoachingInsight",
    "CoachingInsightRevision",
    "CoachingInsightSource",
    "CoachingInsightDecision",
    "DevelopmentAction",
    "DevelopmentActionRevision",
    "ManagerSupportEntry",
    "FormalDevelopmentPlan",
    "FormalDevelopmentPlanRevision",
  ]),
);
```

- [ ] **Step 2: Run RED**

Run the schema integration test; expect missing tables.

- [ ] **Step 3: Implement models/constraints**

Use append-only revisions/transitions/decisions/support, private-note separation, explicit sharing state, nullable Project/Research/Work Item references validated later through public readers, and restricted historical deletes. Enforce one active revision pointer per root and transaction-safe expected version.

- [ ] **Step 4: Verify and commit**

Run `pnpm db:verify` plus schema test; commit `feat: add coaching development schema`.

---

### Task 3: Implement source-grounded insight drafting and employee decisions

**Files:**

- Create: `packages/coaching-development/src/insight-service.ts`
- Create: `packages/coaching-development/src/insight-service.integration.test.ts`
- Create: `packages/coaching-development/src/insight-generator.ts`
- Create: `packages/coaching-development/src/insight-generator.test.ts`
- Create: `packages/coaching-development/src/ports.ts`
- Create: `packages/coaching-development/src/prompts.ts`
- Create: `tests/ai/coaching-insight.eval.test.ts`
- Modify: `packages/coaching-development/src/index.ts`

**Interfaces:**

- Consumes: authorized fact bundles, AI route `coaching.insight`, audit writer.
- Produces: `CoachingInsightGenerator.generate`, `CoachingInsightService.review`, and employee projection reader.

- [ ] **Step 1: Write RED tests**

```ts
expect(generated.sources.length).toBeGreaterThan(0);
expect(generated.limitations).toContain("Cannot infer performance rating");
await expect(service.read({ insightId, actorId: managerId })).rejects.toMatchObject({
  code: "AUTHZ_SCOPE",
});
```

- [ ] **Step 2: Run RED**

Run package integration and AI eval tests.

- [ ] **Step 3: Implement bounded fact composition**

Read only employee-authorized facts from Daily Work, E3, Fact View, completed E4 decisions, and policy-permitted themes. Reject pure volume, leave-only, single-event, or unsupported causal candidates before AI. Conflicting/low-support sources produce `REVIEW_REQUIRED` with explicit limits.

- [ ] **Step 4: Implement AI route and decision transaction**

Prompt/schema `coaching-insight.v1` returns neutral pattern, period, source IDs, confidence category/basis, conflicts, limits, cannot-conclude text, and optional editable action draft. Employee decisions append a decision/revision/audit atomically; rejection reason stays private.

- [ ] **Step 5: Verify and commit**

Run no-rating/no-leave-penalty/source-grounding/privacy/idempotency tests and protected scans; commit `feat: add employee-controlled coaching insights`.

---

### Task 4: Implement development actions and manager support

**Files:**

- Create: `packages/coaching-development/src/action-service.ts`
- Create: `packages/coaching-development/src/action-service.integration.test.ts`
- Create: `packages/coaching-development/src/manager-support-service.ts`
- Create: `packages/coaching-development/src/manager-support-service.integration.test.ts`
- Create: `packages/coaching-development/src/today-reader.ts`
- Modify: `packages/coaching-development/src/index.ts`
- Modify: `apps/api/src/daily-work/daily-work-query.service.ts`

**Interfaces:**

- Consumes: confirmed employee decision, authorized Projects/Research/Work Item references, Daily Composition port.
- Produces: `DevelopmentActionService.create/revise/transition/share`, `ManagerSupportService.append`, and safe Today projection.

- [ ] **Step 1: Write RED state/privacy tests**

```ts
await expect(manager.readAction(privateActionId)).rejects.toMatchObject({ code: "AUTHZ_SCOPE" });
await expect(manager.changeActionStatus(sharedActionId, "COMPLETED")).rejects.toMatchObject({
  code: "AUTHZ_ACTION",
});
expect(today.items[0].kind).toBe("DEVELOPMENT_ACTION");
```

- [ ] **Step 2: Run RED**

Run package integration tests.

- [ ] **Step 3: Implement action lifecycle**

Validate objective, benefit, activity, target date, completion-evidence definition, optional related identities, privacy, and expected version. Only employee transitions/private→shared changes; every revision and transition is append-only and audited.

- [ ] **Step 4: Implement manager support and composition**

Manager may append supportive comment/resource/application opportunity to shared action only. Expose only approved title/state/target date/context to the manager and Today composition; exclude rejection reason/private notes and all scoring fields.

- [ ] **Step 5: Verify and commit**

Run privacy, role, transition, stale-version, notification-failure, and Today non-scoring tests; commit `feat: add development actions and support`.

---

### Task 5: Implement mutually agreed formal development plans

**Files:**

- Create: `packages/coaching-development/src/formal-plan-service.ts`
- Create: `packages/coaching-development/src/formal-plan-service.integration.test.ts`
- Create: `packages/coaching-development/src/report-reader.ts`
- Create: `packages/coaching-development/src/report-reader.integration.test.ts`
- Modify: `packages/coaching-development/src/index.ts`

**Interfaces:**

- Consumes: completed E4 discussion/decision reference, employee/manager relationship, confirmed Evidence reader.
- Produces: formal plan proposal/revision/approval/agreement/activation/completion/closure and report projection.

- [ ] **Step 1: Write RED agreement/history tests**

```ts
await expect(service.activate({ planId, actorId: managerId })).rejects.toMatchObject({
  code: "EMPLOYEE_APPROVAL_REQUIRED",
});
expect(completedPlan.evidenceLinks.every((link) => link.confirmed)).toBe(true);
expect(closedEvaluation.updatedAt).toEqual(originalClosedEvaluation.updatedAt);
```

- [ ] **Step 2: Run RED**

Run package integration tests.

- [ ] **Step 3: Implement plan state machine**

Employee approval and manager agreement are distinct append-only events. Revision after either approval creates a new revision and invalidates prior pending agreement prospectively. Completion links only confirmed Evidence and never writes evaluation/progress/performance state.

- [ ] **Step 4: Implement safe report reader, verify, commit**

Expose approved plan fields to employee/manager and an immutable E6B projection; exclude private insight notes/rejection reasons. Run state/concurrency/evidence/audit tests; commit `feat: add formal development plans`.

---

### Task 6: Expose APIs, verification journey, and E5B checkpoint

**Files:**

- Create: `apps/api/src/coaching-development/coaching-development.module.ts`
- Create: `apps/api/src/coaching-development/insights.controller.ts`
- Create: `apps/api/src/coaching-development/actions.controller.ts`
- Create: `apps/api/src/coaching-development/formal-plans.controller.ts`
- Create: `apps/api/src/coaching-development/coaching-policy.guard.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/web/src/platform/coaching-development-client.ts`
- Create: `apps/web/src/app/[locale]/development/page.tsx`
- Create: `tests/integration/coaching-development-api.integration.test.ts`
- Create: `scripts/seed-coaching-development-acceptance.ts`
- Create: `tests/e2e/coaching-development.spec.ts`
- Create: `docs/acceptance/COACHING_DEVELOPMENT_ENGINE.md`

**Interfaces:**

- Consumes: Tasks 1–5 public services and existing auth/localization.
- Produces: protected coaching APIs and one employee/manager technical journey.

- [ ] **Step 1: Write RED API privacy tests**

```ts
expect(await api.getPrivateAction(managerToken, actionId)).toMatchObject({ status: 403 });
expect(await api.getInsight(otherEmployeeToken, insightId)).toMatchObject({ status: 403 });
expect(await api.forceAccept(managerToken, insightId)).toMatchObject({ status: 403 });
```

- [ ] **Step 2: Run RED**

Run the API integration test.

- [ ] **Step 3: Implement protected routes and compact verification UI**

Employee reviews cited insight, edits/accepts or rejects, keeps an action private then shares a bounded projection. Manager adds support without editing it. Both agree a formal plan and link confirmed evidence. Show manual recovery when AI is unavailable and Arabic RTL shell without evaluation-rubric activation.

- [ ] **Step 4: Run acceptance and critical reviews**

Run package/API/AI/migration/Playwright tests, lint/typecheck/protected scans. Request one spec review and one security/privacy review; remediate confirmed P0/P1 only.

- [ ] **Step 5: Record and checkpoint**

Document exact results, update CAP-035–036/T060–063 and project state, commit `feat: complete coaching development engine`, push, and update the PR.
