import { describe, expect, it } from "vitest";

import {
  CreateProjectSchema,
  CreateWorkstreamSchema,
  EndMembershipSchema,
  ProjectSchema,
  ResponsibilityAtSchema,
  ResponsibilityWindowSchema,
  TransferOwnershipSchema,
  UpdateStatusSchema,
  WorkstreamSchema,
} from "./projects.js";

const ownerId = "00000000-0000-4000-8000-000000000001";
const departmentId = "00000000-0000-4000-8000-000000000002";
const projectId = "00000000-0000-4000-8000-000000000003";

describe("project contracts", () => {
  it("accepts offset-aware project and workstream creation requests", () => {
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

    expect(
      CreateWorkstreamSchema.parse({
        name: "API",
        description: "Project API",
        primaryOwnerId: ownerId,
        startsAt: "2026-07-17T06:00:00Z",
        reason: "Approved workstream",
      }),
    ).toMatchObject({ primaryOwnerId: ownerId });
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

  it("discriminates permanent and bounded acting transfers", () => {
    expect(
      TransferOwnershipSchema.parse({
        transferKind: "permanent",
        toUserId: ownerId,
        effectiveAt: "2026-08-01T00:00:00Z",
        reason: "Manager-approved transfer",
        expectedVersion: 3,
      }),
    ).toMatchObject({ transferKind: "permanent", expectedVersion: 3 });

    expect(
      TransferOwnershipSchema.parse({
        transferKind: "acting",
        toUserId: ownerId,
        effectiveAt: "2026-08-01T00:00:00Z",
        endsAt: "2026-08-08T00:00:00Z",
        delegationType: "approved_leave",
        reason: "Temporary coverage",
        expectedVersion: 3,
      }),
    ).toMatchObject({ transferKind: "acting", delegationType: "approved_leave" });
  });

  it.each([
    {
      transferKind: "acting",
      endsAt: undefined,
      delegationType: "approved_leave",
    },
    {
      transferKind: "acting",
      endsAt: "2026-08-01T00:00:00Z",
      delegationType: "approved_leave",
    },
    {
      transferKind: "permanent",
      endsAt: "2026-08-08T00:00:00Z",
      delegationType: "approved_leave",
    },
  ])("rejects an invalid transfer variant %#", (variant) => {
    expect(() =>
      TransferOwnershipSchema.parse({
        toUserId: ownerId,
        effectiveAt: "2026-08-01T00:00:00Z",
        reason: "Transfer",
        expectedVersion: 3,
        ...variant,
      }),
    ).toThrow();
  });

  it("keeps membership, status and point-in-time commands explicit", () => {
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
    expect(ResponsibilityAtSchema.parse({ at: "2026-08-01T00:00:00Z" })).toBeDefined();
  });

  it("serializes terminal resources without a misleading current owner", () => {
    expect(
      ProjectSchema.parse({
        id: projectId,
        departmentId,
        name: "Evaluation Platform",
        description: "Pilot implementation",
        status: "completed",
        version: 4,
        primaryOwnerId: null,
      }),
    ).toMatchObject({ status: "completed", primaryOwnerId: null });

    expect(
      WorkstreamSchema.parse({
        id: "00000000-0000-4000-8000-000000000004",
        projectId,
        name: "API",
        description: "Project API",
        status: "archived",
        version: 5,
        primaryOwnerId: null,
      }),
    ).toMatchObject({ status: "archived", primaryOwnerId: null });
  });

  it("serializes authoritative responsibility decision details", () => {
    expect(
      ResponsibilityWindowSchema.parse({
        id: "00000000-0000-4000-8000-000000000005",
        employeeId: ownerId,
        projectId,
        workstreamId: null,
        responsibilityType: "acting",
        startsAt: "2026-08-01T00:00:00Z",
        endsAt: "2026-08-08T00:00:00Z",
        reason: "Temporary coverage",
        delegationType: "approved_leave",
        relatedHandoverReference: null,
        managerDecisionById: "00000000-0000-4000-8000-000000000006",
        managerDecisionAt: "2026-07-31T12:00:00Z",
        managerDecisionReason: "Approved coverage",
      }),
    ).toMatchObject({ responsibilityType: "acting", managerDecisionReason: "Approved coverage" });
  });
});
