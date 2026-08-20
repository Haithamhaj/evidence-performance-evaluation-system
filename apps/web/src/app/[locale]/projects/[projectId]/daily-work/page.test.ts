import { describe, expect, it } from "vitest";

import { ProjectProgressViewSchema } from "./project-progress-view-schema.js";

describe("ProjectProgressViewSchema", () => {
  it("keeps the progress view usable when the API adds known adjacent projection fields", () => {
    const core = {
      project: {
        id: "c2ab037e-e945-4ed9-a6cd-756099e2b066",
        name: "Evaluation System",
        description: "Internal product Project",
        status: "active" as const,
      },
      contract: null,
      progress: { state: "awaiting_information" as const },
      pulse: {
        officialProgress: null,
        previousOfficialProgress: null,
        sourceCoverage: "INSUFFICIENT" as const,
        milestoneStates: [],
        nextRequiredEvidence: [],
        explanation: [],
      },
      contractDraftSourceRequest: null,
    };

    expect(
      ProjectProgressViewSchema.parse({
        ...core,
        contractProposal: {
          state: "applied",
          revision: 3,
          origin: "human",
          sourceDocumentVersion: 7,
        },
        pendingChange: null,
      }),
    ).toEqual(core);
  });
});
