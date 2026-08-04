import { describe, expect, it, vi } from "vitest";

import { DocumentProjectSemanticContextReader } from "./project-semantic-context-reader.js";

describe("DocumentProjectSemanticContextReader", () => {
  it("returns bounded semantic fields only from the current approved Project document", async () => {
    const projectId = crypto.randomUUID();
    const documentId = crypto.randomUUID();
    const documentVersionId = crypto.randomUUID();
    const sourceReference = `document-source:${crypto.randomUUID()}`;
    const loadApprovedVersion = vi.fn(async () => ({
      projectId,
      departmentScopeId: crypto.randomUUID(),
      documentId,
      documentVersionId,
      documentVersion: 3,
      sourceChecksum: "a".repeat(64),
      sourceReferences: [sourceReference],
      quotedSections: [
        {
          reference: sourceReference,
          mediaType: "text/markdown",
          trust: "untrusted" as const,
          text: [
            "# Project Definition and Ownership",
            "Project Atlas modernizes evaluation workflows.",
            "# Objective and Expected Outcome",
            "Employees receive a useful daily workspace.",
            "# Expected Deliverables",
            "- Employee review queue",
            "- Approved release runbook",
            "# Definition of Success",
            "- Product Owner accepts the workflow",
            "# Stakeholders",
            "- product@example.com",
            "# Terminology",
            "- Atlas Delivery",
          ].join("\n"),
        },
      ],
    }));
    const reader = new DocumentProjectSemanticContextReader(
      {
        locateApprovedProjectVersion: async () => ({
          documentVersionId,
          sourceChecksum: "a".repeat(64),
          sourceVersion: 3,
        }),
      } as never,
      { loadApprovedVersion } as never,
    );

    await expect(
      reader.readApprovedProjectSemanticContext({
        actor: { userId: crypto.randomUUID(), active: true },
        projectId,
      }),
    ).resolves.toEqual({
      projectId,
      documentId,
      documentVersionId,
      documentVersion: 3,
      sourceReferences: [sourceReference],
      purpose: ["Project Atlas modernizes evaluation workflows."],
      outcomes: ["Employees receive a useful daily workspace."],
      milestones: [],
      deliverables: ["Employee review queue", "Approved release runbook"],
      terminology: ["Atlas Delivery"],
      stakeholders: ["product@example.com"],
      operationalKpis: [],
      acceptanceConditions: ["Product Owner accepts the workflow"],
      evidenceRequirements: [],
    });
    expect(loadApprovedVersion).toHaveBeenCalledOnce();
  });

  it("returns null without loading content when Documents has no approved current version", async () => {
    const loadApprovedVersion = vi.fn();
    const reader = new DocumentProjectSemanticContextReader(
      { locateApprovedProjectVersion: async () => null } as never,
      { loadApprovedVersion } as never,
    );

    await expect(
      reader.readApprovedProjectSemanticContext({
        actor: { userId: crypto.randomUUID(), active: true },
        projectId: crypto.randomUUID(),
      }),
    ).resolves.toBeNull();
    expect(loadApprovedVersion).not.toHaveBeenCalled();
  });
});
