import { describe, expect, it } from "vitest";

import { ProjectSemanticContextReader } from "./project-semantic-context-reader.js";

const employeeId = "00000000-0000-4000-8000-000000000301";
const projectId = "00000000-0000-4000-8000-000000000302";
const documentId = "00000000-0000-4000-8000-000000000303";
const documentVersionId = "00000000-0000-4000-8000-000000000304";

describe("ProjectSemanticContextReader Documents-boundary integration", () => {
  it("returns only the approved Project semantic fields and version provenance", async () => {
    const reader = new ProjectSemanticContextReader({
      async readApprovedProjectSemanticContext() {
        return {
          projectId,
          documentId,
          documentVersionId,
          documentVersion: 4,
          sourceReferences: [`document-version:${documentVersionId}`],
          purpose: ["Reduce the effort required to organize daily work."],
          outcomes: ["A calm, source-aware daily workspace."],
          milestones: ["Context Intelligence checkpoint."],
          deliverables: ["Explainable Project suggestions."],
          terminology: ["Project anchor"],
          stakeholders: ["AI Department employees"],
          operationalKpis: ["Correction takes under ten seconds."],
          acceptanceConditions: ["Model confidence alone never auto-links."],
          evidenceRequirements: ["Persist source-backed reasons."],
          privateNotes: ["This field must not cross the Documents boundary adapter."],
        };
      },
    });

    await expect(
      reader.read({ actor: { userId: employeeId, active: true }, projectId }),
    ).resolves.toEqual({
      projectId,
      documentId,
      documentVersionId,
      documentVersion: 4,
      sourceReferences: [`document-version:${documentVersionId}`],
      purpose: ["Reduce the effort required to organize daily work."],
      outcomes: ["A calm, source-aware daily workspace."],
      milestones: ["Context Intelligence checkpoint."],
      deliverables: ["Explainable Project suggestions."],
      terminology: ["Project anchor"],
      stakeholders: ["AI Department employees"],
      operationalKpis: ["Correction takes under ten seconds."],
      acceptanceConditions: ["Model confidence alone never auto-links."],
      evidenceRequirements: ["Persist source-backed reasons."],
    });
  });

  it("returns no semantic context when Documents has no approved version", async () => {
    const reader = new ProjectSemanticContextReader({
      async readApprovedProjectSemanticContext() {
        return null;
      },
    });

    await expect(
      reader.read({ actor: { userId: employeeId, active: true }, projectId }),
    ).resolves.toBeNull();
  });

  it("fails closed when the approved Documents response belongs to another Project", async () => {
    const reader = new ProjectSemanticContextReader({
      async readApprovedProjectSemanticContext() {
        return {
          projectId: "00000000-0000-4000-8000-000000000399",
          documentId,
          documentVersionId,
          documentVersion: 4,
          sourceReferences: [`document-version:${documentVersionId}`],
          purpose: [],
          outcomes: [],
          milestones: [],
          deliverables: [],
          terminology: [],
          stakeholders: [],
          operationalKpis: [],
          acceptanceConditions: [],
          evidenceRequirements: [],
        };
      },
    });

    await expect(
      reader.read({ actor: { userId: employeeId, active: true }, projectId }),
    ).rejects.toThrow("Approved Project document scope mismatch");
  });
});
