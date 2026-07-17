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
        startsAt: new Date("2026-07-01T00:00:00.000Z"),
        endsAt: null,
      },
      {
        id: crypto.randomUUID(),
        employeeId: primaryOwnerId,
        responsibilityType: "acting",
        startsAt: new Date("2026-07-17T12:00:00.000Z"),
        endsAt: new Date("2026-07-18T00:00:00.000Z"),
      },
      {
        id: crypto.randomUUID(),
        employeeId: contributorA,
        responsibilityType: "contributor",
        startsAt: new Date("2026-07-01T00:00:00.000Z"),
        endsAt: null,
      },
      {
        id: crypto.randomUUID(),
        employeeId: contributorB,
        responsibilityType: "contributor",
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
      },
      select: { employeeId: true, responsibilityType: true },
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
          { employeeId: ownerA, responsibilityType: "original" },
          { employeeId: ownerB, responsibilityType: "permanent" },
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
});
