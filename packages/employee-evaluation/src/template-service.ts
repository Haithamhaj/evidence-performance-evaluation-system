import { databaseAuditWriter } from "@evaluation/audit";
import { ActivateEvaluationTemplateVersionInputSchema, AppError } from "@evaluation/contracts";

type Database = import("@evaluation/database").DatabaseClient;
type Transaction = import("./ports.js").EvaluationTransaction;
type Audit = import("@evaluation/contracts").AuditWriter<Transaction>;

const ACTIVATION_KEY = "activationIdempotencyKey";

export class EvaluationTemplateService {
  readonly #database: Database;
  readonly #rubricReader: import("./ports.js").EvaluationRubricReader;
  readonly #organizationReader: import("./ports.js").EvaluationOrganizationReader;
  readonly #audit: Audit;
  readonly #clock: () => Date;

  constructor(
    database: Database,
    rubricReader: import("./ports.js").EvaluationRubricReader,
    organizationReader: import("./ports.js").EvaluationOrganizationReader,
    audit: Audit = databaseAuditWriter as Audit,
    clock: () => Date = () => new Date(),
  ) {
    this.#database = database;
    this.#rubricReader = rubricReader;
    this.#organizationReader = organizationReader;
    this.#audit = audit;
    this.#clock = clock;
  }

  async activateVersion(input: unknown): Promise<ActivatedEvaluationTemplateVersion> {
    const parsed = ActivateEvaluationTemplateVersionInputSchema.parse(input);
    const now = validDate(this.#clock());
    return serializable(this.#database, async (transaction) => {
      const version = await transaction.evaluationTemplateVersion.findUnique({
        where: { id: parsed.versionId },
        include: {
          template: true,
          items: { include: { locales: true }, orderBy: { displayOrder: "asc" } },
        },
      });
      if (version === null) throw evaluationError("EVALUATION_TEMPLATE_VERSION_NOT_FOUND", 404);

      const policy = jsonObject(version.evaluationPolicy);
      if (version.status === "ACTIVE") {
        if (
          version.version === parsed.expectedVersion + 1 &&
          version.activatedById === parsed.actorId &&
          policy[ACTIVATION_KEY] === parsed.idempotencyKey
        ) {
          return serialize(version);
        }
        throw evaluationError("VERSION_CONFLICT", 409);
      }
      if (version.status !== "DRAFT") {
        throw evaluationError("EVALUATION_TEMPLATE_IMMUTABLE", 409);
      }
      if (version.version !== parsed.expectedVersion)
        throw evaluationError("VERSION_CONFLICT", 409);

      await assertScopeInheritance(transaction, version.template, this.#organizationReader);
      const rubric = await this.#rubricReader.readEvaluationRubric(
        transaction,
        version.rubricVersionId,
      );
      if (
        rubric === null ||
        rubric.status !== "active" ||
        rubric.organizationId !== version.template.organizationId
      ) {
        throw evaluationError("EVALUATION_TEMPLATE_RUBRIC_INVALID");
      }
      assertActivatable(version, rubric);

      const result = await transaction.evaluationTemplateVersion.updateMany({
        where: { id: version.id, status: "DRAFT", version: parsed.expectedVersion },
        data: {
          status: "ACTIVE",
          activatedAt: now,
          activatedById: parsed.actorId,
          version: { increment: 1 },
          evaluationPolicy: { ...policy, [ACTIVATION_KEY]: parsed.idempotencyKey },
        },
      });
      if (result.count !== 1) throw evaluationError("VERSION_CONFLICT", 409);
      await this.#audit.append(transaction, {
        eventType: "evaluation.template.version_activated",
        actor: { kind: "human", id: parsed.actorId },
        effectiveSubjectId: parsed.actorId,
        scopeType: version.template.scope === "ORGANIZATION" ? "organization" : "department",
        scopeId: version.template.departmentId ?? version.template.organizationId,
        targetType: "evaluation_template_version",
        targetId: version.id,
        reason: parsed.reason,
        safeDiff: {
          previous: { status: version.status, version: version.version },
          next: { status: "ACTIVE", version: version.version + 1 },
          rubricVersionId: version.rubricVersionId,
        },
        correlationId: parsed.idempotencyKey,
        source: "api",
      });
      const activated = await transaction.evaluationTemplateVersion.findUniqueOrThrow({
        where: { id: version.id },
        include: {
          template: true,
          items: { include: { locales: true }, orderBy: { displayOrder: "asc" } },
        },
      });
      return serialize(activated);
    });
  }
}

export type ActivatedEvaluationTemplateVersion = Readonly<{
  id: string;
  templateId: string;
  rubricVersionId: string;
  status: "ACTIVE";
  versionNumber: number;
  version: number;
  ratingScale: unknown;
  localeAvailability: unknown;
  activatedAt: string;
}>;

function assertActivatable(
  version: Awaited<ReturnType<Transaction["evaluationTemplateVersion"]["findUniqueOrThrow"]>> & {
    items: ReadonlyArray<{
      stableCriterionId: string;
      kind: "FIXED_CRITERION" | "PROJECT_CONTRIBUTION";
      sectionStableId: string;
      sectionWeight: number;
      criterionWeight: number | null;
      protectedGlobal: boolean;
      allowedWeightMinimum: number | null;
      allowedWeightMaximum: number | null;
      locales: ReadonlyArray<{ locale: string; title: string; anchors: unknown }>;
    }>;
  },
  rubric: import("./ports.js").EvaluationRubricSnapshot,
): void {
  if (JSON.stringify(version.ratingScale) !== JSON.stringify([1, 2, 3, 4, 5])) {
    throw evaluationError("EVALUATION_TEMPLATE_RATING_SCALE_INVALID");
  }
  const availability = jsonStringArray(version.localeAvailability);
  const english = rubric.locales.find(
    (locale) => locale.locale === "en" && locale.status === "active",
  );
  const activeLocales = rubric.locales
    .filter(({ status }) => status === "active")
    .map(({ locale }) => locale)
    .sort();
  if (
    !availability.includes("en") ||
    english === undefined ||
    JSON.stringify([...availability].sort()) !== JSON.stringify(activeLocales)
  ) {
    throw evaluationError("EVALUATION_TEMPLATE_LOCALE_INVALID");
  }

  const requiredIds = english.criteria.map(({ id }) => id).sort();
  const itemIds = version.items.map(({ stableCriterionId }) => stableCriterionId).sort();
  if (JSON.stringify(itemIds) !== JSON.stringify(requiredIds)) {
    throw evaluationError("EVALUATION_TEMPLATE_CRITERIA_INVALID");
  }
  const protectedIds = version.items
    .filter(({ protectedGlobal }) => protectedGlobal)
    .map(({ stableCriterionId }) => stableCriterionId)
    .sort();
  if (
    JSON.stringify(protectedIds) !== JSON.stringify([...rubric.protectedGlobalCriterionIds].sort())
  ) {
    throw evaluationError("EVALUATION_TEMPLATE_PROTECTED_CRITERIA_INVALID");
  }

  const sectionWeights = new Map<string, number>();
  const fixedWeights = new Map<string, number>();
  for (const item of version.items) {
    const expected = english.criteria.find(({ id }) => id === item.stableCriterionId);
    const expectedSection = english.sections.find(({ id }) => id === item.sectionStableId);
    const locale = item.locales.find((candidate) => candidate.locale === "en");
    if (
      expected === undefined ||
      expectedSection === undefined ||
      locale === undefined ||
      locale.title !== expected.title ||
      !sameAnchors(locale.anchors, expected.anchors)
    ) {
      throw evaluationError("EVALUATION_TEMPLATE_RUBRIC_INVALID");
    }
    const priorSectionWeight = sectionWeights.get(item.sectionStableId);
    if (priorSectionWeight !== undefined && priorSectionWeight !== item.sectionWeight) {
      throw evaluationError("EVALUATION_TEMPLATE_WEIGHT_INVALID");
    }
    sectionWeights.set(item.sectionStableId, item.sectionWeight);
    if (item.kind === "FIXED_CRITERION") {
      if (item.criterionWeight === null || item.criterionWeight !== expected.internalWeight) {
        throw evaluationError("EVALUATION_TEMPLATE_WEIGHT_INVALID");
      }
      fixedWeights.set(
        item.sectionStableId,
        (fixedWeights.get(item.sectionStableId) ?? 0) + item.criterionWeight,
      );
      const effectiveWeight = (item.sectionWeight * item.criterionWeight) / 100;
      if (
        (item.allowedWeightMinimum !== null && effectiveWeight < item.allowedWeightMinimum) ||
        (item.allowedWeightMaximum !== null && effectiveWeight > item.allowedWeightMaximum)
      ) {
        throw evaluationError("EVALUATION_TEMPLATE_WEIGHT_RANGE_INVALID");
      }
    } else if (item.criterionWeight !== null) {
      throw evaluationError("EVALUATION_TEMPLATE_WEIGHT_INVALID");
    }
  }
  if ([...sectionWeights.values()].reduce((sum, weight) => sum + weight, 0) !== 100) {
    throw evaluationError("EVALUATION_TEMPLATE_WEIGHT_INVALID");
  }
  if ([...fixedWeights.values()].some((weight) => weight !== 100)) {
    throw evaluationError("EVALUATION_TEMPLATE_WEIGHT_INVALID");
  }
}

async function assertScopeInheritance(
  transaction: Transaction,
  template: {
    organizationId: string;
    departmentId: string | null;
    scope: "ORGANIZATION" | "DEPARTMENT";
  },
  reader: import("./ports.js").EvaluationOrganizationReader,
): Promise<void> {
  if (template.scope === "ORGANIZATION") {
    if (template.departmentId !== null) throw evaluationError("EVALUATION_TEMPLATE_SCOPE_INVALID");
    return;
  }
  if (
    template.departmentId === null ||
    !(await reader.departmentBelongsToOrganization(transaction, {
      organizationId: template.organizationId,
      departmentId: template.departmentId,
    }))
  ) {
    throw evaluationError("EVALUATION_TEMPLATE_SCOPE_INVALID");
  }
}

function serialize(version: {
  id: string;
  templateId: string;
  rubricVersionId: string;
  status: "DRAFT" | "ACTIVE" | "RETIRED";
  versionNumber: number;
  version: number;
  ratingScale: unknown;
  localeAvailability: unknown;
  activatedAt: Date | null;
}): ActivatedEvaluationTemplateVersion {
  if (version.status !== "ACTIVE" || version.activatedAt === null) {
    throw new Error("Evaluation template version is not active");
  }
  return {
    id: version.id,
    templateId: version.templateId,
    rubricVersionId: version.rubricVersionId,
    status: version.status,
    versionNumber: version.versionNumber,
    version: version.version,
    ratingScale: version.ratingScale,
    localeAvailability: version.localeAvailability,
    activatedAt: version.activatedAt.toISOString(),
  };
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function jsonStringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : [];
}

function sameAnchors(
  actual: unknown,
  expected: ReadonlyArray<Readonly<{ rating: number; text: string }>>,
): boolean {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  return actual.every((candidate, index) => {
    if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate))
      return false;
    const row = candidate as Record<string, unknown>;
    return row.rating === expected[index]?.rating && row.text === expected[index]?.text;
  });
}

function validDate(value: Date): Date {
  if (!Number.isFinite(value.getTime())) throw evaluationError("EVALUATION_TIME_INVALID");
  return value;
}

function evaluationError(code: string, status = 400): AppError {
  return new AppError(code, "errors.evaluation.templateInvalid", status);
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
  throw new Error("Unreachable evaluation template retry state");
}

function isRetryable(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    ["P2034", "P2002"].includes(String((error as { code?: unknown }).code))
  );
}
