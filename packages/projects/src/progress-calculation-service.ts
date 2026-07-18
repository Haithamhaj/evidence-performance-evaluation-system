import { databaseAuditWriter } from "@evaluation/audit";
import {
  AppError,
  CalculateProgressInputSchema,
  OfficialProgressResultSchema,
  type AuditWriter,
  type ProgressContractComponent,
  type ProgressSourceFact,
} from "@evaluation/contracts";
import { z } from "zod";

import { calculateComponentPercent } from "./progress-contract-invariants.js";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type Transaction = import("@evaluation/database").DatabaseTransaction;

const CommandSchema = z
  .object({
    actor: z.object({ userId: z.string().uuid(), active: z.literal(true) }).strict(),
    correlationId: z.string().uuid(),
    contractId: z.string().uuid(),
    input: CalculateProgressInputSchema,
  })
  .strict();

type ComponentResult = Readonly<{
  component: ProgressContractComponent;
  percent: number;
  source: ProgressSourceFact;
}>;

export class ProgressCalculationService {
  private readonly client: DatabaseClient;
  private readonly auditWriter: AuditWriter<Transaction>;
  private readonly clock: () => Date;

  constructor(client: DatabaseClient, auditWriter: AuditWriter<Transaction>, clock: () => Date) {
    this.client = client;
    this.auditWriter = auditWriter;
    this.clock = clock;
  }

  async calculate(
    command: unknown,
  ): Promise<import("@evaluation/contracts").OfficialProgressResult> {
    const parsed = CommandSchema.parse(command);
    validNow(this.clock);
    const asOf = new Date(parsed.input.asOf);
    return this.client.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`
          SELECT id FROM "ProgressContract"
          WHERE id = ${parsed.contractId}::uuid
          FOR UPDATE
        `;
        const contract = await transaction.progressContract.findUnique({
          where: { id: parsed.contractId },
          include: { components: { orderBy: { position: "asc" } } },
        });
        if (contract === null)
          throw new AppError(
            "PROGRESS_CONTRACT_NOT_FOUND",
            "errors.progressContract.notFound",
            404,
          );
        if (contract.state !== "active")
          throw new AppError(
            "PROGRESS_CONTRACT_STATE_INVALID",
            "errors.progressContract.stateInvalid",
            409,
          );
        if (contract.contractVersion !== parsed.input.expectedContractVersion)
          throw new AppError(
            "PROGRESS_CONTRACT_VERSION_CONFLICT",
            "errors.progressContract.versionConflict",
            409,
          );
        await assertAuthorized(transaction, parsed.actor.userId, contract, asOf);
        const previous = await transaction.progressSnapshot.findFirst({
          where: { contractId: contract.id, createdAt: { lte: asOf } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { percent: true },
        });
        const previousPercent = previous === null ? 0 : Number(previous.percent);
        const results = resolveComponents(contract.components, parsed.input.sources);
        const missing = contract.components
          .filter((component) => !results.has(component.id))
          .map((component) => component.name);
        if (missing.length > 0) {
          return OfficialProgressResultSchema.parse({
            state: "awaiting_information",
            previousPercent,
            missing,
          });
        }

        const ordered = contract.components.map((component) => results.get(component.id)!);
        const percent =
          contract.calculationKind === "weighted"
            ? weightedPercent(ordered)
            : stageGatePercent(ordered);
        const snapshot = await transaction.progressSnapshot.create({
          data: {
            contractId: contract.id,
            contractVersion: contract.contractVersion,
            previousPercent,
            percent,
            componentState: ordered.map(({ component, percent: componentPercent }) => ({
              componentId: component.id,
              percent: componentPercent,
            })),
            calculationSchemaVersion: contract.calculationSchemaVersion,
            reason: parsed.input.reason,
            correlationId: parsed.correlationId,
            actorId: parsed.actor.userId,
            sources: {
              create: ordered.map(({ component, source }) => ({
                componentId: component.id,
                sourceKind: source.sourceKind,
                sourceId: source.sourceId,
                sourceVersion: source.sourceVersion,
                measuredValue: source.measuredValue,
                satisfied: source.satisfied,
                observedAt: new Date(source.observedAt),
              })),
            },
          },
        });
        await this.auditWriter.append(transaction, {
          eventType: "progress_snapshot.accepted",
          actor: { kind: "human", id: parsed.actor.userId },
          effectiveSubjectId: parsed.actor.userId,
          scopeType: contract.scopeKind,
          scopeId: contract.workstreamId ?? contract.projectId,
          targetType: "progress_snapshot",
          targetId: snapshot.id,
          reason: parsed.input.reason,
          safeDiff: {
            contractId: contract.id,
            contractVersion: contract.contractVersion,
            previousPercent,
            percent,
            sourceCount: ordered.length,
          },
          correlationId: parsed.correlationId,
          source: "api",
        });
        return OfficialProgressResultSchema.parse({
          state: "accepted",
          snapshotId: snapshot.id,
          previousPercent,
          percent,
        });
      },
      { isolationLevel: "Serializable" },
    );
  }
}

function resolveComponents(
  rows: readonly any[],
  sources: readonly ProgressSourceFact[],
): Map<string, ComponentResult> {
  const results = new Map<string, ComponentResult>();
  for (const row of rows) {
    const component = toComponent(row);
    const eligible = sources
      .filter(
        (source) =>
          source.componentId === component.id &&
          (component.confirmationMode === "measured"
            ? source.sourceKind === "kpi_measurement" && source.measuredValue !== null
            : source.sourceKind === "human_confirmation" && source.satisfied !== null),
      )
      .sort((left, right) => right.observedAt.localeCompare(left.observedAt));
    const source = eligible[0];
    if (source === undefined) continue;
    const percent =
      component.confirmationMode === "measured"
        ? calculateComponentPercent(component, source.measuredValue!)
        : source.satisfied
          ? 100
          : 0;
    results.set(component.id, { component, percent, source });
  }
  return results;
}

function weightedPercent(results: readonly ComponentResult[]): number {
  const value = results.reduce(
    (sum, result) => sum + result.percent * ((result.component.weight ?? 0) / 100),
    0,
  );
  return roundPercent(value);
}

function stageGatePercent(results: readonly ComponentResult[]): number {
  let passed = 0;
  for (const result of results) {
    if (result.percent < 100) break;
    passed += 1;
  }
  return roundPercent((passed / results.length) * 100);
}

function roundPercent(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function toComponent(row: any): ProgressContractComponent {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    description: row.description,
    weight: row.weight === null ? null : Number(row.weight),
    baseline: row.baseline === null ? null : Number(row.baseline),
    target: row.target === null ? null : Number(row.target),
    unit: row.unit,
    direction: row.direction,
    acceptanceConditions: row.acceptanceConditions,
    requiredEvidence: row.requiredEvidence,
    confirmationMode: row.confirmationMode,
  };
}

async function assertAuthorized(
  transaction: Transaction,
  actorId: string,
  contract: Readonly<{
    ownerId: string;
    projectId: string;
    workstreamId: string | null;
  }>,
  at: Date,
): Promise<void> {
  if (contract.ownerId === actorId) return;
  const member = await transaction.projectMember.findFirst({
    where: {
      projectId: contract.projectId,
      employeeId: actorId,
      startsAt: { lte: at },
      OR: [{ endsAt: null }, { endsAt: { gt: at } }],
      ...(contract.workstreamId === null
        ? {}
        : {
            employee: {
              workstreamMemberships: {
                some: {
                  workstreamId: contract.workstreamId,
                  startsAt: { lte: at },
                  OR: [{ endsAt: null }, { endsAt: { gt: at } }],
                },
              },
            },
          }),
    },
    select: { id: true },
  });
  if (member === null)
    throw new AppError("PROGRESS_CONTRACT_FORBIDDEN", "errors.common.forbidden", 403);
}

function validNow(clock: () => Date): Date {
  const now = clock();
  if (!Number.isFinite(now.getTime()))
    throw new AppError("PROGRESS_CONTRACT_CLOCK_INVALID", "errors.common.clockInvalid", 500);
  return now;
}

export function createProgressCalculationService(
  client: DatabaseClient,
  writer: AuditWriter<Transaction> = databaseAuditWriter as AuditWriter<Transaction>,
  clock: () => Date = () => new Date(),
): ProgressCalculationService {
  return new ProgressCalculationService(client, writer, clock);
}
