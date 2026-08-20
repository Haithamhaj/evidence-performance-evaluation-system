import type { EvaluationFactView } from "@evaluation/contracts";

export type EvaluationRating = 1 | 2 | 3 | 4 | 5;

export type EvaluationAnchor = Readonly<{ rating: EvaluationRating; text: string }>;

export type EvaluationCriterion = Readonly<{
  id: string;
  stableCriterionId: string;
  kind: "FIXED_CRITERION" | "PROJECT_CONTRIBUTION";
  sectionStableId: string;
  sectionWeight: number;
  criterionWeight: number | null;
  displayOrder: number;
  protectedGlobal: boolean;
  mandatory: boolean;
  locales: ReadonlyArray<
    Readonly<{
      locale: "ar" | "en";
      title: string;
      definition: string;
      anchors: ReadonlyArray<EvaluationAnchor>;
      examples: unknown;
      evidenceGuidance: unknown;
    }>
  >;
}>;

export type EvaluationEntry = Readonly<{
  criterionId: string;
  rating: EvaluationRating;
  justification: string;
  sourceReferences: ReadonlyArray<string>;
  directObservationBasis: string | null;
}>;

export type EvaluationJourney = Readonly<{
  schemaVersion: 1;
  audience: "self" | "assigned_manager";
  cycle: Readonly<{
    id: string;
    type: "CALIBRATION_NON_BASELINE" | "STANDARD";
    state: string;
    visibilityMode: "identified";
    startsAt: string;
    endsAt: string;
    version: number;
  }>;
  assignment: Readonly<{
    id: string;
    employeeId: string;
    managerId: string;
    version: number;
  }>;
  templateSnapshot: Readonly<{
    id: string;
    versionNumber: number;
    schemaVersion: number;
    weightPolicy: unknown;
    evaluationPolicy: unknown;
    items: ReadonlyArray<EvaluationCriterion>;
  }> | null;
  factViewFirst: Readonly<{
    responsibilityWindows: ReadonlyArray<unknown>;
    workFacts: ReadonlyArray<unknown>;
    researchFacts: ReadonlyArray<unknown>;
    sourceCoverageNotes: ReadonlyArray<unknown>;
  }>;
  factView: EvaluationFactView;
  drafts: ReadonlyArray<
    Readonly<{
      kind: "SELF" | "MANAGER_INITIAL";
      version: number;
      entries: ReadonlyArray<EvaluationEntry>;
      updatedAt: string;
    }>
  >;
  submissions: ReadonlyArray<
    Readonly<{
      kind: "SELF" | "MANAGER_INITIAL";
      submittedAt: string;
      entries: ReadonlyArray<EvaluationEntry>;
    }>
  >;
  comparison: unknown | null;
  discussion: ReadonlyArray<unknown>;
  finalDecision: Readonly<{
    humanManagerDecision: true;
    entries: ReadonlyArray<EvaluationEntry>;
    finalComment: string | null;
    finalizedAt: string;
  }> | null;
  acknowledgment: Readonly<{
    kind: "ACKNOWLEDGED" | "ACKNOWLEDGED_WITH_RESERVATION";
    reservation: string | null;
    recordedAt: string;
  }> | null;
  immutableClosedSnapshot: Readonly<{
    id: string;
    schemaVersion: number;
    closedAt: string | null;
  }> | null;
  independenceGate: Readonly<{ managerSubmittedBeforeSelfProjection: boolean }>;
}>;

export type EvaluationFactSummary = Readonly<{
  schemaVersion: 2;
  projectFacts: ReadonlyArray<
    Readonly<{
      sourceId: string;
      summary: string;
      result: string | null;
      verificationState: string;
    }>
  >;
  confirmedEvidence: ReadonlyArray<
    Readonly<{
      sourceId: string;
      supportedClaim: string;
      contributionContext: string;
      verificationState: string;
    }>
  >;
  researchFacts: ReadonlyArray<
    Readonly<{
      sourceId: string;
      summary: string;
      verificationState: string;
    }>
  >;
  responsibilityWindows: ReadonlyArray<unknown>;
  dynamicCriteriaVersions: ReadonlyArray<unknown>;
  sourceCoverageNotes: ReadonlyArray<Readonly<{ code: string; messageKey: string; neutral: true }>>;
}>;
