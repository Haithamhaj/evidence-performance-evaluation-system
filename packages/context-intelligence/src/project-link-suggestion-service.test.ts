import { describe, expect, it } from "vitest";

import { decideProjectLink } from "./matching-policy.js";
import { ProjectLinkSuggestionService } from "./project-link-suggestion-service.js";

type ProjectAnchor = import("@evaluation/contracts").ProjectAnchor;
type ProjectLinkSuggestion = import("@evaluation/contracts").ProjectLinkSuggestion;
type SourceLinkCorrection = import("@evaluation/contracts").SourceLinkCorrection;
type Persistence = import("./project-link-suggestion-service.js").ProjectLinkSuggestionPersistence;

const employeeId = "00000000-0000-4000-8000-000000000401";
const otherEmployeeId = "00000000-0000-4000-8000-000000000402";
const sourceItemId = "00000000-0000-4000-8000-000000000403";
const analysisId = "00000000-0000-4000-8000-000000000404";
const projectA = "00000000-0000-4000-8000-000000000405";
const projectB = "00000000-0000-4000-8000-000000000406";
const initialSuggestionId = "00000000-0000-4000-8000-000000000407";
const supersedingSuggestionId = "00000000-0000-4000-8000-000000000408";
const correctionId = "00000000-0000-4000-8000-000000000409";
const now = new Date("2026-08-02T12:00:00.000Z");
const analysisSource = `context-analysis:${analysisId}`;

const routeTrace = {
  aiRunId: "00000000-0000-4000-8000-000000000410",
  routeKey: "context.project-match.v1",
  routeConfigId: "00000000-0000-4000-8000-000000000411",
  routeConfigVersion: 1,
} as const;

class InMemorySuggestionPersistence implements Persistence {
  readonly suggestions: ProjectLinkSuggestion[] = [];
  readonly corrections: SourceLinkCorrection[] = [];

  async appendInitial(suggestion: ProjectLinkSuggestion): Promise<ProjectLinkSuggestion> {
    this.suggestions.push(suggestion);
    return suggestion;
  }

  async findOwnedSuggestion(input: {
    employeeId: string;
    suggestionId: string;
  }): Promise<ProjectLinkSuggestion | null> {
    return (
      this.suggestions.find(
        ({ id, employeeId: ownerId }) => id === input.suggestionId && ownerId === input.employeeId,
      ) ?? null
    );
  }

  async appendCorrectionRevision(input: {
    previousSuggestionId: string;
    suggestion: ProjectLinkSuggestion;
    correction: SourceLinkCorrection;
  }): Promise<
    Readonly<{
      suggestion: ProjectLinkSuggestion;
      correction: SourceLinkCorrection;
    }>
  > {
    const previous = this.suggestions.find(({ id }) => id === input.previousSuggestionId);
    if (previous === undefined) throw new Error("Previous suggestion is missing");
    this.suggestions.push(input.suggestion);
    this.corrections.push(input.correction);
    return { suggestion: input.suggestion, correction: input.correction };
  }
}

function explicitMappingAnchor(): ProjectAnchor {
  return {
    kind: "EXPLICIT_USER_MAPPING",
    reference: `source-project-link:${sourceItemId}`,
    conflicts: false,
  };
}

function service(
  persistence: InMemorySuggestionPersistence,
  canLink: (employee: string, project: string, at: Date) => Promise<boolean> = async () => true,
) {
  const suggestionIds = [initialSuggestionId, supersedingSuggestionId];
  return new ProjectLinkSuggestionService({
    persistence,
    projectAuthorization: { canLink },
    clock: () => now,
    idFactory: (kind) =>
      kind === "correction" ? correctionId : (suggestionIds.shift() ?? crypto.randomUUID()),
  });
}

async function persistInitial(
  instance: ProjectLinkSuggestionService,
): Promise<ProjectLinkSuggestion> {
  const mapping = explicitMappingAnchor();
  const decision = decideProjectLink([
    {
      projectId: projectA,
      accessible: true,
      anchors: [{ anchor: mapping, current: true }],
    },
  ]);
  return instance.recordDecision({
    actor: { userId: employeeId, active: true },
    analysisId,
    sourceItemId,
    decision,
    schemaVersion: "context-project-link.v1",
    promptVersion: "context-project-match.v1",
    routeTrace,
    sourceReferences: [analysisSource],
  });
}

describe("ProjectLinkSuggestionService", () => {
  it("persists deterministic explanation, governed anchors, and source provenance", async () => {
    const persistence = new InMemorySuggestionPersistence();

    await persistInitial(service(persistence));

    expect(persistence.suggestions).toEqual([
      {
        id: initialSuggestionId,
        employeeId,
        sourceItemId,
        revision: 1,
        schemaVersion: "context-project-link.v1",
        promptVersion: "context-project-match.v1",
        routeTrace,
        sourceReferences: [analysisSource, `source-project-link:${sourceItemId}`],
        reviewStatus: "PENDING",
        revisionOrigin: "AI",
        correctionReason: null,
        createdAt: now.toISOString(),
        analysisId,
        projectId: projectA,
        decision: "AUTO_LINK",
        explanation: "AUTO_LINK_EXPLICIT_USER_MAPPING",
        anchors: [explicitMappingAnchor()],
        supersedesSuggestionId: null,
      },
    ]);
  });

  it("corrects an auto-link through one atomic correction and superseding revision", async () => {
    const persistence = new InMemorySuggestionPersistence();
    const instance = service(persistence);
    await persistInitial(instance);

    await instance.correct({
      actor: { userId: employeeId, active: true },
      suggestionId: initialSuggestionId,
      correctedProjectId: projectB,
      reason: "The source belongs to the second Project.",
    });

    const correctionReference = `source-link-correction:${correctionId}`;
    expect(persistence.suggestions[1]).toMatchObject({
      id: supersedingSuggestionId,
      employeeId,
      revision: 2,
      revisionOrigin: "EMPLOYEE",
      reviewStatus: "CORRECTED",
      correctionReason: "The source belongs to the second Project.",
      projectId: projectB,
      decision: "AUTO_LINK",
      explanation: "EMPLOYEE_CORRECTED_PROJECT_LINK",
      anchors: [
        {
          kind: "EXPLICIT_USER_MAPPING",
          reference: correctionReference,
          conflicts: false,
        },
      ],
      sourceReferences: [
        analysisSource,
        `source-project-link:${sourceItemId}`,
        correctionReference,
      ],
      supersedesSuggestionId: initialSuggestionId,
    });
    expect(persistence.corrections).toEqual([
      {
        id: correctionId,
        suggestionId: initialSuggestionId,
        employeeId,
        previousProjectId: projectA,
        correctedProjectId: projectB,
        action: "CORRECT",
        reason: "The source belongs to the second Project.",
        sourceReferences: [
          analysisSource,
          `source-project-link:${sourceItemId}`,
          correctionReference,
        ],
        supersedingSuggestionId,
        createdAt: now.toISOString(),
      },
    ]);
  });

  it("rejects an auto-link through one atomic correction and NO_MATCH revision", async () => {
    const persistence = new InMemorySuggestionPersistence();
    const instance = service(persistence);
    await persistInitial(instance);

    await instance.reject({
      actor: { userId: employeeId, active: true },
      suggestionId: initialSuggestionId,
      reason: "This source is unrelated to any Project.",
    });

    expect(persistence.suggestions[1]).toMatchObject({
      id: supersedingSuggestionId,
      revision: 2,
      revisionOrigin: "EMPLOYEE",
      reviewStatus: "REJECTED",
      projectId: null,
      decision: "NO_MATCH",
      explanation: "EMPLOYEE_REJECTED_PROJECT_LINK",
      anchors: [],
      supersedesSuggestionId: initialSuggestionId,
    });
    expect(persistence.corrections[0]).toMatchObject({
      id: correctionId,
      suggestionId: initialSuggestionId,
      employeeId,
      previousProjectId: projectA,
      correctedProjectId: null,
      action: "REJECT",
      supersedingSuggestionId,
    });
  });

  it("does not append a correction when Project authorization is no longer available", async () => {
    const persistence = new InMemorySuggestionPersistence();
    const instance = service(persistence, async (_employee, project) => project !== projectB);
    await persistInitial(instance);

    await expect(
      instance.correct({
        actor: { userId: employeeId, active: true },
        suggestionId: initialSuggestionId,
        correctedProjectId: projectB,
        reason: "Move to an inaccessible Project.",
      }),
    ).rejects.toThrow("Project link is not authorized");
    expect(persistence.suggestions).toHaveLength(1);
    expect(persistence.corrections).toHaveLength(0);
  });

  it("does not expose or revise another employee's suggestion", async () => {
    const persistence = new InMemorySuggestionPersistence();
    const instance = service(persistence);
    await persistInitial(instance);

    await expect(
      instance.reject({
        actor: { userId: otherEmployeeId, active: true },
        suggestionId: initialSuggestionId,
        reason: "Attempted cross-employee rejection.",
      }),
    ).rejects.toThrow("Project link suggestion not found");
    expect(persistence.suggestions).toHaveLength(1);
    expect(persistence.corrections).toHaveLength(0);
  });
});
