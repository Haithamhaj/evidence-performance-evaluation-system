import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  actorId,
  controller,
  projectId,
  readyReceipt,
  request,
  requestId,
  service,
  sourceReference,
} from "./progress-contract-drafts.controller.test-fixtures.js";

describe("ProgressContractDraftsController human review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns review fields and public source labels without internal IDs", async () => {
    const result = await controller.get(request, projectId, requestId);

    expect(service.getDraft).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      correlationId: request.correlationId,
      projectId,
      requestId,
    });
    expect(result).toMatchObject({
      requestId,
      state: "ready",
      revision: 1,
      origin: "ai",
      source: { label: "Approved Project document", version: 3 },
      draft: {
        components: [
          {
            position: 1,
            name: "Required quality gate",
            sourceLabels: ["Approved Project document · version 3"],
          },
        ],
      },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(readyReceipt.aiRunTraceId);
    expect(serialized).not.toContain(sourceReference);
    expect(serialized).not.toContain("clientKey");
    expect(serialized).not.toContain("componentMappings");
    expect(serialized).not.toContain("failureCode");
  });
});
