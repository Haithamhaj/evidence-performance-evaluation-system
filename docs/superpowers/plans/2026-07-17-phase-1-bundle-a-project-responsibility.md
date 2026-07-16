# Phase 1 Bundle A — Project Responsibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement T018–T020 so authorized department managers can create and govern projects and workstreams with historical membership, atomic owner transfer, and exact responsibility-period queries.

**Architecture:** Add one `@evaluation/projects` domain package that owns project/workstream/responsibility rules and persistence ports. PostgreSQL enforces owner and interval invariants; the API composes authentication, scoped policy checks, the Prisma-backed service, and the existing same-transaction audit writer. No document, criteria, activity, evaluation, or T016 behavior enters this bundle.

**Tech Stack:** TypeScript 7, Zod 4, NestJS 11, Prisma 7/PostgreSQL 17, Vitest 4, existing `@evaluation/contracts`, `@evaluation/database`, `@evaluation/audit`, and `@evaluation/permissions` packages.

## Global Constraints

- Every active project has exactly one Primary Project Owner; every active workstream has exactly one Primary Workstream Owner.
- Owner roles are coordination roles and grant no supervisory, rating, evaluation, or department-management authority.
- System Administrator cannot decide project or workstream reassignment.
- Owner transfer and responsibility-window creation are one transaction.
- Historical project, membership, ownership, transfer, and responsibility rows are never deleted or overwritten.
- Responsibility intervals are half-open UTC ranges `[startsAt, endsAt)`; render later in `Asia/Riyadh`.
- Contributor windows may overlap; active primary-owner windows for the same resource may not overlap.
- Acting ownership requires a finite end, an active-window authorization check, and a prospective return window for the prior owner.
- Membership and contributor periods can end independently; role records never authorize access without an active membership/responsibility window.
- Project completion/archive is rejected until every child workstream is completed or archived.
- List/detail reads are filtered in persistence to department-managed or actively assigned scopes.
- Project/workstream creation and member/contributor addition reject a `startsAt` later than the service clock; only the explicit owner-transfer contract may schedule a future responsibility change.
- All protected API actions require server-side RBAC and resource-scope enforcement.
- Audit events contain safe identifiers and reasons, not secrets or user content.
- English-only pilot use is permitted; no T016 artifact may be imported or activated.
- Use TDD for every behavior, run migration verification for schema changes, and commit each independently testable task.

---

### Task 1: Add shared project contracts and scoped authorization decisions

**Files:**
- Create: `packages/contracts/src/projects.ts`
- Create: `packages/contracts/src/projects.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/permissions/src/model.ts`
- Modify: `packages/permissions/src/decide.ts`
- Modify: `packages/permissions/src/decide.test.ts`

**Interfaces:**
- Produces: `ProjectStatusSchema`, `WorkstreamStatusSchema`, `ResponsibilityTypeSchema`, `CreateProjectSchema`, `CreateWorkstreamSchema`, `AddMemberSchema`, `EndMembershipSchema`, `UpdateStatusSchema`, discriminated `TransferOwnershipSchema`, `ResponsibilityAtSchema`, stable project/workstream/responsibility response schemas, and inferred types.
- Produces policy actions: `project.create`, `project.manage`, `workstream.create`, `workstream.manage`, `responsibility.transfer`, and `resource.read`.
- Extends project/workstream policy resources with `departmentId` so manager scope is checked server-side.

- [ ] **Step 1: Write failing contract tests**

```ts
import { describe, expect, it } from "vitest";
import {
  CreateProjectSchema,
  CreateWorkstreamSchema,
  EndMembershipSchema,
  ResponsibilityAtSchema,
  TransferOwnershipSchema,
  UpdateStatusSchema,
} from "./projects.js";

const ownerId = "00000000-0000-4000-8000-000000000001";
const departmentId = "00000000-0000-4000-8000-000000000002";

describe("project contracts", () => {
  it("accepts an offset-aware project creation request", () => {
    expect(
      CreateProjectSchema.parse({
        departmentId,
        name: "Evaluation Platform",
        description: "Pilot implementation",
        primaryOwnerId: ownerId,
        startsAt: "2026-07-17T09:00:00+03:00",
        reason: "Approved department project",
      }),
    ).toMatchObject({ departmentId, primaryOwnerId: ownerId });
  });

  it.each([
    { startsAt: "2026-07-17", reason: "valid" },
    { startsAt: "2026-07-17T06:00:00Z", reason: "" },
  ])("rejects invalid project input %#", (input) => {
    expect(() =>
      CreateProjectSchema.parse({
        departmentId,
        name: "Project",
        description: "",
        primaryOwnerId: ownerId,
        ...input,
      }),
    ).toThrow();
  });

  it("keeps transfer and point-in-time queries explicit", () => {
    expect(
      TransferOwnershipSchema.parse({
        transferKind: "permanent",
        toUserId: ownerId,
        effectiveAt: "2026-08-01T00:00:00Z",
        reason: "Manager-approved transfer",
        expectedVersion: 3,
      }),
    ).toMatchObject({ expectedVersion: 3 });
    expect(() =>
      TransferOwnershipSchema.parse({
        transferKind: "acting",
        toUserId: ownerId,
        effectiveAt: "2026-08-01T00:00:00Z",
        endsAt: "2026-08-01T00:00:00Z",
        delegationType: "approved_leave",
        reason: "Temporary coverage",
        expectedVersion: 3,
      }),
    ).toThrow();
    expect(ResponsibilityAtSchema.parse({ at: "2026-08-01T00:00:00Z" })).toBeDefined();
    expect(
      EndMembershipSchema.parse({
        endsAt: "2026-08-01T00:00:00Z",
        reason: "Assignment ended",
        expectedVersion: 3,
      }),
    ).toMatchObject({ expectedVersion: 3 });
    expect(
      UpdateStatusSchema.parse({
        status: "paused",
        reason: "Awaiting dependency",
        expectedVersion: 3,
      }),
    ).toMatchObject({ status: "paused" });
  });
});
```

- [ ] **Step 2: Run the focused tests and confirm the missing-module failure**

Run: `pnpm exec vitest run --project unit packages/contracts/src/projects.test.ts`

Expected: FAIL because `./projects.js` does not exist.

- [ ] **Step 3: Add strict schemas and exports**

Use these exact public values and request fields:

```ts
import { z } from "zod";

const UuidSchema = z.string().uuid();
const UtcInstantSchema = z.iso.datetime({ offset: true });
const ReasonSchema = z.string().trim().min(1).max(1_000);

export const ProjectStatusSchema = z.enum(["draft", "active", "paused", "completed", "archived"]);
export const WorkstreamStatusSchema = ProjectStatusSchema;
export const ResponsibilityTypeSchema = z.enum(["original", "acting", "permanent", "contributor"]);

export const CreateProjectSchema = z.object({
  departmentId: UuidSchema,
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4_000),
  primaryOwnerId: UuidSchema,
  startsAt: UtcInstantSchema,
  reason: ReasonSchema,
}).strict();

export const CreateWorkstreamSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4_000),
  primaryOwnerId: UuidSchema,
  startsAt: UtcInstantSchema,
  reason: ReasonSchema,
}).strict();

export const AddMemberSchema = z.object({
  userId: UuidSchema,
  startsAt: UtcInstantSchema,
  reason: ReasonSchema,
}).strict();

export const EndMembershipSchema = z.object({
  endsAt: UtcInstantSchema,
  reason: ReasonSchema,
  expectedVersion: z.number().int().positive(),
}).strict();

export const UpdateStatusSchema = z.object({
  status: ProjectStatusSchema,
  reason: ReasonSchema,
  expectedVersion: z.number().int().positive(),
}).strict();

const TransferBaseSchema = z.object({
  toUserId: UuidSchema,
  effectiveAt: UtcInstantSchema,
  reason: ReasonSchema,
  expectedVersion: z.number().int().positive(),
  relatedHandoverReference: z.string().trim().min(1).max(200).optional(),
});

export const TransferOwnershipSchema = z.discriminatedUnion("transferKind", [
  TransferBaseSchema.extend({ transferKind: z.literal("permanent") }).strict(),
  TransferBaseSchema.extend({
    transferKind: z.literal("acting"),
    endsAt: UtcInstantSchema,
    delegationType: z.string().trim().min(1).max(80),
  }).strict(),
]).superRefine((value, context) => {
  if (value.transferKind === "acting" && Date.parse(value.endsAt) <= Date.parse(value.effectiveAt)) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "endsAt must follow effectiveAt" });
  }
});

export const ResponsibilityAtSchema = z.object({ at: UtcInstantSchema }).strict();

export const ProjectSchema = z.object({
  id: UuidSchema,
  departmentId: UuidSchema,
  name: z.string(),
  description: z.string(),
  status: ProjectStatusSchema,
  version: z.number().int().positive(),
  primaryOwnerId: UuidSchema.nullable(),
}).strict();

export const WorkstreamSchema = z.object({
  id: UuidSchema,
  projectId: UuidSchema,
  name: z.string(),
  description: z.string(),
  status: WorkstreamStatusSchema,
  version: z.number().int().positive(),
  primaryOwnerId: UuidSchema.nullable(),
}).strict();

export const ResponsibilityWindowSchema = z.object({
  id: UuidSchema,
  employeeId: UuidSchema,
  projectId: UuidSchema.nullable(),
  workstreamId: UuidSchema.nullable(),
  responsibilityType: ResponsibilityTypeSchema,
  startsAt: UtcInstantSchema,
  endsAt: UtcInstantSchema.nullable(),
  reason: ReasonSchema,
  delegationType: z.string().nullable(),
  relatedHandoverReference: z.string().nullable(),
  managerDecisionById: UuidSchema.nullable(),
  managerDecisionAt: UtcInstantSchema.nullable(),
  managerDecisionReason: z.string().nullable(),
}).strict();
```

Export every schema and inferred type from `packages/contracts/src/index.ts`.

- [ ] **Step 4: Add policy tests before changing decisions**

Add cases that prove:

```ts
expect(decide(manager, "project.create", department, context)).toEqual({ allowed: true });
expect(decide(otherDepartmentManager, "project.create", department, context)).toEqual({
  allowed: false,
  reasonCode: "SCOPE_MISMATCH",
});
expect(decide(projectOwner, "project.manage", project, context)).toEqual({ allowed: true });
expect(decide(projectOwner, "department.manage", department, context)).toEqual({
  allowed: false,
  reasonCode: "ROLE_REQUIRED",
});
expect(decide(projectOwner, "employeeEvaluation.manage", project, context)).toEqual({
  allowed: false,
  reasonCode: "ROLE_REQUIRED",
});
expect(decide(systemAdministrator, "responsibility.transfer", project, context)).toEqual({
  allowed: false,
  reasonCode: "ROLE_REQUIRED",
});
```

- [ ] **Step 5: Implement the policy matrix**

Use department-scoped managers for create and transfer. Allow a department manager or the matching permanent/acting owner to manage a project/workstream operationally only while the matching responsibility window contains `context.now`. Require the same active-window check for `resource.contribute`; a historical role assignment alone never authorizes an action. Keep unknown and evaluation actions denied. Extend resources to carry `departmentId`:

```ts
type ProjectResource = Readonly<{ kind: "project"; projectId: string; departmentId: string }>;
type WorkstreamResource = Readonly<{
  kind: "workstream";
  workstreamId: string;
  projectId: string;
  departmentId: string;
}>;
```

Replace `ActingOwnerWindow` with a general `ResponsibilityAccessWindow` carrying `subjectId`, scope, `responsibilityType`, `startsAt`, and `endsAt`. Define reads exactly:

- department manager: every project/workstream in the assigned department;
- active project owner/member/contributor: that project;
- active project owner: child workstreams for coordination;
- active workstream owner/contributor: that workstream and its parent-project summary;
- inactive principal: deny `INACTIVE`; active but unassigned or cross-department principal: deny `SCOPE_MISMATCH`.

Persistence list methods receive the principal's authorized department and active scope IDs and apply them in SQL; they never fetch all rows and filter in memory.

- [ ] **Step 6: Verify and commit**

Run: `pnpm exec vitest run --project unit packages/contracts/src/projects.test.ts packages/permissions/src/decide.test.ts`

Expected: PASS.

Run: `pnpm lint && pnpm typecheck`

Expected: PASS.

Commit: `git commit -m "feat: add project domain contracts and policies"`

---

### Task 2: Create the project domain package and pure invariants

**Files:**
- Create: `packages/projects/package.json`
- Create: `packages/projects/tsconfig.json`
- Create: `packages/projects/src/index.ts`
- Create: `packages/projects/src/model.ts`
- Create: `packages/projects/src/invariants.ts`
- Create: `packages/projects/src/invariants.test.ts`
- Modify: `packages/database/src/index.ts`

**Interfaces:**
- Produces: `assertLifecycleTransition`, `assertResponsibilityWindow`, `containsInstant`, `ownerResponsibilityTypes`, and `ProjectDatabase`.
- Consumes only public contracts and structural persistence/audit ports; no NestJS dependency.

- [ ] **Step 1: Write failing invariant tests**

```ts
import { describe, expect, it } from "vitest";
import { assertLifecycleTransition, assertResponsibilityWindow, containsInstant } from "./invariants.js";

describe("project invariants", () => {
  it("requires an owner before activation", () => {
    expect(() => assertLifecycleTransition("draft", "active", false)).toThrowError(
      expect.objectContaining({ code: "PRIMARY_OWNER_REQUIRED" }),
    );
  });

  it("accepts half-open contributor windows and rejects zero duration", () => {
    expect(
      containsInstant(
        { startsAt: "2026-07-17T00:00:00Z", endsAt: "2026-07-18T00:00:00Z" },
        "2026-07-17T23:59:59Z",
      ),
    ).toBe(true);
    expect(
      containsInstant(
        { startsAt: "2026-07-17T00:00:00Z", endsAt: "2026-07-18T00:00:00Z" },
        "2026-07-18T00:00:00Z",
      ),
    ).toBe(false);
    expect(() =>
      assertResponsibilityWindow({
        responsibilityType: "contributor",
        startsAt: "2026-07-17T00:00:00Z",
        endsAt: "2026-07-17T00:00:00Z",
        reason: "Contribution",
        managerDecisionById: null,
        managerDecisionAt: null,
        managerDecisionReason: null,
        delegationType: null,
      }),
    ).toThrowError(expect.objectContaining({ code: "RESPONSIBILITY_WINDOW_INVALID" }));
  });

  it("requires manager decision and delegation data for acting ownership", () => {
    expect(() =>
      assertResponsibilityWindow({
        responsibilityType: "acting",
        startsAt: "2026-07-17T00:00:00Z",
        endsAt: null,
        reason: "Cover approved absence",
        managerDecisionById: null,
        managerDecisionAt: null,
        managerDecisionReason: null,
        delegationType: null,
      }),
    ).toThrowError(expect.objectContaining({ code: "MANAGER_DECISION_REQUIRED" }));

    expect(() =>
      assertResponsibilityWindow({
        responsibilityType: "acting",
        startsAt: "2026-07-17T00:00:00Z",
        endsAt: null,
        reason: "Cover approved absence",
        managerDecisionById: "00000000-0000-4000-8000-000000000001",
        managerDecisionAt: "2026-07-16T12:00:00Z",
        managerDecisionReason: "Approved coverage",
        delegationType: "approved_leave",
      }),
    ).toThrowError(expect.objectContaining({ code: "ACTING_WINDOW_END_REQUIRED" }));
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `pnpm exec vitest run --project unit packages/projects/src/invariants.test.ts`

Expected: FAIL because the package and invariants do not exist.

- [ ] **Step 3: Add package metadata and exact persistence ports**

`package.json` follows existing workspace scripts and depends on `@evaluation/contracts`, `@evaluation/database`, and `zod` only. Export the database types from `packages/database/src/index.ts`:

```ts
export type DatabaseClient = import("./generated/prisma/client.js").PrismaClient;
export type DatabaseTransaction = import("./generated/prisma/client.js").Prisma.TransactionClient;
```

Define the application dependency in `model.ts` without re-exporting Prisma types from `@evaluation/projects`:

```ts
export interface ProjectDatabase {
  $transaction<T>(
    operation: (transaction: import("@evaluation/database").DatabaseTransaction) => Promise<T>,
    options?: Readonly<{ isolationLevel: "Serializable" }>,
  ): Promise<T>;
}
```

- [ ] **Step 4: Implement pure invariants**

Use `AppError` with stable codes. The allowed lifecycle graph is:

```ts
const allowed = Object.freeze({
  draft: ["active", "archived"],
  active: ["paused", "completed", "archived"],
  paused: ["active", "completed", "archived"],
  completed: ["archived"],
  archived: [],
} as const);
```

Require the manager-decision triad for owner types. Require both a finite `endsAt` and `delegationType` for `acting`; forbid delegation data for `original`, `permanent`, and `contributor`. Reject non-finite or non-increasing intervals and implement half-open containment.

- [ ] **Step 5: Verify and commit**

Run: `pnpm exec vitest run --project unit packages/projects/src/invariants.test.ts`

Expected: PASS.

Run: `pnpm --filter @evaluation/projects lint && pnpm --filter @evaluation/projects typecheck`

Expected: PASS.

Commit: `git commit -m "feat: add project domain invariants"`

---

### Task 3: Add the Phase 1 responsibility schema and migration constraints

**Files:**
- Create: `packages/database/prisma/migrations/0009_projects_workstreams_responsibility/migration.sql`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/src/projects-schema.integration.test.ts`
- Modify: `packages/database/package.json`

**Interfaces:**
- Produces database models: `Project`, `ProjectStatusTransition`, `ProjectMember`, `Workstream`, `WorkstreamStatusTransition`, `WorkstreamMember`, `ResponsibilityWindow`, and `OwnershipTransfer`.
- Produces enums: `ProjectStatus`, `WorkstreamStatus`, and `ResponsibilityType`.
- Adds parent relations to `Organization`, `Department`, `User`, and `AuthorizationScope` without changing existing protected records.

- [ ] **Step 1: Write the migration integration tests first**

Cover these exact database rejections:

```ts
await expect(createOverlappingProjectOwners(projectId)).rejects.toBeDefined();
await expect(createOverlappingWorkstreamOwners(workstreamId)).rejects.toBeDefined();
await expect(createZeroLengthWindow(projectId)).rejects.toBeDefined();
await expect(createWindowWithBothProjectAndWorkstream(projectId, workstreamId)).rejects.toBeDefined();
await expect(createActingWindowWithoutDelegation(projectId)).rejects.toBeDefined();
await expect(createActingWindowWithoutFiniteEnd(projectId)).rejects.toBeDefined();
await expect(createIncompleteManagerDecision(projectId)).rejects.toBeDefined();
await expect(createOverlappingContributors(projectId)).resolves.toHaveLength(2);
await expect(createProjectMembershipWithInvalidRange(projectId)).rejects.toBeDefined();
await expect(createWorkstreamMembershipWithInvalidRange(workstreamId)).rejects.toBeDefined();
```

- [ ] **Step 2: Run the focused test and confirm missing-table failure**

Run: `pnpm --filter @evaluation/database db:generate && pnpm exec vitest run --project integration packages/database/src/projects-schema.integration.test.ts`

Expected: FAIL because `projects` and related tables do not exist.

- [ ] **Step 3: Add the Prisma models and forward-only SQL migration**

Use nullable `projectId`/`workstreamId` foreign keys with a SQL check requiring exactly one. Include `organizationId` and `departmentId` on `Project`, `projectId` on `Workstream`, monotonically increasing integer `version`, `createdById`, and UTC timestamp columns. Membership rows contain `startsAt`, optional `endsAt`, `reason`, and `createdById`, use `CHECK ("endsAt" IS NULL OR "startsAt" < "endsAt")`, and are append-only. Project/workstream status-transition rows contain from/to status, transaction `effectiveAt`, actor, reason, resulting version, and creation time and use `ON DELETE RESTRICT`.

The responsibility table must include:

```sql
"responsibilityType" "ResponsibilityType" NOT NULL,
"startsAt" timestamptz(6) NOT NULL,
"endsAt" timestamptz(6),
"reason" text NOT NULL,
"managerDecisionById" uuid,
"managerDecisionAt" timestamptz(6),
"managerDecisionReason" text,
"relatedHandoverReference" text,
"delegationType" text
```

Add SQL checks for one scope, positive interval, all-or-none manager-decision fields, required manager decision for owner types, and a finite end plus delegation key only/always for acting ownership. Enable `btree_gist` and add exclusion constraints so finite acting windows and prospective return windows cannot overlap any other owner window:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "ResponsibilityWindow" ADD CONSTRAINT "ResponsibilityWindow_no_project_owner_overlap"
EXCLUDE USING gist (
  "projectId" WITH =,
  tstzrange("startsAt", "endsAt", '[)') WITH &&
) WHERE ("projectId" IS NOT NULL AND "responsibilityType" IN ('original', 'acting', 'permanent'));

ALTER TABLE "ResponsibilityWindow" ADD CONSTRAINT "ResponsibilityWindow_no_workstream_owner_overlap"
EXCLUDE USING gist (
  "workstreamId" WITH =,
  tstzrange("startsAt", "endsAt", '[)') WITH &&
) WHERE ("workstreamId" IS NOT NULL AND "responsibilityType" IN ('original', 'acting', 'permanent'));
```

Use `ON DELETE RESTRICT` for every historical relationship and add indexes for point-in-time queries `(project_id, employee_id, starts_at, ends_at)` and `(workstream_id, employee_id, starts_at, ends_at)`. `OwnershipTransfer` links the closed window and new owner window and has nullable `returnWindowId`, which is required for acting transfers and absent for permanent transfers.

- [ ] **Step 4: Run migration verification and schema tests**

Run: `pnpm db:verify`

Expected: PASS from empty database, previous `0008`, drift check, and rebuild equivalence.

Run: `pnpm exec vitest run --project integration packages/database/src/projects-schema.integration.test.ts`

Expected: PASS.

- [ ] **Step 5: Verify generated client cleanliness and commit**

Run: `pnpm db:generate && git status --short`

Expected: generated client remains ignored; only intended schema, migration, test, and package-script files are listed.

Commit: `git commit -m "feat: add project responsibility persistence"`

---

### Task 4: Implement T018 project creation, membership, lifecycle, and API

**Files:**
- Create: `packages/projects/src/project-service.ts`
- Create: `packages/projects/src/project-service.integration.test.ts`
- Modify: `packages/projects/src/index.ts`
- Create: `apps/api/src/projects/projects.controller.ts`
- Create: `apps/api/src/projects/projects.module.ts`
- Create: `apps/api/src/projects/project-policy-loaders.ts`
- Create: `apps/api/src/projects/projects.controller.test.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Produces `ProjectService.createProject`, `getProject`, `listProjects`, `addProjectMember`, `endProjectMember`, and `transitionProject`.
- Creates the project, project authorization scope, scoped owner role, initial membership, original-owner responsibility window, and audit event in one transaction.
- API routes: `POST /api/v1/projects`, `GET /api/v1/projects`, `GET /api/v1/projects/:projectId`, `POST /api/v1/projects/:projectId/members`, `POST /api/v1/projects/:projectId/members/:userId/end`, and `PATCH /api/v1/projects/:projectId/status`.

- [ ] **Step 1: Write the failing service integration test**

```ts
const created = await service.createProject({
  actor: managerPrincipal,
  correlationId,
  input: {
    departmentId,
    name: "Evaluation Platform",
    description: "Pilot implementation",
    primaryOwnerId: employeeId,
    startsAt: "2026-07-17T06:00:00Z",
    reason: "Approved department project",
  },
});

expect(created).toMatchObject({ status: "active", version: 1, primaryOwnerId: employeeId });
await expect(readActiveOwner(created.id)).resolves.toMatchObject({
  employeeId,
  responsibilityType: "original",
});
await expect(readAudit("project.created", created.id)).resolves.toMatchObject({
  actorId: managerPrincipal.userId,
  reason: "Approved department project",
});
```

Add negative cases for another department manager, System Administrator, inactive user, unknown owner, a stale lifecycle version, an unassigned reader, ending membership before its start, two concurrent end commands, and ending membership for a current or scheduled owner. Exactly one concurrent end command succeeds and the other returns `VERSION_CONFLICT` or `RESOURCE_STATE_INVALID`; both leave one historical close and one audit event.

- [ ] **Step 2: Run the test and confirm the missing-service failure**

Run: `pnpm exec vitest run --project integration packages/projects/src/project-service.integration.test.ts`

Expected: FAIL because `ProjectService` does not exist.

- [ ] **Step 3: Implement project creation as one transaction**

Inside `createProject`, reject `startsAt` later than the service clock, verify organization/department/user membership, create the active project, create an `AuthorizationScope` with `scopeType: "project"` and the same department, create the scoped `project_owner` role, add the initial project member, create the `original` responsibility window with the manager-decision triad, and append `project.created`. Return `ProjectSchema`; never return Prisma rows directly.

Adding a project member/co-contributor rejects a future `startsAt` and creates an active membership, scoped `contributor` role assignment, contributor responsibility window, and `project.member_added` audit event in one transaction. Ending that member uses `EndMembershipSchema`, requires `endsAt` after membership/window start and no later than the service clock, rejects any active or scheduled owner, and atomically closes the active membership and matching contributor window and appends `project.member_ended`; historical role rows remain but authorization requires an active window.

Status transitions use optimistic `version` matching and `assertLifecycleTransition`; the service clock supplies `effectiveAt` at transaction time, so clients cannot schedule status. Every transition inserts `ProjectStatusTransition` and `project.status_changed` audit records with before/after status, effective instant, actor, reason, and resulting version in the same transaction. Completion/archive first rejects child workstreams outside `completed`/`archived` with `ACTIVE_WORKSTREAMS_REMAIN`, then rejects a current acting window or any owner window beginning after the transaction instant with `SCHEDULED_OWNERSHIP_REMAINS`; no cascade or schedule deletion is allowed. A permitted terminal transition closes only memberships and responsibility windows active at the transaction instant and never deletes rows. Terminal serialization returns `primaryOwnerId: null`; the last owner remains available only through responsibility history. Rollback tests force status-history and audit insertion failures and assert current status, version, memberships, and windows remain unchanged.

- [ ] **Step 4: Write controller and policy-loader tests**

Test strict parsing, `RequirePolicy` metadata, manager department scope, active owner/member reads, inactive/unassigned/cross-department denial, owner operational scope, and error-envelope serialization. Assert that a project owner cannot call a manager-only department or evaluation action. List tests prove the repository query receives allowed department/scope IDs and never returns unrelated rows for in-memory filtering.

- [ ] **Step 5: Implement and compose the Nest module**

Controllers parse with the shared schemas and pass the authenticated principal plus request correlation ID to the service. Policy loaders fetch only the resource scope needed for `decide`; they do not perform the mutation. Compose `databaseAuditWriter` into the service so audit insertion uses the same Prisma transaction.

- [ ] **Step 6: Verify T018 and commit**

Run: `pnpm exec vitest run --project unit apps/api/src/projects packages/projects/src`

Expected: PASS.

Run: `pnpm exec vitest run --project integration packages/projects/src/project-service.integration.test.ts`

Expected: PASS.

Commit: `git commit -m "feat: implement governed project domain"`

---

### Task 5: Implement T019 workstreams and contributor membership

**Files:**
- Create: `packages/projects/src/workstream-service.ts`
- Create: `packages/projects/src/workstream-service.integration.test.ts`
- Modify: `packages/projects/src/index.ts`
- Create: `apps/api/src/projects/workstreams.controller.ts`
- Create: `apps/api/src/projects/workstreams.controller.test.ts`
- Modify: `apps/api/src/projects/projects.module.ts`
- Modify: `apps/api/src/projects/project-policy-loaders.ts`

**Interfaces:**
- Produces `WorkstreamService.createWorkstream`, `getWorkstream`, `listWorkstreams`, `addContributor`, `endContributor`, and `transitionWorkstream`.
- API routes: `POST /api/v1/projects/:projectId/workstreams`, `GET /api/v1/projects/:projectId/workstreams`, `GET /api/v1/projects/:projectId/workstreams/:workstreamId`, `POST .../:workstreamId/contributors`, `POST .../:workstreamId/contributors/:userId/end`, and `PATCH .../:workstreamId/status`.

- [ ] **Step 1: Write failing workstream tests**

Create one project with two workstreams and multiple contributors. Assert exactly one active Workstream Owner per active workstream, overlapping contributor windows, stable parent-project linkage, and no supervisor/evaluation permission for either owner role.

```ts
expect(await listWorkstreams(projectId)).toHaveLength(2);
expect(await activeOwner(workstreamA.id)).toMatchObject({ employeeId: ownerA });
expect(await activeContributorWindows(workstreamA.id)).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ employeeId: contributorA }),
    expect.objectContaining({ employeeId: contributorB }),
  ]),
);
```

Add negative cases for a workstream under a project from another department, duplicate active owner, user outside the organization, project/workstream parent mismatch, an unassigned reader, and ending a current or scheduled owner as a contributor.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm exec vitest run --project integration packages/projects/src/workstream-service.integration.test.ts`

Expected: FAIL because `WorkstreamService` does not exist.

- [ ] **Step 3: Implement workstream creation and contributor flow**

Creation rejects a future `startsAt` and is one transaction: lock/read the parent project, require it to be active or paused, create the active workstream, create a workstream authorization scope, assign the scoped `workstream_owner` role, create owner membership and original-owner responsibility, and append `workstream.created`. Contributor addition rejects a future `startsAt` and creates append-only membership, scoped `contributor` role, contributor responsibility, and `workstream.contributor_added` audit event. Repeated identical active membership returns `RESOURCE_STATE_INVALID` rather than silently rewriting history. `endContributor` uses `EndMembershipSchema`, requires `endsAt` after the membership/window start and no later than the service clock, and atomically closes membership and the active contributor window, retains the historical role row, appends `workstream.contributor_ended`, and rejects any active or scheduled owner. Concurrent closure tests prove exactly one close and audit event.

Workstream status changes use the service transaction time, insert `WorkstreamStatusTransition` and `workstream.status_changed` audit records, and use optimistic version matching. Completion/archive rejects a current acting window or future owner window with `SCHEDULED_OWNERSHIP_REMAINS`; otherwise it closes only currently active workstream memberships/responsibilities and serializes `primaryOwnerId: null`, with the last owner available through history. Forced history/audit failures roll back status, version, memberships, and windows.

- [ ] **Step 4: Add routes and verify policy boundaries**

Use the parent project and department in resource loaders. Prove a manager sees only department workstreams, a project owner sees child workstreams, an active workstream owner/contributor sees that workstream and parent summary, and inactive/unassigned/cross-department users are denied. Prove a workstream owner can update their workstream status but cannot manage the parent project, another workstream, employees, evaluations, or department settings. List filtering occurs in persistence.

- [ ] **Step 5: Verify T019 and commit**

Run: `pnpm exec vitest run --project unit apps/api/src/projects packages/projects/src`

Expected: PASS.

Run: `pnpm exec vitest run --project integration packages/projects/src/workstream-service.integration.test.ts`

Expected: PASS.

Commit: `git commit -m "feat: implement workstream governance"`

---

### Task 6: Implement T020 atomic owner transfer and period queries

**Files:**
- Create: `packages/projects/src/responsibility-service.ts`
- Create: `packages/projects/src/responsibility-service.integration.test.ts`
- Modify: `packages/projects/src/index.ts`
- Create: `apps/api/src/projects/responsibilities.controller.ts`
- Create: `apps/api/src/projects/responsibilities.controller.test.ts`
- Modify: `apps/api/src/projects/projects.module.ts`
- Modify: `apps/api/src/projects/project-policy-loaders.ts`

**Interfaces:**
- Produces `ResponsibilityService.transferProjectOwner`, `transferWorkstreamOwner`, `responsibilitiesAt`, and `responsibilityHistory`.
- API routes: `POST /api/v1/projects/:projectId/owner-transfers`, `POST /api/v1/projects/:projectId/workstreams/:workstreamId/owner-transfers`, and scoped responsibility queries with `at`.
- Only a matching department manager may create permanent or bounded acting ownership transfers. System Administrator and owner roles are denied.

- [ ] **Step 1: Write the failing concurrency and history tests**

```ts
const [first, second] = await Promise.allSettled([
  service.transferProjectOwner(command({ transferKind: "permanent", toUserId: employeeB, expectedVersion: 1 })),
  service.transferProjectOwner(command({ transferKind: "permanent", toUserId: employeeC, expectedVersion: 1 })),
]);
expect([first.status, second.status].sort()).toEqual(["fulfilled", "rejected"]);

expect(await service.responsibilitiesAt(projectId, "2026-07-31T23:59:59Z")).toContainEqual(
  expect.objectContaining({ employeeId: employeeA }),
);
expect(await service.responsibilitiesAt(projectId, "2026-08-01T00:00:00Z")).toContainEqual(
  expect.objectContaining({ employeeId: employeeB }),
);
expect(await responsibilityHistory(projectId)).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ employeeId: employeeA, endsAt: "2026-08-01T00:00:00.000Z" }),
    expect.objectContaining({ employeeId: employeeB, startsAt: "2026-08-01T00:00:00.000Z" }),
  ]),
);
```

Add an acting-transfer case from employee A to B for `[2026-08-01, 2026-08-08)`. Assert A before the start, B during the acting interval, and A again at the exact end through a prospective return window. Assert B receives scoped `acting_owner`, A retains scoped `project_owner`, and policy decisions follow only the active window. Add rollback tests by forcing audit insertion failure and asserting membership, owner/return windows, role assignments, version, and transfer rows remain unchanged.

- [ ] **Step 2: Run and confirm the missing-service failure**

Run: `pnpm exec vitest run --project integration packages/projects/src/responsibility-service.integration.test.ts`

Expected: FAIL because `ResponsibilityService` does not exist.

- [ ] **Step 3: Implement one locked transfer transaction**

Within a serializable transaction:

1. Lock the project or workstream row with `SELECT ... FOR UPDATE`.
2. Match `expectedVersion`; otherwise throw `VERSION_CONFLICT`.
3. Load and validate the owner window containing `effectiveAt`; reject nested acting transfers.
4. Validate the target user. If no active target membership exists, create it at `effectiveAt` in the same transaction. Keep the prior owner's membership active; membership ends only through the explicit end command.
5. Close the old window at the exact effective instant.
6. For `permanent`, create an open `permanent` window and forbid `endsAt`/delegation data. For `acting`, create the finite acting window plus the prior owner's `permanent` return window starting at `endsAt`; require `delegationType` and `endsAt > effectiveAt`.
7. Ensure the permanent target has scoped `project_owner`/`workstream_owner`; ensure the acting target has scoped `acting_owner`. Retain prior and historical role-assignment rows. Authorization requires the matching responsibility window at request time, so retained rows alone grant nothing.
8. Create the `OwnershipTransfer` row linking the closed window and new window; set `returnWindowId` only for acting transfer.
9. Increment the resource version.
10. Append `project.owner_transferred` or `workstream.owner_transferred` with safe IDs and reason.

Any exclusion-constraint or stale-version conflict maps to the stable application error and rolls back all ten effects.

- [ ] **Step 4: Implement half-open point-in-time queries**

Use the exact predicate:

```ts
where: {
  startsAt: { lte: at },
  OR: [{ endsAt: null }, { endsAt: { gt: at } }],
}
```

Order history by `startsAt`, then ID. Never infer attribution from the current owner.

- [ ] **Step 5: Add protected API tests**

Prove matching department manager success and cross-department manager, System Administrator, project owner, workstream owner, inactive user, stale version, parent mismatch, unbounded acting transfer, and acting end-before-start denial. Assert every denial leaves database state unchanged. Policy-loader tests load the current `ResponsibilityAccessWindow` for permanent, acting, and contributor access and reject expired/future windows.

- [ ] **Step 6: Verify T020 and commit**

Run: `pnpm exec vitest run --project unit apps/api/src/projects packages/projects/src`

Expected: PASS.

Run: `pnpm exec vitest run --project integration packages/projects/src/responsibility-service.integration.test.ts`

Expected: PASS.

Commit: `git commit -m "feat: add atomic responsibility transfers"`

---

### Task 7: Verify Bundle A end to end and update operational state

**Files:**
- Create: `apps/api/src/projects/projects.e2e.integration.test.ts`
- Modify: `project-state/PROJECT_STATE.md`
- Modify: `project-state/SYSTEM_MAP.html`
- Modify: `MANIFEST.json` for every tracked file whose bytes or SHA-256 changed.

**Interfaces:**
- Produces a protected HTTP workflow proving project creation, two workstreams, contributors, owner transfer, history, and denial boundaries through the composed API.

- [ ] **Step 1: Add the composed API workflow test**

Start the Nest application against the integration database with the real policy guard and deterministic test token validator/user synchronizer. Execute:

1. Manager creates one active project.
2. Manager creates two active workstreams with different owners.
3. Authorized actor adds two contributors to one workstream and ends one contributor at an exact UTC instant.
4. Manager creates a bounded acting transfer and verifies the scheduled return owner.
5. Manager performs a permanent workstream transfer at an exact UTC instant.
6. Read pre/during/post responsibility instants, membership periods, and full history.
7. Project owner attempts a manager-only transfer and receives 403.
8. System Administrator attempts reassignment and receives 403.
9. Other-department manager and unassigned employee read or mutate the resource and receive 403 with `AUTHZ_SCOPE_MISMATCH`.
10. Project completion with an active child workstream receives `ACTIVE_WORKSTREAMS_REMAIN` and changes no state.
11. Workstream completion during acting ownership receives `SCHEDULED_OWNERSHIP_REMAINS` and changes no state.
12. After permitted status changes, read append-only status-transition and audit records with matching before/after state, transaction time, actor, reason, and version.
13. Read completed/archived project and workstream responses with `primaryOwnerId: null` while responsibility history still returns the last owner period.

Assert error envelopes contain stable code, message key, and correlation ID and contain no internal database details.

- [ ] **Step 2: Run all Bundle A suites**

Run: `pnpm test`

Expected: PASS.

Run: `pnpm test:integration`

Expected: PASS, including the composed API workflow.

Run: `pnpm db:verify`

Expected: PASS for empty, previous, drift, and rebuild paths.

- [ ] **Step 3: Run repository gates**

Run: `pnpm verify`

Expected: PASS for task graph, secret/performance scans, formatting, lint, boundaries, copy, typecheck, unit coverage, and build.

Run: `pnpm test:ai`

Expected: existing deterministic AI suite remains green; Bundle A adds no AI route.

Run: `pnpm test:e2e`

Expected: existing browser localization/RTL suite remains green; Bundle A adds no user interface.

- [ ] **Step 4: Independently review protected boundaries**

Request one bounded independent review covering migration constraints, transaction rollback, authorization/non-supervision, historical preservation, audit atomicity, and authoritative alignment. Resolve every P0/P1 finding before completion; record non-blocking findings without expanding scope.

- [ ] **Step 5: Update project state and manifest**

Record T018–T020 as complete, fresh test counts, remaining risks, and Bundle B as the next action. Keep T016 inactive. Recalculate manifest bytes/hashes for tracked project-state files and validate every manifest entry.

- [ ] **Step 6: Commit the verified bundle**

Run: `git diff --check && git status --short`

Expected: clean diff checks and only intentional Bundle A changes before the final commit.

Commit: `git commit -m "test: verify Phase 1 responsibility bundle"`
