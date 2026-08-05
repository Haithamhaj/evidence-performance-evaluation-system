# Continuity & Offboarding Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve work continuity, fair eligibility, time-bounded acting authority, and historical attribution through leave, handover, delegation, return, deactivation, and reassignment-required workflows.

**Architecture:** Add one `@evaluation/continuity` domain package and protected API module. Continuity owns leave/handover/delegation/return/reassignment cases and orchestrates existing Projects, Auth, Eligibility, Updates, and Documents through public transactional interfaces. It is not an HR leave-balance or payroll system and cannot transfer permanent Project ownership.

**Tech Stack:** Node.js 24.18.0, pnpm 11.13.0, TypeScript 7.0.2, NestJS, Next.js, Prisma/PostgreSQL, Zod, Vitest, Playwright, permissions, audit, OIDC.

## Global Constraints

- Approved leave is excluded from required check-ins and relevant regularity analysis; leave never implies poor performance.
- Leave detail is minimized; do not store balance, entitlement, payroll, medical narrative, or formal HR approval.
- Acting-owner permissions are exact-scope and exact-time; expired authority fails closed even with stale UI/session.
- Delegation does not rewrite permanent ownership or historical responsibility.
- Normal activation requires delegate receipt/access confirmation; emergency activation requires manager reason and audit.
- Deactivation blocks authentication but preserves all historical foreign keys and records.
- System Administrator deactivates accounts but does not choose Project reassignment.
- Reassignment closes/opens responsibility windows transactionally through the Projects owner command.
- No automatic historical deletion; retention/archive remains policy-driven and auditable.

---

### Task 1: Define continuity contracts and package boundary

**Files:**

- Create: `packages/contracts/src/continuity.ts`
- Create: `packages/contracts/src/continuity.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/continuity/package.json`
- Create: `packages/continuity/tsconfig.json`
- Create: `packages/continuity/src/index.ts`
- Modify: root/API/web manifests and `pnpm-lock.yaml`

**Interfaces:**

- Consumes: UUID/UTC, Project/Workstream scope, permission/audit errors.
- Produces: leave, handover, delegation, access-gap, return, reassignment-case, and operational projection schemas.

- [ ] **Step 1: Write RED contract tests**

```ts
expect(LeaveStateSchema.parse("ACTIVE")).toBe("ACTIVE");
expect(() => LeaveRecordSchema.parse({ ...validLeave, medicalDetails: "private" })).toThrow();
expect(() =>
  DelegationScopeSchema.parse({ projectIds: [], allOrganizationProjects: true }),
).toThrow();
```

- [ ] **Step 2: Run RED**

Run `pnpm exec vitest run --root . packages/contracts/src/continuity.test.ts`.

- [ ] **Step 3: Implement exact schemas**

```ts
export const LeaveStateSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "ACTIVE",
  "RETURNED",
  "CANCELLED",
]);
export const DelegationStateSchema = z.enum([
  "DRAFT",
  "PENDING_MANAGER",
  "PENDING_DELEGATE",
  "ACTIVE",
  "EXPIRED",
  "RETURNED",
  "CANCELLED",
]);
export const ReassignmentCaseStateSchema = z.enum([
  "REASSIGNMENT_REQUIRED",
  "RESOLVED",
  "CANCELLED",
]);
```

Define strict UTC intervals, affected scopes, minimal reason category, handover revisions/items, delegate confirmation/gap, emergency activation, return choice, deactivation receipt, reassignment resolution, retention reference, and role-specific projections.

- [ ] **Step 4: Add package, verify, commit**

Run lockfile update, tests, typecheck, protected scans; commit `feat: define continuity contracts`.

---

### Task 2: Add the forward-only continuity schema

**Files:**

- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0031_continuity_offboarding/migration.sql`
- Create: `packages/database/src/continuity-schema.integration.test.ts`
- Modify: `scripts/run-integration-tests.mjs`

**Interfaces:**

- Consumes: users, Projects/Workstreams, ResponsibilityWindow, EvaluationCycle, AuditEvent.
- Produces: leave roots/decisions/transitions, handover roots/revisions/items, delegation roots/periods/scopes/confirmations/gaps, return records, reassignment cases/resolutions, retention references.

- [ ] **Step 1: Write RED migration test**

```ts
expect(tableNames).toEqual(
  expect.arrayContaining([
    "LeaveRecord",
    "LeaveDecision",
    "LeaveTransition",
    "HandoverRecord",
    "HandoverRevision",
    "HandoverItem",
    "Delegation",
    "DelegationScope",
    "DelegateConfirmation",
    "DelegationAccessGap",
    "ReturnHandover",
    "ReassignmentRequiredCase",
  ]),
);
```

- [ ] **Step 2: Run RED**

Run the new schema test; expect missing tables.

- [ ] **Step 3: Implement constraints and protected history**

Use half-open UTC intervals, prevent overlapping active delegation for the same scope/authority, require reason/audit identity for emergency activation, preserve decision/transitions append-only, and restrict deletes. Add indexes for active leave/delegation/reassignment queues.

- [ ] **Step 4: Verify and commit**

Run `pnpm db:verify` and schema test; commit `feat: add continuity offboarding schema`.

---

### Task 3: Implement leave and versioned handover

**Files:**

- Create: `packages/continuity/src/leave-service.ts`
- Create: `packages/continuity/src/leave-service.integration.test.ts`
- Create: `packages/continuity/src/handover-service.ts`
- Create: `packages/continuity/src/handover-service.integration.test.ts`
- Create: `packages/continuity/src/ports.ts`
- Modify: `packages/continuity/src/index.ts`

**Interfaces:**

- Consumes: authorized employee/manager relationship, Project scope reader, evaluation/check-in eligibility ports, audit writer.
- Produces: `LeaveService.submit/decide/activate/cancel`, `HandoverService.revise/confirm`, and leave eligibility projection.

- [ ] **Step 1: Write RED tests**

```ts
expect((await eligibility.read(employeeId, leaveThursday)).checkInRequired).toBe(false);
expect((await eligibility.read(employeeId, leaveQuarter)).negativeRegularitySignal).toBe(false);
await expect(manager.approve(otherDepartmentLeave)).rejects.toMatchObject({ code: "AUTHZ_SCOPE" });
```

- [ ] **Step 2: Run RED**

Run `pnpm --filter @evaluation/continuity test:integration`.

- [ ] **Step 3: Implement transactional leave decisions**

Validate interval/reason category/scopes, append manager decision and transition with audit, publish authorized eligibility effects, and preserve prior evaluation snapshots unless an explicit eligibility decision is recorded.

- [ ] **Step 4: Implement handover revisions**

Store Project/Workstream items, current state, next action, deadline, blocker, document/source reference, and proposed delegate. Reject secret/token fields and validate every linked scope via its owner reader.

- [ ] **Step 5: Verify and commit**

Run leave/check-in/readiness/evaluation, privacy, stale-version, and audit atomicity tests; commit `feat: add leave and handover workflows`.

---

### Task 4: Implement time-bounded delegation and acting authority

**Files:**

- Create: `packages/continuity/src/delegation-service.ts`
- Create: `packages/continuity/src/delegation-service.integration.test.ts`
- Create: `packages/continuity/src/acting-authority-reader.ts`
- Create: `packages/continuity/src/acting-authority-reader.test.ts`
- Modify: `packages/permissions/src/model.ts`
- Modify: `packages/permissions/src/decide.ts`
- Create: `tests/integration/acting-owner-authorization.integration.test.ts`

**Interfaces:**

- Consumes: exact delegation scope/period, manager approval, delegate confirmation, Projects permission context.
- Produces: `DelegationService.approve/confirm/reportGap/activate/expire` and `ActingAuthorityReader.readAt`.

- [ ] **Step 1: Write RED permission tests**

```ts
expect(decide(activeActingOwner, "project.update", projectId)).toBe("ALLOW");
expect(decide(activeActingOwner, "project.transferPermanentOwner", projectId)).toBe("DENY");
expect(decide(expiredActingOwner, "project.update", projectId)).toBe("DENY");
```

- [ ] **Step 2: Run RED**

Run permissions and acting-owner integration tests.

- [ ] **Step 3: Implement confirmation and activation transaction**

Normal activation requires manager approval plus delegate confirmation/access. Emergency path requires non-empty manager reason and audit; it still uses exact scopes and end time. Gap reports do not silently widen permissions.

- [ ] **Step 4: Implement fail-closed permission composition**

`readAt(actorId, action, resourceId, occurredAt)` returns authority only when the action/resource is listed and `startsAt <= occurredAt < endsAt`. Do not cache beyond the decision request or extend from a background job.

- [ ] **Step 5: Verify and commit**

Run boundary-time, cross-scope, stale-session, emergency, audit, and permanent-transfer denial tests; commit `feat: add time bounded acting authority`.

---

### Task 5: Implement return, deactivation, and reassignment-required workflow

**Files:**

- Create: `packages/continuity/src/return-service.ts`
- Create: `packages/continuity/src/return-service.integration.test.ts`
- Create: `packages/continuity/src/offboarding-service.ts`
- Create: `packages/continuity/src/offboarding-service.integration.test.ts`
- Modify: `packages/auth/src/user-sync.ts`
- Modify: `packages/auth/src/user-sync.test.ts`
- Modify: `packages/projects/src/responsibility-service.ts`
- Create: `tests/integration/offboarding-history.integration.test.ts`

**Interfaces:**

- Consumes: auth deactivation command, Projects owner transfer command, active delegation reader, notification intent port.
- Produces: return handover, immediate authority expiry, reassignment case, manager resolution, preserved-history receipt.

- [ ] **Step 1: Write RED tests**

```ts
expect(await auth.authenticate(deactivatedIdentity)).toMatchObject({ allowed: false });
expect(await history.read(deactivatedUserId)).toContainEqual(
  expect.objectContaining({ actorId: deactivatedUserId }),
);
expect(caseRecord.state).toBe("REASSIGNMENT_REQUIRED");
```

- [ ] **Step 2: Run RED**

Run offboarding/authorization/history integration tests.

- [ ] **Step 3: Implement return and deactivation orchestration**

Return expires delegation, records return choice, and preserves history. Deactivation disables auth immediately, creates one deduplicated case per active owned scope, and never picks a successor.

- [ ] **Step 4: Implement manager-only resolution**

Manager resolution calls the Projects transactional transfer command to close/open responsibility windows at the effective instant. System Administrator and Acting Owner cannot resolve permanent reassignment.

- [ ] **Step 5: Verify and commit**

Run auth denial, foreign-key preservation, reassignment role separation, duplicate case, ownership-window, and notification-failure tests; commit `feat: preserve continuity through offboarding`.

---

### Task 6: Expose APIs, technical journey, and E6A checkpoint

**Files:**

- Create: `apps/api/src/continuity/continuity.module.ts`
- Create: `apps/api/src/continuity/leave.controller.ts`
- Create: `apps/api/src/continuity/handover.controller.ts`
- Create: `apps/api/src/continuity/delegation.controller.ts`
- Create: `apps/api/src/continuity/reassignment.controller.ts`
- Create: `apps/api/src/continuity/continuity-policy.guard.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/web/src/platform/continuity-client.ts`
- Create: `apps/web/src/app/[locale]/continuity/page.tsx`
- Create: `tests/integration/continuity-api.integration.test.ts`
- Create: `scripts/seed-continuity-acceptance.ts`
- Create: `tests/e2e/continuity-offboarding.spec.ts`
- Create: `docs/acceptance/CONTINUITY_OFFBOARDING_ENGINE.md`

**Interfaces:**

- Consumes: Tasks 1–5 services and existing auth/localization.
- Produces: protected employee/manager/admin routes and one full leave-to-reassignment verification journey.

- [ ] **Step 1: Write RED API tests**

```ts
expect(await api.approveLeave(otherManagerToken, leaveId)).toMatchObject({ status: 403 });
expect(await api.reassignProject(systemAdminToken, caseId)).toMatchObject({ status: 403 });
expect(await api.useExpiredDelegation(delegateToken, projectId)).toMatchObject({ status: 403 });
```

- [ ] **Step 2: Run RED**

Run continuity API integration test.

- [ ] **Step 3: Implement routes and verification surface**

Demonstrate leave submission/approval, handover revision, delegate access confirmation, one missing-access report, activation, exact-expiry denial, return, deactivation, manager reassignment, and preserved historical activity. Show only minimum leave detail and correct Arabic/English RTL/LTR shell.

- [ ] **Step 4: Run acceptance and critical reviews**

Run package/API/migration/permissions/Playwright tests and full related eligibility/check-in/evaluation suites. Request one spec review and one security/integrity review; remediate confirmed P0/P1 only.

- [ ] **Step 5: Record and checkpoint**

Run lint/typecheck/protected scans/task graph, document exact results, update CAP-037–038/T064–070 and project state, commit `feat: complete continuity offboarding engine`, push, and update the PR.
