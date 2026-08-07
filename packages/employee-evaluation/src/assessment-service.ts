import { databaseAuditWriter } from "@evaluation/audit";
import {
  AppError,
  AssessmentDraftSchema,
  AssessmentEntrySchema,
  EvaluationFactViewSchema,
  SaveAssessmentDraftInputSchema,
  SubmitAssessmentInputSchema,
  type AssessmentKind,
  type EvaluationFactView,
} from "@evaluation/contracts";
import { z } from "zod";

type Database = import("@evaluation/database").DatabaseClient;
type Transaction = import("./ports.js").EvaluationTransaction;
type Audit = import("@evaluation/contracts").AuditWriter<Transaction>;

export interface AssessmentFactViewReader {
  read(
    input: Readonly<{
      cycle: EvaluationFactView["cycle"];
      subjectEmployeeId: string;
      requester: Readonly<{
        actorId: string;
        subjectEmployeeId: string;
        access: "self" | "assigned_manager";
        active: true;
      }>;
    }>,
  ): Promise<Readonly<EvaluationFactView>>;
}

export type AssessmentSubmissionReceipt = Readonly<{
  schemaVersion: 1;
  id: string;
  assignmentId: string;
  kind: AssessmentKind;
  assessmentId: string;
  revisionId: string;
  cycleSnapshotId: string;
  submittedById: string;
  selfProjectionAccessedBeforeSubmit: false;
  confirmedAt: string;
}>;

export class AssessmentService {
  readonly #database: Database;
  readonly #factViewReader: AssessmentFactViewReader;
  readonly #audit: Audit;
  readonly #clock: () => Date;

  constructor(
    database: Database,
    factViewReader: AssessmentFactViewReader,
    audit: Audit = databaseAuditWriter as Audit,
    clock: () => Date = () => new Date(),
  ) {
    this.#database = database;
    this.#factViewReader = factViewReader;
    this.#audit = audit;
    this.#clock = clock;
  }

  async saveDraft(input: unknown): Promise<import("@evaluation/contracts").AssessmentDraft> {
    const parsed = SaveAssessmentDraftInputSchema.parse(input);
    const savedAt = validDate(this.#clock());
    return serializable(this.#database, async (transaction) => {
      const assignment = await readAssignment(transaction, parsed.assignmentId);
      assertWriter(assignment, parsed.actorId, parsed.kind);
      assertAssessmentStage(assignment.cycle.state, parsed.kind);
      if (assignment.eligibilityState !== "ELIGIBLE") {
        throw assessmentError("EVALUATION_ASSIGNMENT_NOT_ELIGIBLE", 409);
      }

      const duplicate = await transaction.assessmentRevision.findUnique({
        where: { idempotencyKey: parsed.idempotencyKey },
        include: { assessment: true },
      });
      if (duplicate !== null) {
        if (
          duplicate.assessment.assignmentId !== assignment.id ||
          duplicate.assessment.kind !== parsed.kind ||
          duplicate.createdById !== parsed.actorId ||
          duplicate.revision !== parsed.expectedVersion ||
          JSON.stringify(duplicate.entries) !== JSON.stringify(parsed.entries)
        ) {
          throw assessmentError("IDEMPOTENCY_KEY_REUSED", 409);
        }
        return serializeRevision(
          duplicate.assessment,
          duplicate,
          await submissionTime(transaction, duplicate.assessment.id),
        );
      }

      const existing = await transaction.assessment.findUnique({
        where: { assignmentId_kind: { assignmentId: assignment.id, kind: parsed.kind } },
      });
      if (existing !== null) {
        const submitted = await transaction.assessmentSubmission.findUnique({
          where: { assessmentId: existing.id },
        });
        if (submitted !== null) throw assessmentError("EVALUATION_ASSESSMENT_IMMUTABLE", 409);
        if (existing.version !== parsed.expectedVersion) {
          return readCurrentDraft(transaction, existing);
        }
      } else if (parsed.expectedVersion !== 1) {
        throw assessmentError("VERSION_CONFLICT", 409);
      }

      const templateItems = frozenTemplateItems(assignment.cycle.snapshot?.templateSnapshot);
      assertDraftCriteria(parsed.entries, templateItems);
      const factView = await this.#readAuthorizedFacts(assignment, parsed.actorId, parsed.kind);
      assertAuthorizedSources(parsed.entries, factView);

      const assessment =
        existing ??
        (await transaction.assessment.create({
          data: { assignmentId: assignment.id, kind: parsed.kind },
        }));
      const revisionNumber = assessment.version;
      const revision = await transaction.assessmentRevision.create({
        data: {
          idempotencyKey: parsed.idempotencyKey,
          assessmentId: assessment.id,
          revision: revisionNumber,
          entries: parsed.entries as never,
          createdById: parsed.actorId,
          createdAt: savedAt,
        },
      });
      const advanced = await transaction.assessment.updateMany({
        where: { id: assessment.id, version: parsed.expectedVersion },
        data: { version: { increment: 1 }, updatedAt: savedAt },
      });
      if (advanced.count !== 1) throw assessmentError("VERSION_CONFLICT", 409);
      await this.#audit.append(transaction, {
        eventType: "evaluation.assessment.draft_saved",
        actor: { kind: "human", id: parsed.actorId },
        effectiveSubjectId: assignment.employeeId,
        scopeType: "cycle",
        scopeId: assignment.cycleId,
        targetType: "assessment_revision",
        targetId: revision.id,
        safeDiff: {
          kind: parsed.kind,
          revision: revisionNumber,
          resultingVersion: parsed.expectedVersion + 1,
          criterionCount: parsed.entries.length,
          pinnedSourceCount: uniqueSourceIds(parsed.entries).length,
        },
        correlationId: parsed.idempotencyKey,
        source: "api",
      });
      return AssessmentDraftSchema.parse({
        schemaVersion: 1,
        id: assessment.id,
        assignmentId: assignment.id,
        kind: parsed.kind,
        version: parsed.expectedVersion + 1,
        entries: parsed.entries,
        updatedAt: revision.createdAt.toISOString(),
        submittedAt: null,
      });
    });
  }

  async submit(input: unknown): Promise<AssessmentSubmissionReceipt> {
    const parsed = SubmitAssessmentInputSchema.parse(input);
    const confirmedAt = new Date(parsed.confirmedAt);
    const serverNow = validDate(this.#clock());
    if (!Number.isFinite(confirmedAt.getTime()) || confirmedAt > serverNow) {
      throw assessmentError("EVALUATION_CONFIRMATION_TIME_INVALID");
    }
    return serializable(this.#database, async (transaction) => {
      const assignment = await readAssignment(transaction, parsed.assignmentId);
      assertWriter(assignment, parsed.actorId, parsed.kind);
      assertAssessmentStage(assignment.cycle.state, parsed.kind);
      if (assignment.eligibilityState !== "ELIGIBLE") {
        throw assessmentError("EVALUATION_ASSIGNMENT_NOT_ELIGIBLE", 409);
      }

      const byKey = await transaction.assessmentSubmission.findUnique({
        where: { idempotencyKey: parsed.idempotencyKey },
        include: { revision: true },
      });
      if (byKey !== null) {
        assertSameSubmission(byKey, parsed.assignmentId, parsed.actorId, parsed.kind, {
          expectedVersion: parsed.expectedVersion,
          confirmedAt,
        });
        return serializeSubmission(byKey);
      }
      const original = await transaction.assessmentSubmission.findUnique({
        where: {
          assignmentId_kind: { assignmentId: parsed.assignmentId, kind: parsed.kind },
        },
      });
      if (original !== null) {
        assertSameSubmission(original, parsed.assignmentId, parsed.actorId, parsed.kind);
        return serializeSubmission(original);
      }

      const assessment = await transaction.assessment.findUnique({
        where: { assignmentId_kind: { assignmentId: assignment.id, kind: parsed.kind } },
      });
      if (assessment === null) throw assessmentError("EVALUATION_ASSESSMENT_DRAFT_REQUIRED", 409);
      if (assessment.version !== parsed.expectedVersion) {
        throw assessmentError("VERSION_CONFLICT", 409);
      }
      if (confirmedAt < assignment.cycle.startsAt) {
        throw assessmentError("EVALUATION_CONFIRMATION_TIME_INVALID");
      }
      const revision = await transaction.assessmentRevision.findFirst({
        where: { assessmentId: assessment.id },
        orderBy: { revision: "desc" },
      });
      if (revision === null || revision.revision + 1 !== assessment.version) {
        throw assessmentError("EVALUATION_ASSESSMENT_DRAFT_INVALID", 409);
      }
      const entries = z.array(AssessmentEntrySchema).parse(revision.entries);
      const templateItems = frozenTemplateItems(assignment.cycle.snapshot?.templateSnapshot);
      assertCompleteAssessment(entries, templateItems);
      if (parsed.kind === "MANAGER_INITIAL") assertManagerBasis(entries);

      const snapshot = assignment.cycle.snapshot;
      if (snapshot === null) throw assessmentError("EVALUATION_CYCLE_SNAPSHOT_REQUIRED", 409);
      const submission = await transaction.assessmentSubmission.create({
        data: {
          idempotencyKey: parsed.idempotencyKey,
          assignmentId: assignment.id,
          kind: parsed.kind,
          assessmentId: assessment.id,
          revisionId: revision.id,
          cycleSnapshotId: snapshot.id,
          submittedById: parsed.actorId,
          selfProjectionAccessedBeforeSubmit: false,
          confirmedAt,
        },
      });
      await this.#audit.append(transaction, {
        eventType: "evaluation.assessment.submitted",
        actor: { kind: "human", id: parsed.actorId },
        effectiveSubjectId: assignment.employeeId,
        scopeType: "cycle",
        scopeId: assignment.cycleId,
        targetType: "assessment_submission",
        targetId: submission.id,
        safeDiff: {
          kind: parsed.kind,
          assessmentVersion: assessment.version,
          criterionCount: entries.length,
          pinnedSourceCount: uniqueSourceIds(entries).length,
          independenceGatePreserved: true,
        },
        correlationId: parsed.idempotencyKey,
        source: "api",
      });
      return serializeSubmission(submission);
    });
  }

  async readSelfAssessment(
    input: Readonly<{
      assignmentId: string;
      managerId: string;
    }>,
  ): Promise<import("@evaluation/contracts").AssessmentDraft> {
    const assignment = await this.#database.evaluationAssignment.findUnique({
      where: { id: input.assignmentId },
    });
    if (assignment === null) throw assessmentError("EVALUATION_ASSIGNMENT_NOT_FOUND", 404);
    if (assignment.managerId !== input.managerId) throw assessmentError("AUTHZ_SCOPE", 403);
    const managerSubmission = await this.#database.assessmentSubmission.findUnique({
      where: {
        assignmentId_kind: { assignmentId: assignment.id, kind: "MANAGER_INITIAL" },
      },
    });
    if (managerSubmission === null) {
      throw assessmentError("EVALUATION_INDEPENDENCE_GATE", 403);
    }
    const selfSubmission = await this.#database.assessmentSubmission.findUnique({
      where: { assignmentId_kind: { assignmentId: assignment.id, kind: "SELF" } },
      include: { assessment: true, revision: true },
    });
    if (selfSubmission === null) throw assessmentError("EVALUATION_SELF_ASSESSMENT_NOT_FOUND", 404);
    return serializeRevision(
      selfSubmission.assessment,
      selfSubmission.revision,
      selfSubmission.confirmedAt,
    );
  }

  async #readAuthorizedFacts(
    assignment: IncludedAssignment,
    actorId: string,
    kind: AssessmentKind,
  ): Promise<Readonly<EvaluationFactView>> {
    const snapshot = assignment.cycle.snapshot;
    if (snapshot === null) throw assessmentError("EVALUATION_CYCLE_SNAPSHOT_REQUIRED", 409);
    const view = EvaluationFactViewSchema.parse(
      await this.#factViewReader.read({
        cycle: {
          id: assignment.cycleId,
          startsAt: assignment.cycle.startsAt.toISOString(),
          endsAt: assignment.cycle.endsAt.toISOString(),
          rubricVersionId: snapshot.rubricVersionId,
        },
        subjectEmployeeId: assignment.employeeId,
        requester: {
          actorId,
          subjectEmployeeId: assignment.employeeId,
          access: kind === "SELF" ? "self" : "assigned_manager",
          active: true,
        },
      }),
    );
    if (
      view.cycle.id !== assignment.cycleId ||
      view.cycle.rubricVersionId !== snapshot.rubricVersionId ||
      Date.parse(view.cycle.startsAt) !== assignment.cycle.startsAt.getTime() ||
      Date.parse(view.cycle.endsAt) !== assignment.cycle.endsAt.getTime() ||
      view.subjectEmployeeId !== assignment.employeeId
    ) {
      throw assessmentError("EVALUATION_FACT_VIEW_SCOPE_INVALID", 403);
    }
    return view;
  }
}

const assignmentInclude = {
  cycle: { include: { snapshot: true } },
} as const;

type IncludedAssignment = Awaited<
  ReturnType<Transaction["evaluationAssignment"]["findUniqueOrThrow"]>
> & {
  cycle: {
    state: import("@evaluation/contracts").EvaluationCycleState;
    startsAt: Date;
    endsAt: Date;
    snapshot: {
      id: string;
      rubricVersionId: string;
      templateSnapshot: unknown;
    } | null;
  };
};

async function readAssignment(
  transaction: Transaction,
  assignmentId: string,
): Promise<IncludedAssignment> {
  const assignment = await transaction.evaluationAssignment.findUnique({
    where: { id: assignmentId },
    include: assignmentInclude,
  });
  if (assignment === null) throw assessmentError("EVALUATION_ASSIGNMENT_NOT_FOUND", 404);
  return assignment as IncludedAssignment;
}

function assertWriter(
  assignment: Pick<IncludedAssignment, "employeeId" | "managerId">,
  actorId: string,
  kind: AssessmentKind,
): void {
  const authorized =
    kind === "SELF" ? actorId === assignment.employeeId : actorId === assignment.managerId;
  if (!authorized) throw assessmentError("AUTHZ_SCOPE", 403);
}

function assertAssessmentStage(state: string, kind: AssessmentKind): void {
  const expected = kind === "SELF" ? "SELF_ASSESSMENT" : "MANAGER_ASSESSMENT";
  if (state !== expected) throw assessmentError("EVALUATION_ASSESSMENT_STAGE_INVALID", 409);
}

type FrozenTemplateItem = Readonly<{
  id: string;
  stableCriterionId: string;
  kind: "FIXED_CRITERION" | "PROJECT_CONTRIBUTION";
  mandatory: boolean;
}>;

const FrozenTemplateItemsSchema = z
  .object({
    items: z.array(
      z
        .object({
          id: z.string().uuid(),
          stableCriterionId: z.string().trim().min(1),
          kind: z.enum(["FIXED_CRITERION", "PROJECT_CONTRIBUTION"]),
          mandatory: z.boolean(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

function frozenTemplateItems(snapshot: unknown): ReadonlyArray<FrozenTemplateItem> {
  const parsed = FrozenTemplateItemsSchema.safeParse(snapshot);
  if (!parsed.success) throw assessmentError("EVALUATION_TEMPLATE_SNAPSHOT_INVALID", 409);
  const fixed = parsed.data.items.filter(({ kind }) => kind === "FIXED_CRITERION");
  const project = parsed.data.items.filter(({ kind }) => kind === "PROJECT_CONTRIBUTION");
  if (
    parsed.data.items.length !== 13 ||
    fixed.length !== 12 ||
    project.length !== 1 ||
    parsed.data.items.some(({ mandatory }) => !mandatory)
  ) {
    throw assessmentError("EVALUATION_TEMPLATE_SNAPSHOT_INVALID", 409);
  }
  return parsed.data.items;
}

function assertDraftCriteria(
  entries: ReadonlyArray<import("@evaluation/contracts").AssessmentEntry>,
  items: ReadonlyArray<FrozenTemplateItem>,
): void {
  const allowed = new Set(items.map(({ id }) => id));
  if (entries.some(({ criterionId }) => !allowed.has(criterionId))) {
    throw assessmentError("EVALUATION_ASSESSMENT_CRITERIA_INVALID");
  }
}

function assertCompleteAssessment(
  entries: ReadonlyArray<import("@evaluation/contracts").AssessmentEntry>,
  items: ReadonlyArray<FrozenTemplateItem>,
): void {
  const expected = items.map(({ id }) => id).sort();
  const actual = entries.map(({ criterionId }) => criterionId).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw assessmentError("EVALUATION_ASSESSMENT_INCOMPLETE");
  }
}

function assertManagerBasis(
  entries: ReadonlyArray<import("@evaluation/contracts").AssessmentEntry>,
): void {
  if (
    entries.some(
      ({ directObservationBasis, sourceReferences }) =>
        directObservationBasis === null && sourceReferences.length === 0,
    )
  ) {
    throw assessmentError("EVALUATION_MANAGER_BASIS_REQUIRED");
  }
}

function assertAuthorizedSources(
  entries: ReadonlyArray<import("@evaluation/contracts").AssessmentEntry>,
  view: Readonly<EvaluationFactView>,
): void {
  const authorized = new Set(
    [
      ...view.responsibilityWindows,
      ...view.projectFacts,
      ...view.confirmedEvidence,
      ...view.checkInFacts,
      ...view.dynamicCriteriaVersions,
      ...view.researchFacts,
    ].map(({ sourceId }) => sourceId),
  );
  if (uniqueSourceIds(entries).some((sourceId) => !authorized.has(sourceId))) {
    throw assessmentError("EVALUATION_FACT_SOURCE_NOT_AUTHORIZED", 403);
  }
}

function uniqueSourceIds(
  entries: ReadonlyArray<import("@evaluation/contracts").AssessmentEntry>,
): string[] {
  return [...new Set(entries.flatMap(({ sourceReferences }) => sourceReferences))];
}

async function readCurrentDraft(
  transaction: Transaction,
  assessment: { id: string; assignmentId: string; kind: AssessmentKind; version: number },
): Promise<import("@evaluation/contracts").AssessmentDraft> {
  const revision = await transaction.assessmentRevision.findFirst({
    where: { assessmentId: assessment.id },
    orderBy: { revision: "desc" },
  });
  if (revision === null) throw assessmentError("EVALUATION_ASSESSMENT_DRAFT_INVALID", 409);
  return serializeRevision(
    assessment,
    revision,
    await submissionTime(transaction, assessment.id),
    assessment.version,
  );
}

async function submissionTime(
  transaction: Transaction,
  assessmentId: string,
): Promise<Date | null> {
  const submission = await transaction.assessmentSubmission.findUnique({
    where: { assessmentId },
    select: { confirmedAt: true },
  });
  return submission?.confirmedAt ?? null;
}

function serializeRevision(
  assessment: { id: string; assignmentId: string; kind: AssessmentKind },
  revision: { revision: number; entries: unknown; createdAt: Date },
  submittedAt: Date | null,
  version = revision.revision + 1,
): import("@evaluation/contracts").AssessmentDraft {
  return AssessmentDraftSchema.parse({
    schemaVersion: 1,
    id: assessment.id,
    assignmentId: assessment.assignmentId,
    kind: assessment.kind,
    version,
    entries: revision.entries,
    updatedAt: revision.createdAt.toISOString(),
    submittedAt: submittedAt?.toISOString() ?? null,
  });
}

function assertSameSubmission(
  submission: {
    assignmentId: string;
    submittedById: string;
    kind: AssessmentKind;
    confirmedAt?: Date;
    revision?: { revision: number };
  },
  assignmentId: string,
  actorId: string,
  kind: AssessmentKind,
  exact?: Readonly<{ expectedVersion: number; confirmedAt: Date }>,
): void {
  if (
    submission.assignmentId !== assignmentId ||
    submission.submittedById !== actorId ||
    submission.kind !== kind ||
    (exact !== undefined &&
      (submission.revision === undefined ||
        submission.revision.revision + 1 !== exact.expectedVersion ||
        submission.confirmedAt?.getTime() !== exact.confirmedAt.getTime()))
  ) {
    throw assessmentError("IDEMPOTENCY_KEY_REUSED", 409);
  }
}

function serializeSubmission(submission: {
  id: string;
  assignmentId: string;
  kind: AssessmentKind;
  assessmentId: string;
  revisionId: string;
  cycleSnapshotId: string;
  submittedById: string;
  selfProjectionAccessedBeforeSubmit: boolean;
  confirmedAt: Date;
}): AssessmentSubmissionReceipt {
  if (submission.selfProjectionAccessedBeforeSubmit) {
    throw assessmentError("EVALUATION_INDEPENDENCE_PROOF_INVALID", 500);
  }
  return {
    schemaVersion: 1,
    id: submission.id,
    assignmentId: submission.assignmentId,
    kind: submission.kind,
    assessmentId: submission.assessmentId,
    revisionId: submission.revisionId,
    cycleSnapshotId: submission.cycleSnapshotId,
    submittedById: submission.submittedById,
    selfProjectionAccessedBeforeSubmit: false,
    confirmedAt: submission.confirmedAt.toISOString(),
  };
}

function validDate(value: Date): Date {
  if (!Number.isFinite(value.getTime())) throw assessmentError("EVALUATION_TIME_INVALID");
  return value;
}

function assessmentError(code: string, status = 400): AppError {
  return new AppError(code, "errors.evaluation.assessmentInvalid", status);
}

async function serializable<T>(
  database: Database,
  operation: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await database.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      if (attempt < 4 && isRetryable(error)) continue;
      throw error;
    }
  }
  throw new Error("Unreachable employee assessment retry state");
}

function isRetryable(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    ["P2034", "P2002"].includes(String((error as { code?: unknown }).code))
  );
}
