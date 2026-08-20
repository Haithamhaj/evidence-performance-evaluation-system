import { PreparedExperienceItemSchema } from "@evaluation/contracts";

type Database = import("@evaluation/database").DatabaseClient;

export class PrismaPreparedExperiencePersistence {
  private readonly database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  async find(key: string) {
    const row = await this.database.experiencePreparedItem.findUnique({
      where: { idempotencyKey: key },
    });
    if (row === null) return null;
    const aiRun =
      row.assistanceMode === "ai_assisted"
        ? await this.database.aiRun.findFirst({
            where: { outputReference: row.outputReference, state: "succeeded" },
            select: { id: true, routeKey: true },
          })
        : null;
    return materialize(row, aiRun);
  }

  async appendDeterministic(
    key: string,
    employeeId: string,
    item: import("@evaluation/contracts").PreparedExperienceItem,
  ) {
    return this.database.$transaction(async (transaction) => {
      const existing = await transaction.experiencePreparedItem.findUnique({
        where: { idempotencyKey: key },
      });
      if (existing !== null) {
        const aiRun =
          existing.assistanceMode === "ai_assisted"
            ? await transaction.aiRun.findFirst({
                where: { outputReference: existing.outputReference, state: "succeeded" },
                select: { id: true, routeKey: true },
              })
            : null;
        return materialize(existing, aiRun);
      }
      const row = await transaction.experiencePreparedItem.create({
        data: data(key, employeeId, item, `experience-prepared:${item.id}`),
      });
      return materialize(row, null);
    });
  }

  async persistAiOutput(
    transaction: import("@evaluation/database").DatabaseTransaction,
    input: Parameters<
      import("./experience-orchestrator.service.js").PreparedExperiencePersistence["persistAiOutput"]
    >[1],
  ) {
    await transaction.experiencePreparedItem.upsert({
      where: { idempotencyKey: input.key },
      create: {
        id: input.itemId,
        employeeId: input.employeeId,
        idempotencyKey: input.key,
        schemaVersion: "experience-prepared-output.v1",
        state: "prepared",
        kind: input.output.kind,
        sourceReferences: [...input.output.sourceReferences],
        why: input.output.why,
        freshness: {
          status: "fresh",
          sourceObservedAt: input.sourceObservedAt,
          preparedAt: input.preparedAt,
        },
        consequence: input.output.consequence,
        editableDraft: input.output.editableDraft,
        assistanceMode: "ai_assisted",
        assistanceLabel: "Prepared with governed AI assistance for your review.",
        outputReference: input.outputReference,
        correlationId: input.correlationId,
      },
      update: {},
    });
    return { outputReference: input.outputReference };
  }
}

type Row = Awaited<ReturnType<Database["experiencePreparedItem"]["findUnique"]>> & {};

function materialize(
  row: NonNullable<Row>,
  aiRun: Readonly<{ id: string; routeKey: string }> | null,
) {
  return PreparedExperienceItemSchema.parse({
    id: row.id,
    schemaVersion: row.schemaVersion,
    state: row.state,
    kind: row.kind,
    sourceReferences: row.sourceReferences,
    why: row.why,
    freshness: row.freshness,
    consequence: row.consequence,
    editableDraft: row.editableDraft,
    assistance: {
      mode: row.assistanceMode,
      label: row.assistanceLabel,
      routeTrace:
        row.assistanceMode === "ai_assisted" && aiRun !== null
          ? { aiRunId: aiRun.id, routeKey: aiRun.routeKey, outputReference: row.outputReference }
          : null,
    },
    correlationId: row.correlationId,
  });
}

function data(
  key: string,
  employeeId: string,
  item: import("@evaluation/contracts").PreparedExperienceItem,
  outputReference: string,
) {
  return {
    id: item.id,
    employeeId,
    idempotencyKey: key,
    schemaVersion: item.schemaVersion,
    state: item.state,
    kind: item.kind,
    sourceReferences: [...item.sourceReferences],
    why: item.why,
    freshness: item.freshness,
    consequence: item.consequence,
    editableDraft: item.editableDraft,
    assistanceMode: item.assistance.mode,
    assistanceLabel: item.assistance.label,
    outputReference,
    correlationId: item.correlationId,
  };
}
