import { describe, expect, it, vi } from "vitest";

describe("CriteriaEvaluationFactReader", () => {
  it("uses employee scopes from Projects and returns only criteria effective in the cycle", async () => {
    const employeeId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const setId = crypto.randomUUID();
    const criterionId = crypto.randomUUID();
    const documentVersionId = crypto.randomUUID();
    const findMany = vi.fn(async () => [
      {
        id: setId,
        projectId,
        workstreamId: null,
        version: 2,
        sourceDocumentVersionId: documentVersionId,
        effectiveFrom: new Date("2026-07-15T00:00:00.000Z"),
        effectiveTo: null,
        criteria: [{ id: criterionId, position: 1, name: "Approved outcome" }],
      },
    ]);
    const scopeReader = {
      readEmployeeScopes: vi.fn(async () => ({ projectIds: [projectId], workstreamIds: [] })),
    };
    const module = (await import("./index.js")) as Record<string, unknown>;
    const Reader = module.CriteriaEvaluationFactReader as
      | (new (
          database: unknown,
          scopes: typeof scopeReader,
        ) => {
          readAuthorizedFacts(input: unknown): Promise<{
            dynamicCriteriaVersions: readonly {
              sourceId: string;
              criterionStableId: string;
            }[];
          }>;
        })
      | undefined;

    expect(Reader).toBeTypeOf("function");
    const result = await new Reader!(
      { dynamicCriteriaSet: { findMany } },
      scopeReader,
    ).readAuthorizedFacts({
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

    expect(scopeReader.readEmployeeScopes).toHaveBeenCalledWith(
      expect.objectContaining({ subjectEmployeeId: employeeId }),
    );
    expect(result.dynamicCriteriaVersions).toEqual([
      expect.objectContaining({
        sourceId: criterionId,
        criterionStableId: `project:${projectId}:position:1`,
      }),
    ]);
  });
});
