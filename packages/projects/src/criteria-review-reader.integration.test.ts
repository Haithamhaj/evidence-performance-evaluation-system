import { describe, expect, it, vi } from "vitest";

import { CriteriaReviewReader } from "./criteria-review-reader.js";

const at = new Date("2026-07-17T12:00:00.000Z");

describe("CriteriaReviewReader", () => {
  it("returns one active workstream owner and sorted distinct active contributors", async () => {
    const resourceId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const organizationId = crypto.randomUUID();
    const departmentId = crypto.randomUUID();
    const primaryOwnerId = crypto.randomUUID();
    const contributorA = crypto.randomUUID();
    const contributorB = crypto.randomUUID();
    const findMany = vi.fn(async () => [
      {
        id: crypto.randomUUID(),
        employeeId: contributorB,
        responsibilityType: "contributor",
        employee: { active: true },
        startsAt: new Date("2026-07-01T00:00:00.000Z"),
        endsAt: null,
      },
      {
        id: crypto.randomUUID(),
        employeeId: primaryOwnerId,
        responsibilityType: "acting",
        employee: { active: true },
        startsAt: new Date("2026-07-17T12:00:00.000Z"),
        endsAt: new Date("2026-07-18T00:00:00.000Z"),
      },
      {
        id: crypto.randomUUID(),
        employeeId: contributorA,
        responsibilityType: "contributor",
        employee: { active: true },
        startsAt: new Date("2026-07-01T00:00:00.000Z"),
        endsAt: null,
      },
      {
        id: crypto.randomUUID(),
        employeeId: contributorB,
        responsibilityType: "contributor",
        employee: { active: true },
        startsAt: new Date("2026-07-10T00:00:00.000Z"),
        endsAt: null,
      },
    ]);
    const reader = new CriteriaReviewReader({
      workstream: {
        findUnique: vi.fn(async () => ({
          id: resourceId,
          projectId,
          project: { organizationId, departmentId },
        })),
      },
      responsibilityWindow: { findMany },
    } as never);

    await expect(reader.snapshot({ kind: "workstream", resourceId, at })).resolves.toEqual({
      kind: "workstream",
      resourceId,
      projectId,
      organizationId,
      departmentId,
      primaryOwnerId,
      contributorIds: [contributorA, contributorB].sort(),
    });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        workstreamId: resourceId,
        startsAt: { lte: at },
        OR: [{ endsAt: null }, { endsAt: { gt: at } }],
        employee: { active: true },
      },
      select: {
        employeeId: true,
        responsibilityType: true,
        employee: { select: { active: true } },
      },
    });
  });

  it("honors half-open windows and returns null unless exactly one owner is active", async () => {
    const projectId = crypto.randomUUID();
    const ownerA = crypto.randomUUID();
    const ownerB = crypto.randomUUID();
    const project = {
      id: projectId,
      organizationId: crypto.randomUUID(),
      departmentId: crypto.randomUUID(),
    };
    const base = {
      project: { findUnique: vi.fn(async () => project) },
      responsibilityWindow: {
        findMany: vi.fn(async () => [
          {
            employeeId: ownerA,
            responsibilityType: "original",
            employee: { active: true },
          },
          {
            employeeId: ownerB,
            responsibilityType: "permanent",
            employee: { active: true },
          },
        ]),
      },
    };
    const reader = new CriteriaReviewReader(base as never);
    await expect(
      reader.snapshot({ kind: "project", resourceId: projectId, at }),
    ).resolves.toBeNull();

    expect(base.responsibilityWindow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startsAt: { lte: at },
          OR: [{ endsAt: null }, { endsAt: { gt: at } }],
        }),
      }),
    );
  });

  it("excludes deactivated owners and contributors from the active identity snapshot", async () => {
    const projectId = crypto.randomUUID();
    const activeOwnerId = crypto.randomUUID();
    const activeContributorId = crypto.randomUUID();
    const transaction = {
      $queryRaw: vi.fn(async () => []),
      project: {
        findUnique: vi.fn(async () => ({
          id: projectId,
          organizationId: crypto.randomUUID(),
          departmentId: crypto.randomUUID(),
        })),
      },
      responsibilityWindow: {
        findMany: vi.fn(async () => [
          {
            employeeId: activeOwnerId,
            responsibilityType: "permanent",
            employee: { active: true },
          },
          {
            employeeId: crypto.randomUUID(),
            responsibilityType: "acting",
            employee: { active: false },
          },
          {
            employeeId: activeContributorId,
            responsibilityType: "contributor",
            employee: { active: true },
          },
          {
            employeeId: crypto.randomUUID(),
            responsibilityType: "contributor",
            employee: { active: false },
          },
        ]),
      },
    };
    const reader = new CriteriaReviewReader({} as never);

    await expect(
      reader.snapshotIn(transaction as never, { kind: "project", resourceId: projectId, at }),
    ).resolves.toMatchObject({
      primaryOwnerId: activeOwnerId,
      contributorIds: [activeContributorId],
    });
    expect(transaction.responsibilityWindow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ employee: { active: true } }),
        select: {
          employeeId: true,
          responsibilityType: true,
          employee: { select: { active: true } },
        },
      }),
    );
  });
});
