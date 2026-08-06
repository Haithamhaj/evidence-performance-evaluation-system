import { AppError } from "@evaluation/contracts";
import { describe, expect, it, vi } from "vitest";

import { SourceReviewsController } from "./source-reviews.controller.js";

const userId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const reviewId = crypto.randomUUID();
const correlationId = crypto.randomUUID();
const request = { principal: { userId, active: true }, correlationId } as never;

function createBody() {
  return {
    scope: { projectId, workstreamId: null, workItemId: null },
    idempotencyKey: crypto.randomUUID(),
    source: { kind: "URL", url: "https://example.com/research" },
  } as const;
}

describe("SourceReviewsController", () => {
  it("parses the public intake contract and propagates actor and correlation identity", async () => {
    const start = vi.fn(async (command) => command);
    const controller = new SourceReviewsController({ start } as never);

    const body = createBody();
    await controller.create(request, body);

    expect(start).toHaveBeenCalledWith({
      actor: { userId, active: true },
      correlationId,
      ...body,
    });
  });

  it("rejects caller-supplied identity and malformed URL identifiers before delegation", async () => {
    const start = vi.fn();
    const getPrivate = vi.fn();
    const controller = new SourceReviewsController({ start, getPrivate } as never);

    await expect(
      controller.create(request, { ...createBody(), actorId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: "RESEARCH_INPUT_INVALID", status: 400 });
    await expect(controller.get(request, "not-a-uuid")).rejects.toMatchObject({
      code: "RESEARCH_INPUT_INVALID",
      status: 400,
    });
    expect(start).not.toHaveBeenCalled();
    expect(getPrivate).not.toHaveBeenCalled();
  });

  it("passes optimistic versions and exact disposition data to the owner-only service", async () => {
    const reanalyze = vi.fn(async (command) => command);
    const confirmDisposition = vi.fn(async (command) => command);
    const controller = new SourceReviewsController({ reanalyze, confirmDisposition } as never);
    const proposalId = crypto.randomUUID();

    await controller.reanalyze(request, reviewId, { expectedVersion: 2 });
    await controller.disposition(request, reviewId, {
      expectedVersion: 3,
      disposition: "CONFIRM",
      reason: "Reviewed the bounded source and proposals.",
      proposalIds: [proposalId],
    });

    expect(reanalyze).toHaveBeenCalledWith({
      actor: { userId, active: true },
      reviewId,
      expectedVersion: 2,
      correlationId,
    });
    expect(confirmDisposition).toHaveBeenCalledWith({
      actor: { userId, active: true },
      reviewId,
      correlationId,
      input: {
        expectedVersion: 3,
        disposition: "CONFIRM",
        reason: "Reviewed the bounded source and proposals.",
        proposalIds: [proposalId],
      },
    });
  });

  it.each([
    ["duplicate", new AppError("RESEARCH_REPLAY_MISMATCH", "errors.research.replayMismatch", 409)],
    ["stale", new AppError("RESEARCH_VERSION_CONFLICT", "errors.research.versionConflict", 409)],
    ["blocked", new AppError("RESEARCH_SOURCE_BLOCKED", "errors.research.sourceBlocked", 422)],
    [
      "AI unavailable",
      new AppError("RESEARCH_AI_UNAVAILABLE", "errors.research.aiUnavailable", 503),
    ],
  ])("preserves the safe domain error for %s", async (_name, expected) => {
    const start = vi.fn(async () => Promise.reject(expected));
    const controller = new SourceReviewsController({ start } as never);
    await expect(controller.create(request, createBody())).rejects.toBe(expected);
  });
});
