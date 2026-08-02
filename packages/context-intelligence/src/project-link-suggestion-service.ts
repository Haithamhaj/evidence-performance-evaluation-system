import { ProjectLinkSuggestionSchema, SourceLinkCorrectionSchema } from "@evaluation/contracts";

type LinkDecision = import("./matching-policy.js").LinkDecision;
type ProjectAnchor = import("@evaluation/contracts").ProjectAnchor;
type ProjectLinkSuggestion = import("@evaluation/contracts").ProjectLinkSuggestion;
type PersistedProjectLinkSuggestion = Omit<ProjectLinkSuggestion, "explanation">;
type SourceLinkCorrection = import("@evaluation/contracts").SourceLinkCorrection;
type RouteTrace = import("@evaluation/contracts").ContextIntelligenceRouteTrace;
type Actor = Readonly<{ userId: string; active: boolean }>;

export interface ProjectLinkSuggestionPersistence {
  appendInitial(
    input: Readonly<{
      record: PersistedProjectLinkSuggestion;
      explanationCiphertext: string;
      explanationKeyVersion: string;
    }>,
  ): Promise<ProjectLinkSuggestion>;
  findOwnedSuggestion(
    input: Readonly<{
      employeeId: string;
      suggestionId: string;
    }>,
  ): Promise<ProjectLinkSuggestion | null>;
  appendCorrectionRevision(
    input: Readonly<{
      previousSuggestionId: string;
      suggestion: ProjectLinkSuggestion;
      correction: SourceLinkCorrection;
    }>,
  ): Promise<
    Readonly<{
      suggestion: ProjectLinkSuggestion;
      correction: SourceLinkCorrection;
    }>
  >;
}

export interface ProjectLinkAuthorizationPublicReader {
  canLink(employeeId: string, projectId: string, at: Date): Promise<boolean>;
}

type Dependencies = Readonly<{
  persistence: ProjectLinkSuggestionPersistence;
  projectAuthorization: ProjectLinkAuthorizationPublicReader;
  protector: Readonly<{
    seal(value: string): Promise<Readonly<{ ciphertext: string; keyVersion: string }>>;
  }>;
  clock?: () => Date;
  idFactory?: (kind: "suggestion" | "correction") => string;
}>;

type RecordDecisionCommand = Readonly<{
  actor: Actor;
  analysisId: string;
  sourceItemId: string;
  decision: LinkDecision;
  schemaVersion: string;
  promptVersion: string;
  routeTrace: RouteTrace;
  sourceReferences: readonly string[];
  suggestionId: string;
  aiExplanation?: Readonly<{
    label: "AI_DRAFT_INTERPRETATION";
    text: string;
    sourceReferences: readonly string[];
    uncertainties: readonly string[];
  }>;
}>;

export class ProjectLinkSuggestionService {
  private readonly persistence: ProjectLinkSuggestionPersistence;
  private readonly projectAuthorization: ProjectLinkAuthorizationPublicReader;
  private readonly protector: Dependencies["protector"];
  private readonly clock: () => Date;
  private readonly idFactory: (kind: "suggestion" | "correction") => string;

  constructor(dependencies: Dependencies) {
    this.persistence = dependencies.persistence;
    this.projectAuthorization = dependencies.projectAuthorization;
    this.protector = dependencies.protector;
    this.clock = dependencies.clock ?? (() => new Date());
    this.idFactory = dependencies.idFactory ?? (() => crypto.randomUUID());
  }

  async recordDecision(command: RecordDecisionCommand): Promise<ProjectLinkSuggestion> {
    assertActive(command.actor);
    const existing = await this.persistence.findOwnedSuggestion({
      employeeId: command.actor.userId,
      suggestionId: command.suggestionId,
    });
    if (existing !== null) return existing;
    const createdAt = this.clock();
    if (
      command.decision.kind === "AUTO_LINK" &&
      !(await this.projectAuthorization.canLink(
        command.actor.userId,
        command.decision.projectId,
        createdAt,
      ))
    ) {
      throw unauthorizedProject();
    }

    const anchors = decisionAnchors(command.decision);
    const suggestion = ProjectLinkSuggestionSchema.parse({
      id: command.suggestionId,
      employeeId: command.actor.userId,
      sourceItemId: command.sourceItemId,
      revision: 1,
      schemaVersion: command.schemaVersion,
      promptVersion: command.promptVersion,
      routeTrace: command.routeTrace,
      sourceReferences: unique([
        ...command.sourceReferences,
        ...(command.aiExplanation?.sourceReferences ?? []),
        ...anchors.map(({ reference }) => reference),
      ]),
      reviewStatus: "PENDING",
      revisionOrigin: "AI",
      correctionReason: null,
      createdAt: createdAt.toISOString(),
      analysisId: command.analysisId,
      projectId: decisionProjectId(command.decision),
      decision: command.decision.kind,
      explanation: combinedExplanation(command.decision, command.aiExplanation),
      anchors,
      supersedesSuggestionId: null,
    });
    const sealed = await this.protector.seal(suggestion.explanation);
    const record: PersistedProjectLinkSuggestion = {
      id: suggestion.id,
      employeeId: suggestion.employeeId,
      sourceItemId: suggestion.sourceItemId,
      revision: suggestion.revision,
      schemaVersion: suggestion.schemaVersion,
      promptVersion: suggestion.promptVersion,
      routeTrace: suggestion.routeTrace,
      sourceReferences: suggestion.sourceReferences,
      reviewStatus: suggestion.reviewStatus,
      revisionOrigin: suggestion.revisionOrigin,
      correctionReason: suggestion.correctionReason,
      createdAt: suggestion.createdAt,
      analysisId: suggestion.analysisId,
      projectId: suggestion.projectId,
      decision: suggestion.decision,
      anchors: suggestion.anchors,
      supersedesSuggestionId: suggestion.supersedesSuggestionId,
    };
    const persisted = ProjectLinkSuggestionSchema.parse(
      await this.persistence.appendInitial({
        record,
        explanationCiphertext: sealed.ciphertext,
        explanationKeyVersion: sealed.keyVersion,
      }),
    );
    if (
      persisted.id !== suggestion.id ||
      persisted.employeeId !== suggestion.employeeId ||
      persisted.sourceItemId !== suggestion.sourceItemId ||
      persisted.revision !== 1
    ) {
      throw new Error("Persisted Project link suggestion does not match the stable operation");
    }
    return persisted;
  }

  async findRecordedDecision(input: Readonly<{ actor: Actor; suggestionId: string }>) {
    assertActive(input.actor);
    return this.persistence.findOwnedSuggestion({
      employeeId: input.actor.userId,
      suggestionId: input.suggestionId,
    });
  }

  async correct(
    command: Readonly<{
      actor: Actor;
      suggestionId: string;
      correctedProjectId: string;
      reason: string;
    }>,
  ): Promise<
    Readonly<{
      suggestion: ProjectLinkSuggestion;
      correction: SourceLinkCorrection;
    }>
  > {
    assertActive(command.actor);
    const createdAt = this.clock();
    const previous = await this.loadOwned(command.actor.userId, command.suggestionId);
    if (
      !(await this.projectAuthorization.canLink(
        command.actor.userId,
        command.correctedProjectId,
        createdAt,
      ))
    ) {
      throw unauthorizedProject();
    }
    return this.appendEmployeeRevision({
      previous,
      correctedProjectId: command.correctedProjectId,
      reason: command.reason,
      action: "CORRECT",
      createdAt,
    });
  }

  async reject(
    command: Readonly<{
      actor: Actor;
      suggestionId: string;
      reason: string;
    }>,
  ): Promise<
    Readonly<{
      suggestion: ProjectLinkSuggestion;
      correction: SourceLinkCorrection;
    }>
  > {
    assertActive(command.actor);
    const previous = await this.loadOwned(command.actor.userId, command.suggestionId);
    return this.appendEmployeeRevision({
      previous,
      correctedProjectId: null,
      reason: command.reason,
      action: "REJECT",
      createdAt: this.clock(),
    });
  }

  private async loadOwned(
    employeeId: string,
    suggestionId: string,
  ): Promise<ProjectLinkSuggestion> {
    const suggestion = await this.persistence.findOwnedSuggestion({ employeeId, suggestionId });
    if (suggestion === null) throw new Error("Project link suggestion not found");
    return suggestion;
  }

  private appendEmployeeRevision(
    input: Readonly<{
      previous: ProjectLinkSuggestion;
      correctedProjectId: string | null;
      reason: string;
      action: "CORRECT" | "REJECT";
      createdAt: Date;
    }>,
  ): Promise<
    Readonly<{
      suggestion: ProjectLinkSuggestion;
      correction: SourceLinkCorrection;
    }>
  > {
    const correctionId = this.idFactory("correction");
    const suggestionId = this.idFactory("suggestion");
    const correctionReference = `source-link-correction:${correctionId}`;
    const sourceReferences = unique([...input.previous.sourceReferences, correctionReference]);
    const corrected = input.action === "CORRECT";
    const suggestion = ProjectLinkSuggestionSchema.parse({
      ...input.previous,
      id: suggestionId,
      revision: input.previous.revision + 1,
      sourceReferences,
      reviewStatus: corrected ? "CORRECTED" : "REJECTED",
      revisionOrigin: "EMPLOYEE",
      correctionReason: input.reason,
      createdAt: input.createdAt.toISOString(),
      projectId: input.correctedProjectId,
      decision: corrected ? "AUTO_LINK" : "NO_MATCH",
      explanation: corrected ? "EMPLOYEE_CORRECTED_PROJECT_LINK" : "EMPLOYEE_REJECTED_PROJECT_LINK",
      anchors: corrected
        ? [
            {
              kind: "EXPLICIT_USER_MAPPING",
              reference: correctionReference,
              conflicts: false,
            },
          ]
        : [],
      supersedesSuggestionId: input.previous.id,
    });
    const correction = SourceLinkCorrectionSchema.parse({
      id: correctionId,
      suggestionId: input.previous.id,
      employeeId: input.previous.employeeId,
      previousProjectId: input.previous.projectId,
      correctedProjectId: input.correctedProjectId,
      action: input.action,
      reason: input.reason,
      sourceReferences,
      supersedingSuggestionId: suggestion.id,
      createdAt: input.createdAt.toISOString(),
    });
    return this.persistence.appendCorrectionRevision({
      previousSuggestionId: input.previous.id,
      suggestion,
      correction,
    });
  }
}

function decisionProjectId(decision: LinkDecision): string | null {
  if (decision.kind === "AUTO_LINK") return decision.projectId;
  if (decision.kind === "REVIEW" && decision.candidates.length === 1) {
    return decision.candidates[0]!.projectId;
  }
  return null;
}

function decisionAnchors(decision: LinkDecision): ProjectAnchor[] {
  if (decision.kind === "AUTO_LINK") return uniqueAnchors(decision.anchors);
  if (decision.kind === "REVIEW") {
    return uniqueAnchors(
      decision.candidates.flatMap(({ anchors }) => anchors.map(({ anchor }) => anchor)),
    );
  }
  return [];
}

function decisionExplanation(decision: LinkDecision): string {
  if (decision.kind !== "AUTO_LINK") return decision.reasons.join(";");
  return decision.anchors.some(({ kind }) => kind === "EXPLICIT_USER_MAPPING")
    ? "AUTO_LINK_EXPLICIT_USER_MAPPING"
    : "AUTO_LINK_TWO_INDEPENDENT_ANCHORS";
}

function combinedExplanation(
  decision: LinkDecision,
  explanation: RecordDecisionCommand["aiExplanation"],
): string {
  const governedReason = decisionExplanation(decision);
  if (explanation === undefined) return governedReason;
  const uncertainties = explanation.uncertainties.map((value) => `- ${value}`).join("\n");
  return [
    governedReason,
    `${explanation.label}: ${explanation.text}`,
    ...(uncertainties.length === 0 ? [] : [`UNCERTAINTIES:\n${uncertainties}`]),
  ].join("\n");
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function uniqueAnchors(anchors: readonly ProjectAnchor[]): ProjectAnchor[] {
  const seen = new Set<string>();
  return anchors.filter((anchor) => {
    const identity = `${anchor.kind}:${anchor.reference}:${String(anchor.conflicts)}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function assertActive(actor: Actor): void {
  if (!actor.active) throw new Error("Active employee required");
}

function unauthorizedProject(): Error {
  return new Error("Project link is not authorized");
}
