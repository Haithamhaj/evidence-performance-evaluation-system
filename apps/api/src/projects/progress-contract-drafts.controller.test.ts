import { describe, expect, it } from "vitest";

import {
  actorId,
  controller,
  documentVersionId,
  projectId,
  request,
  service,
} from "./progress-contract-drafts.controller.test-fixtures.js";

describe("ProgressContractDraftsController create", () => {
  it("binds the authenticated actor and strict Project-scoped create input", async () => {
    const body = {
      idempotencyKey: "contract-draft-2026-07-19",
      documentVersionId,
      sourceChecksum: "a".repeat(64),
      locale: "en",
      timezone: "Asia/Riyadh",
      effectiveAt: "2026-07-20T00:00:00Z",
      reason: "Prepare the approved Project document for human review",
    };

    await controller.create(request, projectId, body);

    expect(service.requestDraft).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      correlationId: request.correlationId,
      projectId,
      ...body,
    });
    await expect(
      controller.create(request, projectId, {
        ...body,
        actorId,
        model: "gpt-5.5",
        prompt: "return the private source",
      }),
    ).rejects.toMatchObject({ code: "PROGRESS_CONTRACT_DRAFT_INPUT_INVALID", status: 400 });
    expect(service.requestDraft).toHaveBeenCalledOnce();
  });
});
