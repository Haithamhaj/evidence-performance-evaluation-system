import { AppError } from "@evaluation/contracts";
import { describe, expect, it, vi } from "vitest";

import { ResearchRecordsController } from "./research-records.controller.js";

const userId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const workstreamId = crypto.randomUUID();
const researchId = crypto.randomUUID();
const correlationId = crypto.randomUUID();
const request = { principal: { userId, active: true }, correlationId } as never;

function createBody() {
  return {
    scope: { projectId, workstreamId, workItemId: null },
    idempotencyKey: crypto.randomUUID(),
    problemStatement: "We need a reproducible retrieval decision.",
    context: "The approved Project context requires a bounded comparison.",
    question: "Which approach satisfies the approved constraints?",
    objective: "Reduce uncertainty before implementation.",
    hypothesis: { kind: "TESTABLE", statement: "Approach A meets the acceptance conditions." },
    assumptions: ["The source snapshot is current."],
    constraints: ["No source code execution."],
    knownUncertainty: ["Representative load remains unknown."],
    alternatives: ["Approach B"],
    decisionQuestion: "Should the Project adopt approach A?",
    sourceReferences: [],
    executionMode: "manual",
  } as const;
}

describe("ResearchRecordsController", () => {
  it("creates Research only from the authenticated actor and strict public contract", async () => {
    const create = vi.fn(async (command) => command);
    const controller = new ResearchRecordsController(
      { create } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const body = createBody();
    await controller.create(request, body);

    expect(create).toHaveBeenCalledWith({
      actor: { userId, active: true },
      correlationId,
      input: body,
    });
  });

  it("lists one authorized Project and applies the optional Workstream view filter", async () => {
    const list = vi.fn(async () => [
      { id: researchId, workstreamId },
      { id: crypto.randomUUID(), workstreamId: null },
    ]);
    const controller = new ResearchRecordsController(
      {} as never,
      { list } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(controller.list(request, { projectId, workstreamId })).resolves.toEqual([
      { id: researchId, workstreamId },
    ]);
    expect(list).toHaveBeenCalledWith({ actor: { userId, active: true }, projectId });
  });

  it("rejects malformed IDs, scoring fields, and cross-Project Experiment inputs", async () => {
    const create = vi.fn();
    const createExperiment = vi.fn();
    const controller = new ResearchRecordsController(
      { create } as never,
      {} as never,
      { create: createExperiment } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(controller.get(request, "bad-id")).rejects.toMatchObject({
      code: "RESEARCH_INPUT_INVALID",
      status: 400,
    });
    await expect(
      controller.create(request, { ...createBody(), productivityScore: 100 }),
    ).rejects.toMatchObject({ code: "RESEARCH_INPUT_INVALID", status: 400 });
    await expect(
      controller.createExperiment(request, researchId, {
        input: {
          researchId: crypto.randomUUID(),
          scope: { projectId, workstreamId, workItemId: null },
          idempotencyKey: crypto.randomUUID(),
          title: "Cross-record experiment",
        },
        method: validMethod(),
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_INPUT_INVALID", status: 400 });
    expect(create).not.toHaveBeenCalled();
    expect(createExperiment).not.toHaveBeenCalled();
  });

  it("propagates stale and unrelated-scope domain denials without leaking alternate data", async () => {
    const denied = new AppError("RESEARCH_FORBIDDEN", "errors.research.forbidden", 403);
    const stale = new AppError("RESEARCH_VERSION_CONFLICT", "errors.research.versionConflict", 409);
    const query = { read: vi.fn(async () => Promise.reject(denied)) };
    const service = { revise: vi.fn(async () => Promise.reject(stale)) };
    const controller = new ResearchRecordsController(
      service as never,
      query as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(controller.get(request, researchId)).rejects.toBe(denied);
    const revision: Record<string, unknown> = { ...createBody() };
    delete revision.scope;
    delete revision.idempotencyKey;
    await expect(
      controller.revise(request, researchId, { ...revision, expectedVersion: 1 }),
    ).rejects.toBe(stale);
  });
});

function validMethod() {
  const testCaseId = crypto.randomUUID();
  return {
    question: "Does the bounded method satisfy the target?",
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
        id: testCaseId,
        inputIdentity: "case-1",
        expectedObservation: "The operation succeeds.",
        category: "happy-path",
        inclusionReason: "Validates the primary path.",
      },
    ],
    controls: [],
    conditions: ["Same approved source snapshot"],
    reproducibilityInstructions: "Run the bounded fixture once and record the observation.",
    knownRisks: [],
    failureCases: ["The operation does not complete."],
    sourceReferences: [],
    executionMode: "manual",
  } as const;
}
