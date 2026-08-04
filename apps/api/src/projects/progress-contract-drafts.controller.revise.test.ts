import { describe, expect, it } from "vitest";

import {
  actorId,
  controller,
  projectId,
  request,
  requestId,
  service,
  sourceReference,
} from "./progress-contract-drafts.controller.test-fixtures.js";

describe("ProgressContractDraftsController revision", () => {
  it("merges editable values into a new revision without accepting source lineage", async () => {
    const revisedContent = {
      components: [
        {
          position: 1,
          kind: "operational_kpi",
          name: "Accepted quality scenarios",
          description: "All approved scenarios pass in CI.",
          weight: 100,
          baseline: 0,
          target: 14,
          unit: "scenarios",
          direction: "increase",
          acceptanceConditions: ["Product Owner accepts the result"],
          requiredEvidence: ["Acceptance record", "CI summary"],
          confirmationMode: "human_confirmed",
        },
      ],
      ambiguities: [],
      clarificationQuestions: [],
    };

    await controller.revise(request, projectId, requestId, {
      expectedRevision: 1,
      reason: "Clarified the approved acceptance set",
      content: revisedContent,
    });

    expect(service.reviseDraft).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      correlationId: request.correlationId,
      requestId,
      expectedRevision: 1,
      reason: "Clarified the approved acceptance set",
      content: {
        ...revisedContent,
        components: [
          expect.objectContaining({
            acceptanceConditions: revisedContent.components[0]!.acceptanceConditions,
            baseline: revisedContent.components[0]!.baseline,
            confirmationMode: revisedContent.components[0]!.confirmationMode,
            description: revisedContent.components[0]!.description,
            direction: revisedContent.components[0]!.direction,
            kind: revisedContent.components[0]!.kind,
            name: revisedContent.components[0]!.name,
            requiredEvidence: revisedContent.components[0]!.requiredEvidence,
            target: revisedContent.components[0]!.target,
            unit: revisedContent.components[0]!.unit,
            weight: revisedContent.components[0]!.weight,
            clientKey: "quality-gate",
            sourceReferences: [sourceReference],
            proposedSourceMappings: [],
          }),
        ],
      },
    });
  });
});
