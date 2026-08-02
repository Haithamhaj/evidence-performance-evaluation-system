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
const otherSourceItemId = "00000000-0000-4000-8000-000000000413";
const analysisId = "00000000-0000-4000-8000-000000000404";
const otherAnalysisId = "00000000-0000-4000-8000-000000000414";
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
  readonly persistedInitial: unknown[] = [];
  forcedLookup: ProjectLinkSuggestion | null | undefined;

  async appendInitial(input: any): Promise<ProjectLinkSuggestion> {
    this.persistedInitial.push(input);
    const suggestion = input.record === undefined ? input : materializeSuggestion(input);
    this.suggestions.push(suggestion);
    return suggestion;
  }

  async findOwnedSuggestion(input: {
    employeeId: string;
    suggestionId: string;
  }): Promise<ProjectLinkSuggestion | null> {
    if (this.forcedLookup !== undefined) return this.forcedLookup;
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
  protectedValues: string[] = [],
) {
  return new ProjectLinkSuggestionService({
    persistence,
    projectAuthorization: { canLink },
    protector: {
      seal: async (value: string) => {
        protectedValues.push(value);
        return {
          ciphertext: `sealed:${Buffer.from(value).toString("base64url")}`,
          keyVersion: "context-key-v5",
        };
      },
    },
    clock: () => now,
    idFactory: (kind) => (kind === "correction" ? correctionId : supersedingSuggestionId),
  });
}

async function persistInitial(
  instance: ProjectLinkSuggestionService,
): Promise<ProjectLinkSuggestion> {
  const decision = initialDecision();
  const output = validProjectMatchOutput();
  return instance.recordDecision({
    actor: { userId: employeeId, active: true },
    analysisId,
    sourceItemId,
    decision,
    schemaVersion: "context-project-link.v1",
    promptVersion: "context-project-match.v1",
    routeTrace,
    sourceReferences: [analysisSource],
    suggestionId: initialSuggestionId,
    aiExplanation: {
      label: output.interpretationLabel,
      text: output.explanation,
      sourceReferences: output.sourceReferences,
      uncertainties: output.uncertainties,
    },
  });
}

describe("ProjectLinkSuggestionService", () => {
  it("persists deterministic explanation, governed anchors, and source provenance", async () => {
    const persistence = new InMemorySuggestionPersistence();
    const protectedValues: string[] = [];

    await persistInitial(service(persistence, undefined, protectedValues));

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
        explanation: validProjectMatchOutput().explanation,
        anchors: [explicitMappingAnchor()],
        supersedesSuggestionId: null,
      },
    ]);
    expect(persistence.persistedInitial).toEqual([
      expect.objectContaining({
        record: expect.objectContaining({ id: initialSuggestionId }),
        explanationCiphertext: expect.stringMatching(/^sealed:/u),
        explanationKeyVersion: "context-key-v5",
      }),
    ]);
    expect(JSON.stringify((persistence.persistedInitial[0] as any).record)).not.toContain(
      "AUTO_LINK_EXPLICIT_USER_MAPPING",
    );
    expect(JSON.parse(protectedValues[0]!)).toEqual(validProjectMatchOutput());
  });

  it("reuses a valid initial suggestion for the same stable operation", async () => {
    const persistence = new InMemorySuggestionPersistence();
    const instance = service(persistence);
    const first = await persistInitial(instance);

    await expect(persistInitial(instance)).resolves.toEqual(first);
    expect(persistence.persistedInitial).toHaveLength(1);
  });

  it.each([
    ["id", (value: ProjectLinkSuggestion) => ({ ...value, id: supersedingSuggestionId })],
    ["employee", (value: ProjectLinkSuggestion) => ({ ...value, employeeId: otherEmployeeId })],
    [
      "source item",
      (value: ProjectLinkSuggestion) => ({ ...value, sourceItemId: otherSourceItemId }),
    ],
    ["revision", (value: ProjectLinkSuggestion) => ({ ...value, revision: 2 })],
    [
      "analysis lineage",
      (value: ProjectLinkSuggestion) => ({ ...value, analysisId: otherAnalysisId }),
    ],
    [
      "route lineage",
      (value: ProjectLinkSuggestion) => ({
        ...value,
        routeTrace: { ...value.routeTrace, routeKey: "context.summarize.v1" },
      }),
    ],
    [
      "source provenance",
      (value: ProjectLinkSuggestion) => ({
        ...value,
        sourceReferences: ["connected-source:00000000-0000-4000-8000-000000000499"],
      }),
    ],
  ] as const)("rejects a reused initial suggestion with mismatched %s", async (_name, mutate) => {
    const persistence = new InMemorySuggestionPersistence();
    const instance = service(persistence);
    const valid = await persistInitial(instance);
    persistence.forcedLookup = mutate(valid) as ProjectLinkSuggestion;

    await expect(persistInitial(instance)).rejects.toThrow(
      "Persisted Project link suggestion does not match the stable operation",
    );
  });

  it("validates response-loss lookup against its analysis, source, decision, and route binding", async () => {
    const persistence = new InMemorySuggestionPersistence();
    const instance = service(persistence);
    const valid = await persistInitial(instance);
    persistence.forcedLookup = { ...valid, sourceItemId: otherSourceItemId };

    await expect(
      instance.findRecordedDecision({
        actor: { userId: employeeId, active: true },
        suggestionId: initialSuggestionId,
        analysisId,
        sourceItemId,
        schemaVersion: "context-project-link.v1",
        promptVersion: "context-project-match.v1",
        routeKey: "context.project-match.v1",
        decision: initialDecision(),
        allowedSourceReferences: [analysisSource, explicitMappingAnchor().reference],
      }),
    ).rejects.toThrow("Persisted Project link suggestion does not match the stable operation");
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

function initialDecision() {
  const mapping = explicitMappingAnchor();
  return decideProjectLink([
    {
      projectId: projectA,
      accessible: true,
      anchors: [{ anchor: mapping, current: true }],
    },
  ]);
}

function validProjectMatchOutput() {
  return {
    interpretationLabel: "AI_DRAFT_INTERPRETATION" as const,
    explanation: "The explicit employee mapping identifies Project A.",
    uncertainties: ["No second independent anchor was supplied."],
    sourceReferences: [analysisSource, explicitMappingAnchor().reference],
  };
}

function materializeSuggestion(input: any): ProjectLinkSuggestion {
  const encoded = String(input.explanationCiphertext).replace(/^sealed:/u, "");
  const protectedValue = Buffer.from(encoded, "base64url").toString();
  let explanation = protectedValue;
  try {
    const structured = JSON.parse(protectedValue) as { explanation?: unknown };
    if (typeof structured.explanation === "string") explanation = structured.explanation;
  } catch {
    // Fix-round RED compatibility: the pre-fix payload is a non-JSON formatted string.
  }
  return { ...input.record, explanation };
}
