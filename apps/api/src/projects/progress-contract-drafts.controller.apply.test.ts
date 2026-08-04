import { describe, expect, it } from "vitest";

import {
  actorId,
  contractId,
  controller,
  projectId,
  request,
  requestId,
  service,
} from "./progress-contract-drafts.controller.test-fixtures.js";

describe("ProgressContractDraftsController apply", () => {
  it("applies only an ordinary draft and does not expose component mappings", async () => {
    const result = await controller.applyRevision(request, projectId, requestId, {
      expectedRevision: 1,
      selectedRevision: 1,
      calculationKind: "weighted",
      reason: "Apply the reviewed proposal as a contract draft",
    });

    expect(service.applyRevision).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      correlationId: request.correlationId,
      requestId,
      expectedRevision: 1,
      selectedRevision: 1,
      calculationKind: "weighted",
      reason: "Apply the reviewed proposal as a contract draft",
    });
    expect(result).toEqual({
      requestId,
      selectedRevision: 1,
      contract: { id: contractId, state: "draft", version: 1 },
    });
    expect(JSON.stringify(result)).not.toContain("componentMappings");
  });
});
