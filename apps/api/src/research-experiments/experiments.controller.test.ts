import { AppError } from "@evaluation/contracts";
import { describe, expect, it, vi } from "vitest";

import { ExperimentsController } from "./experiments.controller.js";

const userId = crypto.randomUUID();
const experimentId = crypto.randomUUID();
const researchId = crypto.randomUUID();
const runId = crypto.randomUUID();
const correlationId = crypto.randomUUID();
const request = { principal: { userId, active: true }, correlationId } as never;

describe("ExperimentsController", () => {
  it("lists only Experiments authorized by the Research query boundary", async () => {
    const list = vi.fn(async () => [{ id: experimentId, researchId, state: "READY" }]);
    const controller = new ExperimentsController({} as never, { list } as never);

    await expect(controller.listForResearch(request, researchId)).resolves.toEqual([
      { id: experimentId, researchId, state: "READY" },
    ]);
    expect(list).toHaveBeenCalledWith({
      actor: { userId, active: true },
      researchId,
    });
  });

  it("passes strict method revisions with path identity and correlation", async () => {
    const reviseMethod = vi.fn(async (command) => command);
    const controller = new ExperimentsController({ reviseMethod } as never, {} as never);

    const body = {
      ...method(),
      expectedVersion: 2,
    };
    await controller.reviseMethod(request, experimentId, body);

    expect(reviseMethod).toHaveBeenCalledWith({
      actor: { userId, active: true },
      experimentId,
      correlationId,
      input: body,
    });
  });

  it("rejects malformed path IDs and hidden performance output fields", async () => {
    const transition = vi.fn();
    const controller = new ExperimentsController({ transition } as never, {} as never);

    await expect(controller.transition(request, "bad-id", {})).rejects.toMatchObject({
      code: "RESEARCH_INPUT_INVALID",
      status: 400,
    });
    await expect(
      controller.reviseMethod(request, experimentId, {
        ...method(),
        expectedVersion: 1,
        recommendedRating: 5,
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_INPUT_INVALID", status: 400 });
    expect(transition).not.toHaveBeenCalled();
  });

  it("binds interpretation to the run in the URL and preserves AI-unavailable errors", async () => {
    const unavailable = new AppError(
      "RESEARCH_AI_UNAVAILABLE",
      "errors.research.aiUnavailable",
      503,
    );
    const interpretRun = vi.fn(async () => Promise.reject(unavailable));
    const controller = new ExperimentsController({ interpretRun } as never, {} as never);

    await expect(controller.interpret(request, experimentId, { runId })).rejects.toBe(unavailable);
    expect(interpretRun).toHaveBeenCalledWith({
      actor: { userId, active: true },
      experimentId,
      runId,
      correlationId,
    });
  });

  it("passes validated human conclusions and optional confirmed AI provenance", async () => {
    const conclude = vi.fn(async (command) => command);
    const controller = new ExperimentsController({ conclude } as never, {} as never);
    const methodRunId = crypto.randomUUID();
    const aiRunId = crypto.randomUUID();

    await controller.conclude(request, experimentId, {
      input: {
        expectedVersion: 4,
        outcome: "SUPPORTED",
        summary: "The confirmed run supports the bounded hypothesis.",
        runIds: [methodRunId],
        measureStableIds: ["success_rate"],
        limitations: ["The fixture covers one approved context."],
        confidenceDescription: "Supported for the tested context only.",
        decisionRelevance: "Supports the Project implementation decision.",
        nextStep: "Apply the finding through a confirmed Work Item.",
      },
      aiRunId,
    });

    expect(conclude).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { userId, active: true },
        experimentId,
        correlationId,
        aiRunId,
      }),
    );
  });
});

function method() {
  return {
    question: "Does the method meet the target?",
    baseline: { description: "Current behavior", value: "0", sourceReference: null },
    measures: [
      {
        stableId: "success_rate",
        name: "Success rate",
        kind: "NUMERIC",
        unit: "percent",
        direction: "HIGHER",
        baselineValue: "0",
        baselineReference: null,
        interpretationRule: "Higher is better under the same conditions.",
      },
    ],
    testCases: [
      {
        id: crypto.randomUUID(),
        inputIdentity: "case-1",
        expectedObservation: "Success",
        category: "primary",
        inclusionReason: "Covers the accepted path.",
      },
    ],
    controls: [],
    conditions: ["Same environment"],
    reproducibilityInstructions: "Run the approved fixture and record results.",
    knownRisks: [],
    failureCases: ["No result"],
    sourceReferences: [],
    executionMode: "manual",
  } as const;
}
