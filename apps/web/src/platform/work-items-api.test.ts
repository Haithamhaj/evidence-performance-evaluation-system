import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadWorkItemContext,
  loadWorkItemDependencies,
  replaceWorkItemDependencies,
} from "./work-items-api.js";

const projectId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";

afterEach(() => vi.unstubAllGlobals());

describe("loadWorkItemContext", () => {
  it("keeps only timeline entries explicitly linked to the selected Task", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        items: [
          timelineItem({ id: crypto.randomUUID(), kind: "update", workItemId: itemId }),
          timelineItem({
            id: crypto.randomUUID(),
            kind: "evidence",
            sourceProvenance: "github_automated",
            workItemId: itemId,
          }),
          timelineItem({
            id: crypto.randomUUID(),
            kind: "update",
            workItemId: crypto.randomUUID(),
          }),
        ],
        nextCursor: null,
      }),
    );
    vi.stubGlobal("fetch", fetcher);

    const result = await loadWorkItemContext({ itemId, projectId });

    expect(result.updates).toHaveLength(1);
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]).toMatchObject({ sourceProvenance: "github_automated" });
    expect(fetcher).toHaveBeenCalledWith(
      `/api/daily-work/timeline?projectId=${projectId}&limit=20`,
      { cache: "no-store" },
    );
    expect(JSON.stringify(fetcher.mock.calls)).not.toMatch(/actor|employeeId|userId/u);
  });
});

describe("Work Item dependency gateway", () => {
  it("uses the protected same-origin dependency reader and replacement command", async () => {
    const dependencyId = crypto.randomUUID();
    const response = {
      workItemId: itemId,
      version: 2,
      readiness: "blocked_by_dependency",
      allowedTransitions: ["blocked", "cancelled"],
      dependsOn: [{ id: dependencyId, title: "Complete the engine", status: "in_progress" }],
      blocks: [],
    };
    const fetcher = vi.fn().mockImplementation(async () => Response.json(response));
    vi.stubGlobal("fetch", fetcher);

    await expect(loadWorkItemDependencies(itemId)).resolves.toEqual(response);
    await expect(
      replaceWorkItemDependencies(itemId, {
        dependsOnWorkItemIds: [],
        expectedVersion: 2,
        reason: "Codex removed the resolved dependency.",
      }),
    ).resolves.toEqual(response);

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      `/api/daily-work/work-items/${itemId}/dependencies`,
      { cache: "no-store" },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      `/api/daily-work/work-items/${itemId}/dependencies`,
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(JSON.stringify(fetcher.mock.calls)).not.toMatch(/actor|employeeId|userId/u);
  });
});

function timelineItem(input: {
  id: string;
  kind: "evidence" | "update";
  sourceProvenance?: "employee_code" | "github_automated";
  workItemId: string;
}) {
  return {
    id: input.id,
    kind: input.kind,
    projectId,
    workstreamId: null,
    workItemId: input.workItemId,
    employeeId: null,
    occurredAt: "2026-08-13T09:20:00.000Z",
    title: "Codex Project activity",
    detail: "Source-backed Task context.",
    sourceReferences: [`work-item:${input.workItemId}`],
    sourceProvenance: input.sourceProvenance ?? "employee_code",
    reviewState: input.kind === "update" ? "employee_confirmed" : "automated_project_fact",
    project: { id: projectId, name: "Evaluation System" },
    workstream: null,
    workItem: { id: input.workItemId, title: "Build the Work experience" },
    relatedKpiComponents: [],
    relatedCriteria: [],
    verificationState: input.kind === "evidence" ? "pending" : null,
    decisionOutcome: null,
  };
}
