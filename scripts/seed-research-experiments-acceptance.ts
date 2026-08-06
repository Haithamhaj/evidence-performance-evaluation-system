import { createDatabaseClient } from "@evaluation/database";

const ids = {
  organization: "f3000000-0000-4000-8000-000000000001",
  department: "f3000000-0000-4000-8000-000000000002",
  owner: "f3000000-0000-4000-8000-000000000003",
  project: "f3000000-0000-4000-8000-000000000004",
  workstream: "f3000000-0000-4000-8000-000000000005",
  projectMember: "f3000000-0000-4000-8000-000000000006",
  workstreamMember: "f3000000-0000-4000-8000-000000000007",
  template: "f3000000-0000-4000-8000-000000000008",
  templateVersion: "f3000000-0000-4000-8000-000000000009",
  document: "f3000000-0000-4000-8000-000000000010",
  documentVersion: "f3000000-0000-4000-8000-000000000011",
  workItemExisting: "f3000000-0000-4000-8000-000000000012",
  workItemApplied: "f3000000-0000-4000-8000-000000000013",
  evidence: "f3000000-0000-4000-8000-000000000014",
  evidenceRevision: "f3000000-0000-4000-8000-000000000015",
  evidenceConfirmation: "f3000000-0000-4000-8000-000000000016",
  research: "f3111111-1111-4111-8111-111111111111",
  researchRevision: "f3000000-0000-4000-8000-000000000017",
  participant: "f3000000-0000-4000-8000-000000000018",
  researchTransitionDraft: "f3000000-0000-4000-8000-000000000019",
  researchTransitionActive: "f3000000-0000-4000-8000-000000000020",
  researchTransitionConcluded: "f3000000-0000-4000-8000-000000000021",
  sourceReference: "f3000000-0000-4000-8000-000000000022",
  unsupportedExperiment: "f3222222-2222-4222-8222-222222222222",
  supportedExperiment: "f3333333-3333-4333-8333-333333333333",
  unsupportedMethod: "f3000000-0000-4000-8000-000000000023",
  supportedMethod: "f3000000-0000-4000-8000-000000000024",
  unsupportedMeasure: "f3000000-0000-4000-8000-000000000025",
  supportedMeasure: "f3000000-0000-4000-8000-000000000026",
  unsupportedCase: "f3000000-0000-4000-8000-000000000027",
  supportedCase: "f3000000-0000-4000-8000-000000000028",
  unsupportedRun: "f3000000-0000-4000-8000-000000000029",
  supportedRun: "f3000000-0000-4000-8000-000000000030",
  unsupportedObservation: "f3000000-0000-4000-8000-000000000031",
  supportedObservation: "f3000000-0000-4000-8000-000000000032",
  unsupportedConclusion: "f3000000-0000-4000-8000-000000000033",
  supportedConclusion: "f3000000-0000-4000-8000-000000000034",
  researchConclusion: "f3000000-0000-4000-8000-000000000035",
  evidenceLink: "f3000000-0000-4000-8000-000000000036",
  appliedLearning: "f3000000-0000-4000-8000-000000000037",
} as const;

const acceptedAt = new Date("2026-08-06T14:00:00.000Z");

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  assertLocalDatabase(databaseUrl);
  const client = createDatabaseClient(databaseUrl);
  try {
    await client.$transaction(async (tx) => {
      await tx.organization.upsert({
        where: { id: ids.organization },
        update: { name: "Research Experiments Acceptance" },
        create: {
          id: ids.organization,
          key: "research-experiments-acceptance",
          name: "Research Experiments Acceptance",
        },
      });
      await tx.department.upsert({
        where: { id: ids.department },
        update: { name: "Research Acceptance Team" },
        create: {
          id: ids.department,
          key: "research-experiments-acceptance",
          name: "Research Acceptance Team",
          organizationId: ids.organization,
        },
      });
      await tx.user.upsert({
        where: { id: ids.owner },
        update: { active: true, displayName: "Codex" },
        create: {
          id: ids.owner,
          email: "research.acceptance@example.invalid",
          displayName: "Codex",
          active: true,
        },
      });
      await tx.authorizationScope.upsert({
        where: { id: ids.project },
        update: {},
        create: {
          id: ids.project,
          key: "research-experiments-acceptance-project",
          scopeType: "project",
          departmentId: ids.department,
        },
      });
      await tx.project.upsert({
        where: { id: ids.project },
        update: {
          name: "Atlas Source-Grounded Research",
          description: "Deterministic technical acceptance Project for Research and Experiments.",
        },
        create: {
          id: ids.project,
          organizationId: ids.organization,
          departmentId: ids.department,
          authorizationScopeId: ids.project,
          name: "Atlas Source-Grounded Research",
          description: "Deterministic technical acceptance Project for Research and Experiments.",
          status: "active",
          createdById: ids.owner,
        },
      });
      await createIfMissing(tx.projectMember, ids.projectMember, {
        id: ids.projectMember,
        projectId: ids.project,
        employeeId: ids.owner,
        startsAt: acceptedAt,
        reason: "Research acceptance membership",
        createdById: ids.owner,
      });
      await tx.authorizationScope.upsert({
        where: { id: ids.workstream },
        update: {},
        create: {
          id: ids.workstream,
          key: "research-experiments-acceptance-workstream",
          scopeType: "workstream",
          departmentId: ids.department,
        },
      });
      await tx.workstream.upsert({
        where: { id: ids.workstream },
        update: { name: "Retrieval Evaluation", description: "Reproducible retrieval tests." },
        create: {
          id: ids.workstream,
          projectId: ids.project,
          authorizationScopeId: ids.workstream,
          name: "Retrieval Evaluation",
          description: "Reproducible retrieval tests.",
          status: "active",
          createdById: ids.owner,
        },
      });
      await createIfMissing(tx.workstreamMember, ids.workstreamMember, {
        id: ids.workstreamMember,
        workstreamId: ids.workstream,
        employeeId: ids.owner,
        startsAt: acceptedAt,
        reason: "Research acceptance membership",
        createdById: ids.owner,
      });
      await seedDocument(tx);
      await seedWork(tx);
      await seedResearch(tx);
    });
    const counts = await Promise.all([
      client.researchRecord.count({ where: { id: ids.research } }),
      client.experiment.count({ where: { researchId: ids.research } }),
      client.researchEvidenceLink.count({ where: { researchId: ids.research } }),
      client.appliedLearning.count({ where: { researchId: ids.research } }),
    ]);
    process.stdout.write(
      `${JSON.stringify({ projectId: ids.project, researchId: ids.research, counts })}\n`,
    );
  } finally {
    await client.$disconnect();
  }
}

async function seedDocument(tx: any) {
  await createIfMissing(tx.documentTemplate, ids.template, {
    id: ids.template,
    organizationId: ids.organization,
    departmentId: ids.department,
    scopeType: "department",
    kind: "project",
    createdById: ids.owner,
  });
  await createIfMissing(tx.documentTemplateVersion, ids.templateVersion, {
    id: ids.templateVersion,
    templateId: ids.template,
    version: 1,
    status: "active",
    reason: "Research acceptance source",
    createdById: ids.owner,
    activatedAt: acceptedAt,
  });
  await tx.documentRecord.upsert({
    where: { id: ids.document },
    update: {},
    create: {
      id: ids.document,
      organizationId: ids.organization,
      departmentId: ids.department,
      projectId: ids.project,
      templateVersionId: ids.templateVersion,
      currentVersion: 1,
      createdById: ids.owner,
    },
  });
  await createIfMissing(tx.documentVersion, ids.documentVersion, {
    id: ids.documentVersion,
    documentId: ids.document,
    version: 1,
    templateVersionId: ids.templateVersion,
    createdById: ids.owner,
    reason: "Pinned Project context for deterministic Research acceptance",
  });
}

async function seedWork(tx: any) {
  for (const [id, title] of [
    [ids.workItemExisting, "Review retrieval benchmark"],
    [ids.workItemApplied, "Apply the confirmed retrieval guardrail"],
  ]) {
    await tx.workItem.upsert({
      where: { id },
      update: { title },
      create: {
        id,
        projectId: ids.project,
        workstreamId: ids.workstream,
        title,
        description: "Existing Project work used by the Research acceptance journey.",
        status: "in_progress",
        assigneeId: ids.owner,
        requirements: ["Use the approved Project source"],
        acceptanceConditions: ["Record a source-labelled result"],
        createdById: ids.owner,
      },
    });
  }
  await tx.evidenceRecord.upsert({
    where: { id: ids.evidence },
    update: {},
    create: {
      id: ids.evidence,
      idempotencyKey: "f3000000-0000-4000-8000-000000000038",
      projectId: ids.project,
      workstreamId: ids.workstream,
      workItemId: ids.workItemExisting,
      employeeId: ids.owner,
      state: "confirmed",
      version: 2,
      currentRevision: 1,
    },
  });
  await createIfMissing(tx.evidenceRevision, ids.evidenceRevision, {
    id: ids.evidenceRevision,
    evidenceId: ids.evidence,
    revision: 1,
    revisionKind: "manual_draft",
    sourceKind: "pasted_text",
    sourceText: "Deterministic benchmark output retained for acceptance.",
    supportedClaim: "The second experiment met the pinned acceptance measure.",
    contributionContext: "Codex executed and reviewed the bounded experiment.",
    executionMode: "manual",
    createdById: ids.owner,
  });
  await createIfMissing(tx.evidenceConfirmation, ids.evidenceConfirmation, {
    id: ids.evidenceConfirmation,
    evidenceId: ids.evidence,
    evidenceRevisionId: ids.evidenceRevision,
    employeeId: ids.owner,
    reason: "Employee confirmed the experiment evidence.",
    confirmedAt: acceptedAt,
  });
}

async function seedResearch(tx: any) {
  await createIfMissing(tx.researchRecord, ids.research, {
    id: ids.research,
    idempotencyKey: "f3000000-0000-4000-8000-000000000039",
    projectId: ids.project,
    workstreamId: ids.workstream,
    workItemId: ids.workItemExisting,
    ownerId: ids.owner,
    state: "CONCLUDED",
    revision: 1,
    version: 3,
    transitionedAt: acceptedAt,
  });
  await createIfMissing(tx.researchRevision, ids.researchRevision, {
    id: ids.researchRevision,
    researchId: ids.research,
    revision: 1,
    origin: "EMPLOYEE",
    problemStatement: "The Project needs a source-grounded retrieval decision.",
    context: "The approved Project document pins the objective and constraints.",
    question: "Does the bounded retrieval approach improve grounded answers?",
    objective: "Choose a reproducible retrieval approach without inferring performance.",
    hypothesisKind: "TESTABLE",
    hypothesisStatement: "The bounded retrieval approach improves grounded answers.",
    assumptions: ["The deterministic fixture represents the approved use case"],
    constraints: ["No external code execution"],
    knownUncertainty: ["Production traffic differs from the fixture"],
    alternatives: ["Retain the baseline approach"],
    decisionQuestion: "Adopt the bounded retrieval approach?",
    sourceReferences: [`document-version:${ids.documentVersion}`],
    executionMode: "manual",
    authorId: ids.owner,
    createdAt: acceptedAt,
  });
  await createIfMissing(tx.researchParticipantEvent, ids.participant, {
    id: ids.participant,
    researchId: ids.research,
    employeeId: ids.owner,
    role: "OWNER",
    action: "STARTED",
    effectiveAt: acceptedAt,
    reason: "Employee confirmed Research ownership.",
    actorId: ids.owner,
    createdAt: acceptedAt,
  });
  for (const transition of [
    [ids.researchTransitionDraft, null, "DRAFT", 1],
    [ids.researchTransitionActive, "DRAFT", "ACTIVE", 2],
    [ids.researchTransitionConcluded, "ACTIVE", "CONCLUDED", 3],
  ] as const) {
    await createIfMissing(tx.researchTransition, transition[0], {
      id: transition[0],
      researchId: ids.research,
      fromState: transition[1],
      toState: transition[2],
      reason: transition[3] === 3 ? "Employee confirmed the source-supported decision." : null,
      actorId: ids.owner,
      resultingVersion: transition[3],
      effectiveAt: acceptedAt,
      createdAt: acceptedAt,
    });
  }
  await createIfMissing(tx.researchSourceReference, ids.sourceReference, {
    id: ids.sourceReference,
    researchId: ids.research,
    documentVersionId: ids.documentVersion,
    kind: "REPOSITORY",
    title: "Atlas retrieval reference",
    canonicalUrl: "https://github.com/example/atlas-research",
    relevanceNote: "The employee confirmed its relevance to the Project question.",
    credibilityNote: "Deterministic acceptance fixture; not a production trust claim.",
    retrievalState: "RETRIEVED",
    retrievedAt: acceptedAt,
    resolvedCanonicalUrl: "https://github.com/example/atlas-research",
    contentFingerprint: "sha256:research-acceptance-fixture",
    citedLocations: ["README#retrieval"],
    state: "ACTIVE",
    addedById: ids.owner,
    createdAt: acceptedAt,
  });
  await seedExperiment(tx, {
    experimentId: ids.unsupportedExperiment,
    methodId: ids.unsupportedMethod,
    measureId: ids.unsupportedMeasure,
    testCaseId: ids.unsupportedCase,
    runId: ids.unsupportedRun,
    observationId: ids.unsupportedObservation,
    conclusionId: ids.unsupportedConclusion,
    title: "Unsupported retrieval shortcut",
    resultStatus: "FAILED",
    outcome: "NOT_SUPPORTED",
    observedValue: "0.54",
    summary: "The first approach did not satisfy the pinned grounded-answer threshold.",
  });
  await seedExperiment(tx, {
    experimentId: ids.supportedExperiment,
    methodId: ids.supportedMethod,
    measureId: ids.supportedMeasure,
    testCaseId: ids.supportedCase,
    runId: ids.supportedRun,
    observationId: ids.supportedObservation,
    conclusionId: ids.supportedConclusion,
    title: "Bounded retrieval with citations",
    resultStatus: "COMPLETED",
    outcome: "SUPPORTED",
    observedValue: "0.91",
    summary: "The bounded approach satisfied the pinned grounded-answer threshold.",
  });
  await createIfMissing(tx.researchConclusion, ids.researchConclusion, {
    id: ids.researchConclusion,
    researchId: ids.research,
    synthesis: "The failed path remains visible and the bounded cited path met the measure.",
    answer: "Adopt the bounded cited approach for the named Project use case.",
    remainingUncertainty: ["Production-scale latency remains to be observed"],
    decision: "ADOPT",
    rationale: "The employee confirmed both experiment records and their limitations.",
    nextAction: "Apply the guardrail to the existing implementation Task.",
    sourceReferences: [`research-source:${ids.sourceReference}`],
    experimentIds: [ids.unsupportedExperiment, ids.supportedExperiment],
    confirmerId: ids.owner,
    confirmedAt: acceptedAt,
    createdAt: acceptedAt,
  });
  await createIfMissing(tx.researchEvidenceLink, ids.evidenceLink, {
    id: ids.evidenceLink,
    researchId: ids.research,
    evidenceId: ids.evidence,
    evidenceRevisionId: ids.evidenceRevision,
    supportedClaim: "The second experiment met the pinned acceptance measure.",
    experimentId: ids.supportedExperiment,
    experimentRunId: ids.supportedRun,
    experimentConclusionId: ids.supportedConclusion,
    confirmerId: ids.owner,
    confirmedAt: acceptedAt,
    createdAt: acceptedAt,
  });
  await createIfMissing(tx.appliedLearning, ids.appliedLearning, {
    id: ids.appliedLearning,
    researchId: ids.research,
    researchConclusionId: ids.researchConclusion,
    targetKind: "WORK_ITEM",
    targetId: ids.workItemApplied,
    whatChanged: "The existing implementation Task now requires bounded cited retrieval.",
    causalRationale: "The confirmed experiments rejected the shortcut and supported the guardrail.",
    confirmerId: ids.owner,
    confirmedAt: acceptedAt,
    createdAt: acceptedAt,
  });
}

async function seedExperiment(
  tx: any,
  input: Readonly<{
    experimentId: string;
    methodId: string;
    measureId: string;
    testCaseId: string;
    runId: string;
    observationId: string;
    conclusionId: string;
    title: string;
    resultStatus: "FAILED" | "COMPLETED";
    outcome: "NOT_SUPPORTED" | "SUPPORTED";
    observedValue: string;
    summary: string;
  }>,
) {
  await createIfMissing(tx.experiment, input.experimentId, {
    id: input.experimentId,
    researchId: ids.research,
    workstreamId: ids.workstream,
    workItemId: ids.workItemExisting,
    idempotencyKey:
      input.outcome === "SUPPORTED"
        ? "f3000000-0000-4000-8000-000000000041"
        : "f3000000-0000-4000-8000-000000000040",
    title: input.title,
    state: "CONCLUDED",
    methodRevision: 1,
    version: 5,
    transitionedAt: acceptedAt,
  });
  await createIfMissing(tx.experimentMethodRevision, input.methodId, {
    id: input.methodId,
    experimentId: input.experimentId,
    revision: 1,
    question: "Does this approach meet the grounded-answer acceptance threshold?",
    baselineDescription: "Current Project-approved baseline",
    baselineValue: "0.70",
    baselineReference: `document-version:${ids.documentVersion}`,
    conditions: ["Fixed deterministic fixture", "Same model configuration"],
    reproducibilityInstructions:
      "Run the pinned test case with the recorded inputs and compare the named measure.",
    knownRisks: ["The deterministic fixture does not represent production traffic"],
    failureCases: ["Missing citation", "Unsupported claim"],
    sourceReferences: [`research-source:${ids.sourceReference}`],
    executionMode: "manual",
    origin: "EMPLOYEE",
    authorId: ids.owner,
    createdAt: acceptedAt,
  });
  await createIfMissing(tx.experimentMeasure, input.measureId, {
    id: input.measureId,
    methodRevisionId: input.methodId,
    stableId: "grounded_answer_ratio",
    name: "Grounded answer ratio",
    kind: "NUMERIC",
    unit: "ratio",
    direction: "HIGHER",
    baselineValue: "0.70",
    baselineReference: `document-version:${ids.documentVersion}`,
    interpretationRule: "A value at or above 0.85 supports the bounded use case.",
  });
  await createIfMissing(tx.experimentTestCase, input.testCaseId, {
    id: input.testCaseId,
    methodRevisionId: input.methodId,
    inputIdentity: "atlas-fixture-v1",
    expectedObservation: "Cited answer supported by the pinned source.",
    category: "acceptance",
    inclusionReason: "Covers the approved Project decision question.",
  });
  await createIfMissing(tx.experimentRun, input.runId, {
    id: input.runId,
    experimentId: input.experimentId,
    methodRevisionId: input.methodId,
    sequence: 1,
    executorId: ids.owner,
    startedAt: acceptedAt,
    completedAt: acceptedAt,
    resultStatus: input.resultStatus,
    environment: [{ name: "fixture", value: "atlas-v1" }],
    inputs: [{ name: "question-set", value: "approved" }],
    modelConfigurations: [{ name: "route", value: "deterministic" }],
    unexpectedConditions: input.resultStatus === "FAILED" ? ["Citation omitted"] : [],
    executionNotes: input.summary,
    sourceReferences: [`research-source:${ids.sourceReference}`],
    createdAt: acceptedAt,
  });
  await createIfMissing(tx.experimentObservation, input.observationId, {
    id: input.observationId,
    runId: input.runId,
    measureId: input.measureId,
    testCaseId: input.testCaseId,
    observedValue: input.observedValue,
    unit: "ratio",
    note: input.summary,
    createdAt: acceptedAt,
  });
  await createIfMissing(tx.experimentConclusion, input.conclusionId, {
    id: input.conclusionId,
    experimentId: input.experimentId,
    outcome: input.outcome,
    summary: input.summary,
    runIds: [input.runId],
    measureStableIds: ["grounded_answer_ratio"],
    limitations: ["Deterministic acceptance fixture only"],
    confidenceDescription: "Bounded to the named fixture and recorded conditions.",
    decisionRelevance: "Informs the Project retrieval decision without rating a person.",
    nextStep: input.outcome === "SUPPORTED" ? "Apply the guardrail." : "Retain for learning.",
    confirmerId: ids.owner,
    confirmedAt: acceptedAt,
    createdAt: acceptedAt,
  });
}

async function createIfMissing(model: any, id: string, data: Record<string, unknown>) {
  if ((await model.findUnique({ where: { id }, select: { id: true } })) === null) {
    await model.create({ data });
  }
}

function assertLocalDatabase(databaseUrl: string) {
  const target = new URL(databaseUrl);
  if (target.protocol !== "postgresql:" || !["127.0.0.1", "localhost"].includes(target.hostname)) {
    throw new Error("Research acceptance seed requires an explicit local PostgreSQL database");
  }
}

await main();
