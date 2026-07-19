import { describe, expect, it } from "vitest";

import {
  OfficialProgressResultSchema,
  ProgressContractAiDraftOutputSchema,
  ProgressContractDraftSchema,
  ProgressContractSchema,
} from "./progress-contracts.js";

const projectId = "00000000-0000-4000-8000-000000000201";
const documentId = "00000000-0000-4000-8000-000000000202";
const documentVersionId = "00000000-0000-4000-8000-000000000203";
const componentId = "00000000-0000-4000-8000-000000000204";

const component = {
  id: componentId,
  kind: "kpi" as const,
  name: "زمن إغلاق التوثيق",
  description: "المدة من قبول النتيجة إلى اكتمال الوثيقة.",
  weight: 100,
  baseline: 10,
  target: 3,
  unit: "days",
  direction: "decrease" as const,
  acceptanceConditions: ["اعتماد وثيقة الإغلاق"],
  requiredEvidence: ["document"],
  confirmationMode: "measured" as const,
};

const aiDraftOutput = {
  components: [
    {
      clientKey: "approved-release",
      kind: "deliverable" as const,
      name: "Approved release",
      description: "Publish the approved release from the documented scope.",
      weight: 100,
      baseline: null,
      target: null,
      unit: null,
      direction: null,
      acceptanceConditions: ["The release is approved by the Project owner"],
      requiredEvidence: ["Approved release record"],
      confirmationMode: "human_confirmed" as const,
      proposedSourceMappings: [],
      sourceReferences: ["document-section:release"],
    },
  ],
  ambiguities: [],
  clarificationQuestions: [],
};

function activeContract() {
  return {
    id: "00000000-0000-4000-8000-000000000206",
    contractVersion: 1,
    version: 3,
    state: "active",
    scopeKind: "project",
    projectId,
    workstreamId: null,
    sourceDocumentId: documentId,
    sourceDocumentVersionId: documentVersionId,
    sourceDocumentVersion: 2,
    calculationKind: "weighted",
    calculationSchemaVersion: "1.0.0",
    effectiveAt: "2026-07-18T00:00:00Z",
    approvedAt: "2026-07-18T01:00:00Z",
    ownerId: "00000000-0000-4000-8000-000000000207",
    approverId: "00000000-0000-4000-8000-000000000208",
    previousContractId: null,
    components: [component],
  } as const;
}

describe("progress contract contracts", () => {
  it("accepts a source-cited AI draft without direct overall progress", () => {
    expect(ProgressContractAiDraftOutputSchema.parse(aiDraftOutput)).toEqual(aiDraftOutput);
  });

  it.each(["rating", "recommendedRating", "productivityScore", "employeeRank", "overallPercent"])(
    "rejects forbidden AI draft field %s",
    (field) => {
      expect(() =>
        ProgressContractAiDraftOutputSchema.parse({
          ...aiDraftOutput,
          [field]: 90,
        }),
      ).toThrow();
    },
  );

  it("requires measurable KPI metadata and source references", () => {
    expect(() =>
      ProgressContractAiDraftOutputSchema.parse({
        ...aiDraftOutput,
        components: [
          {
            clientKey: "quality-gate",
            kind: "operational_kpi",
            name: "Required checks",
            description: "Approved required checks pass",
            weight: null,
            baseline: null,
            target: 1,
            unit: "boolean",
            direction: "increase",
            acceptanceConditions: ["Every allowlisted required check is successful"],
            requiredEvidence: ["Verified GitHub check suite"],
            confirmationMode: "deterministic",
            proposedSourceMappings: [],
            sourceReferences: [],
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects duplicate AI draft client keys and partial weights", () => {
    expect(() =>
      ProgressContractAiDraftOutputSchema.parse({
        ...aiDraftOutput,
        components: [
          aiDraftOutput.components[0],
          {
            ...aiDraftOutput.components[0],
            name: "Approved release confirmation",
            weight: null,
          },
        ],
      }),
    ).toThrow();
  });

  it("requires weighted rules to total exactly 100", () => {
    expect(() =>
      ProgressContractDraftSchema.parse({
        scopeKind: "project",
        projectId,
        workstreamId: null,
        sourceDocumentId: documentId,
        sourceDocumentVersionId: documentVersionId,
        sourceDocumentVersion: 2,
        calculationKind: "weighted",
        calculationSchemaVersion: "1.0.0",
        effectiveAt: "2026-07-18T00:00:00Z",
        components: [
          { ...component, id: componentId, weight: 60 },
          {
            ...component,
            id: "00000000-0000-4000-8000-000000000205",
            weight: 30,
          },
        ],
      }),
    ).toThrow();
  });

  it("accepts a source-bound measurable draft", () => {
    expect(
      ProgressContractDraftSchema.parse({
        scopeKind: "project",
        projectId,
        workstreamId: null,
        sourceDocumentId: documentId,
        sourceDocumentVersionId: documentVersionId,
        sourceDocumentVersion: 2,
        calculationKind: "weighted",
        calculationSchemaVersion: "1.0.0",
        effectiveAt: "2026-07-18T00:00:00Z",
        components: [component],
      }),
    ).toMatchObject({ projectId, sourceDocumentVersion: 2 });
  });

  it("rejects direct percentage and rating concepts", () => {
    expect(() =>
      ProgressContractSchema.parse({
        ...activeContract(),
        manualPercent: 80,
      }),
    ).toThrow();

    expect(() =>
      OfficialProgressResultSchema.parse({
        state: "accepted",
        snapshotId: "00000000-0000-4000-8000-000000000209",
        previousPercent: 40,
        percent: 50,
        suggestedRating: 4,
      }),
    ).toThrow();
  });

  it("keeps immutable contract lineage separate from the mutable state version", () => {
    expect(ProgressContractSchema.parse(activeContract())).toMatchObject({
      contractVersion: 1,
      version: 3,
    });
    expect(
      ProgressContractSchema.safeParse({
        ...activeContract(),
        contractVersion: undefined,
      }).success,
    ).toBe(false);
  });

  it("keeps the previous official percentage when information is missing", () => {
    expect(
      OfficialProgressResultSchema.parse({
        state: "awaiting_information",
        previousPercent: 40,
        missing: ["kpi.currentValue"],
      }),
    ).toEqual({
      state: "awaiting_information",
      previousPercent: 40,
      missing: ["kpi.currentValue"],
    });
  });
});
