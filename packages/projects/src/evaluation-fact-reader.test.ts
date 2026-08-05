import { describe, expect, it, vi } from "vitest";

describe("ProjectEvaluationFactReader", () => {
  it("returns historical responsibility periods even when the employee is no longer active", async () => {
    const employeeId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const windowId = crypto.randomUUID();
    const findMany = vi.fn(async () => [
      {
        id: windowId,
        projectId,
        workstreamId: null,
        workstream: null,
        responsibilityType: "original",
        startsAt: new Date("2026-07-01T00:00:00.000Z"),
        endsAt: new Date("2026-08-01T00:00:00.000Z"),
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    ]);
    const module = (await import("./index.js")) as Record<string, unknown>;
    const Reader = module.ProjectEvaluationFactReader as
      | (new (database: unknown) => {
          readAuthorizedFacts(input: unknown): Promise<{
            responsibilityWindows: readonly { sourceId: string; responsibilityType: string }[];
          }>;
        })
      | undefined;

    expect(Reader).toBeTypeOf("function");
    const reader = new Reader!({ responsibilityWindow: { findMany } });
    const result = await reader.readAuthorizedFacts({
      subjectEmployeeId: employeeId,
      cycleStart: "2026-07-01T00:00:00.000Z",
      cycleEnd: "2026-09-30T23:59:59.999Z",
      requester: {
        actorId: employeeId,
        subjectEmployeeId: employeeId,
        access: "self",
        active: true,
      },
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ employeeId }),
      }),
    );
    expect(result.responsibilityWindows).toEqual([
      expect.objectContaining({
        sourceId: windowId,
        projectId,
        responsibilityType: "original_owner",
      }),
    ]);
  });
});
