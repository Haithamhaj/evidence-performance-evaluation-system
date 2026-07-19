import { describe, expect, it, vi } from "vitest";

import { ProgressCalculationService } from "./progress-calculation-service.js";

function harness(previousPercent = 75, includeDeterministic = false) {
  const actorId = crypto.randomUUID();
  const contractId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const measuredId = crypto.randomUUID();
  const confirmedId = crypto.randomUUID();
  const deterministicId = crypto.randomUUID();
  const components = [
    {
      id: measuredId,
      contractId,
      position: 0,
      kind: "kpi",
      name: "Coverage",
      description: "Accepted scenarios covered",
      weight: 50,
      baseline: 0,
      target: 100,
      unit: "percent",
      direction: "increase",
      acceptanceConditions: ["Measurement is source-supported"],
      requiredEvidence: ["Test report"],
      confirmationMode: "measured",
    },
    {
      id: confirmedId,
      contractId,
      position: 1,
      kind: "milestone",
      name: "Owner acceptance",
      description: "The owner accepted the milestone",
      weight: 50,
      baseline: null,
      target: null,
      unit: null,
      direction: null,
      acceptanceConditions: ["Owner confirms acceptance"],
      requiredEvidence: ["Acceptance record"],
      confirmationMode: "human_confirmed",
    },
  ];
  if (includeDeterministic) {
    components.push({
      id: deterministicId,
      contractId,
      position: 2,
      kind: "milestone",
      name: "Verified merge",
      description: "The approved repository condition is objectively verified.",
      weight: 0,
      baseline: null,
      target: null,
      unit: null,
      direction: null,
      acceptanceConditions: ["The approved deterministic source rule is satisfied"],
      requiredEvidence: ["Verified source event"],
      confirmationMode: "deterministic",
    });
  }
  const contract = {
    id: contractId,
    projectId,
    workstreamId: null,
    scopeKind: "project",
    state: "active",
    contractVersion: 1,
    version: 3,
    calculationKind: "weighted",
    calculationSchemaVersion: "1.0.0",
    ownerId: actorId,
    components,
  };
  const create = vi.fn(async ({ data }: any) => ({
    ...data,
    id: crypto.randomUUID(),
    previousPercent,
    percent: data.percent,
  }));
  const transaction = {
    $queryRaw: vi.fn(async () => []),
    progressContract: { findUnique: vi.fn(async () => contract) },
    progressSnapshot: {
      findFirst: vi.fn(async () => (previousPercent === 0 ? null : { percent: previousPercent })),
      create,
    },
    projectMember: { findFirst: vi.fn(async () => ({ id: crypto.randomUUID() })) },
  };
  const database = {
    $transaction: vi.fn(async (operation: (tx: any) => Promise<unknown>) => operation(transaction)),
  };
  const auditWriter = { append: vi.fn(async () => ({ id: crypto.randomUUID() })) };
  return {
    actorId,
    contractId,
    measuredId,
    confirmedId,
    deterministicId,
    create,
    auditWriter,
    service: new ProgressCalculationService(
      database as never,
      auditWriter as never,
      () => new Date("2026-07-18T12:00:00.000Z"),
    ),
  };
}

function source(
  componentId: string,
  values: Readonly<{ measuredValue: number | null; satisfied: boolean | null }>,
) {
  return {
    componentId,
    sourceKind:
      values.measuredValue === null
        ? ("human_confirmation" as const)
        : ("kpi_measurement" as const),
    sourceId: crypto.randomUUID(),
    sourceVersion: 1,
    measuredValue: values.measuredValue,
    satisfied: values.satisfied,
    observedAt: "2026-07-18T11:00:00.000Z",
  };
}

function command(context: ReturnType<typeof harness>, sources: readonly unknown[]) {
  return {
    actor: { userId: context.actorId, active: true },
    correlationId: crypto.randomUUID(),
    contractId: context.contractId,
    input: {
      expectedContractVersion: 1,
      asOf: "2026-07-18T12:00:00.000Z",
      reason: "Recalculate from confirmed sources.",
      sources,
    },
  };
}

describe("ProgressCalculationService", () => {
  it("retains the previous official percentage when required coverage is missing", async () => {
    const context = harness();
    const result = await context.service.calculate(
      command(context, [source(context.measuredId, { measuredValue: 80, satisfied: null })]),
    );

    expect(result).toEqual({
      state: "awaiting_information",
      previousPercent: 75,
      missing: ["Owner acceptance"],
    });
    expect(context.create).not.toHaveBeenCalled();
  });

  it("creates an append-only, source-linked weighted snapshot", async () => {
    const context = harness(0);
    const result = await context.service.calculate(
      command(context, [
        source(context.measuredId, { measuredValue: 80, satisfied: null }),
        source(context.confirmedId, { measuredValue: null, satisfied: true }),
      ]),
    );

    expect(result).toMatchObject({ state: "accepted", previousPercent: 0, percent: 90 });
    expect(context.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          percent: 90,
          sources: {
            create: expect.arrayContaining([
              expect.objectContaining({ componentId: context.measuredId }),
            ]),
          },
        }),
      }),
    );
  });

  it("accepts a source-explained decrease without a direct percentage override", async () => {
    const context = harness(75);
    const result = await context.service.calculate(
      command(context, [
        source(context.measuredId, { measuredValue: 20, satisfied: null }),
        source(context.confirmedId, { measuredValue: null, satisfied: true }),
      ]),
    );

    expect(result).toMatchObject({ state: "accepted", previousPercent: 75, percent: 60 });
    expect(context.auditWriter.append).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        safeDiff: expect.objectContaining({ previousPercent: 75, percent: 60 }),
      }),
    );
  });

  it("keeps deterministic components awaiting information until a verified resolver exists", async () => {
    const context = harness(75, true);
    const result = await context.service.calculate(
      command(context, [
        source(context.measuredId, { measuredValue: 80, satisfied: null }),
        source(context.confirmedId, { measuredValue: null, satisfied: true }),
        source(context.deterministicId, { measuredValue: null, satisfied: true }),
      ]),
    );

    expect(result).toEqual({
      state: "awaiting_information",
      previousPercent: 75,
      missing: ["Verified merge"],
    });
    expect(context.create).not.toHaveBeenCalled();
  });
});
