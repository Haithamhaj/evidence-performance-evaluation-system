import { describe, expect, it, vi } from "vitest";

import { CheckInService } from "./check-in-service.js";

const employeeId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const workstreamId = crypto.randomUUID();
const thursday = new Date("2026-08-06T09:00:00.000Z");

function responsibilities() {
  const row: {
    projectId: string;
    projectName: string;
    workstreamId: string;
    workstreamName: string;
    startsAt: Date;
    endsAt: Date | null;
  } = {
    projectId,
    projectName: "Customer workspace",
    workstreamId,
    workstreamName: "Daily operations",
    startsAt: new Date("2026-08-02T00:00:00.000Z"),
    endsAt: null,
  };
  return {
    listWorkstreamResponsibilities: vi.fn(
      async (_input?: { employeeId: string; startsAt: string; endsAt: string }) => [row],
    ),
  };
}

describe("CheckInService", () => {
  it("requires a Thursday check-in only when no substantive accepted update exists", async () => {
    const responsibilityReader = responsibilities();
    const updates = { hasSubstantiveAcceptedUpdate: vi.fn(async () => false) };
    const leaves = { findApprovedLeave: vi.fn(async () => null) };
    const service = new CheckInService(responsibilityReader, updates, leaves, () => thursday);

    await expect(service.listForEmployee({ employeeId })).resolves.toMatchObject([
      {
        projectId,
        workstreamId,
        state: "required",
        capture: {
          projectId,
          workstreamId,
          workItemId: null,
        },
      },
    ]);

    updates.hasSubstantiveAcceptedUpdate.mockResolvedValue(true);
    await expect(service.listForEmployee({ employeeId })).resolves.toMatchObject([
      { state: "satisfied_by_update", capture: null },
    ]);
  });

  it("does not ask before Thursday and follows the actual responsibility period", async () => {
    const responsibilityReader = responsibilities();
    const updates = { hasSubstantiveAcceptedUpdate: vi.fn(async () => false) };
    const service = new CheckInService(
      responsibilityReader,
      updates,
      { findApprovedLeave: vi.fn(async () => null) },
      () => new Date("2026-08-04T09:00:00.000Z"),
    );

    await expect(service.listForEmployee({ employeeId })).resolves.toMatchObject([
      { state: "not_due", capture: null },
    ]);

    responsibilityReader.listWorkstreamResponsibilities.mockResolvedValue([]);
    await expect(service.listForEmployee({ employeeId })).resolves.toEqual([]);
    expect(updates.hasSubstantiveAcceptedUpdate).toHaveBeenCalledTimes(1);
  });

  it("creates one weekly obligation when responsibility has successive windows", async () => {
    const responsibilityReader = responsibilities();
    const original = (
      await responsibilityReader.listWorkstreamResponsibilities({
        employeeId,
        startsAt: "",
        endsAt: "",
      })
    )[0]!;
    responsibilityReader.listWorkstreamResponsibilities.mockResolvedValue([
      { ...original, endsAt: new Date("2026-08-05T12:00:00.000Z") },
      { ...original, startsAt: new Date("2026-08-05T12:00:00.000Z") },
    ]);
    const service = new CheckInService(
      responsibilityReader,
      { hasSubstantiveAcceptedUpdate: vi.fn(async () => false) },
      { findApprovedLeave: vi.fn(async () => null) },
      () => thursday,
    );

    await expect(service.listForEmployee({ employeeId })).resolves.toHaveLength(1);
  });

  it("excludes approved leave without accepting self-asserted leave", async () => {
    const leaves = {
      findApprovedLeave: vi.fn(async () => ({ leaveId: crypto.randomUUID() })),
    };
    const service = new CheckInService(
      responsibilities(),
      { hasSubstantiveAcceptedUpdate: vi.fn(async () => false) },
      leaves,
      () => thursday,
    );

    await expect(service.listForEmployee({ employeeId })).resolves.toMatchObject([
      { state: "exempt_approved_leave", capture: null },
    ]);
    expect(leaves.findApprovedLeave).toHaveBeenCalledWith({
      employeeId,
      startsAt: "2026-08-01T21:00:00.000Z",
      endsAt: "2026-08-08T21:00:00.000Z",
    });
  });
});
