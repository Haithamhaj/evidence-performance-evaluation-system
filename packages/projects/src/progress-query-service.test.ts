import { describe, expect, it, vi } from "vitest";

import { ProgressQueryService } from "./progress-query-service.js";

describe("ProgressQueryService Update scopes", () => {
  it("returns named Projects and only authorized Workstreams", async () => {
    const projectId = crypto.randomUUID();
    const workstreamId = crypto.randomUUID();
    const database = {
      project: {
        findMany: vi.fn(async () => [
          {
            id: projectId,
            name: "Atlas Delivery",
            workstreams: [{ id: workstreamId, name: "API readiness" }],
          },
        ]),
      },
    };
    const service = new ProgressQueryService(database as never);

    await expect(service.listUpdateScopes({ actorId: crypto.randomUUID() })).resolves.toEqual([
      {
        id: projectId,
        name: "Atlas Delivery",
        workstreams: [{ id: workstreamId, name: "API readiness" }],
      },
    ]);
  });
});
