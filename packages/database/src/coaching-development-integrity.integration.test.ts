import { createDatabaseClient } from "./index.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const employeeId = crypto.randomUUID();
const otherEmployeeId = crypto.randomUUID();
const insightId = crypto.randomUUID();
const otherInsightId = crypto.randomUUID();
const planId = crypto.randomUUID();
let revisionId = "";
let otherRevisionId = "";

beforeAll(async () => {
  const suffix = crypto.randomUUID();
  await database.user.createMany({
    data: [
      { id: employeeId, email: `coaching-integrity-${suffix}@test.invalid`, displayName: "Owner" },
      {
        id: otherEmployeeId,
        email: `coaching-integrity-other-${suffix}@test.invalid`,
        displayName: "Other Owner",
      },
    ],
  });
  await database.coachingInsight.createMany({
    data: [
      { id: insightId, employeeId },
      { id: otherInsightId, employeeId: otherEmployeeId },
    ],
  });
  await database.formalDevelopmentPlan.create({
    data: { id: planId, employeeId, managerId: otherEmployeeId },
  });
  const [revision, otherRevision] = await Promise.all([
    database.coachingInsightRevision.create({ data: insightRevision(insightId, employeeId) }),
    database.coachingInsightRevision.create({
      data: insightRevision(otherInsightId, otherEmployeeId),
    }),
  ]);
  revisionId = revision.id;
  otherRevisionId = otherRevision.id;
  await Promise.all([
    database.coachingInsight.update({
      where: { id: insightId },
      data: { currentRevisionId: revisionId },
    }),
    database.coachingInsight.update({
      where: { id: otherInsightId },
      data: { currentRevisionId: otherRevisionId },
    }),
  ]);
});

afterAll(async () => database.$disconnect());

describe("coaching development database integrity", () => {
  it("rejects mutation of append-only coaching history", async () => {
    const changed = await mutationSucceeded(
      () =>
        database.$executeRaw`UPDATE "CoachingInsightRevision" SET "pattern" = 'MUTATED' WHERE "id" = ${revisionId}::uuid`,
      () =>
        database.$executeRaw`UPDATE "CoachingInsightRevision" SET "pattern" = 'Original pattern' WHERE "id" = ${revisionId}::uuid`,
    );
    expect(changed).toBe(false);
    await expect(
      database.$executeRaw`DELETE FROM "CoachingInsightRevision" WHERE "id" = ${revisionId}::uuid`,
    ).rejects.toBeDefined();
  });

  it("rejects a current revision pointer owned by another insight", async () => {
    await database.coachingInsight.update({
      where: { id: otherInsightId },
      data: { currentRevisionId: null },
    });
    const changed = await mutationSucceeded(
      () =>
        database.$executeRaw`UPDATE "CoachingInsight" SET "currentRevisionId" = ${otherRevisionId}::uuid WHERE "id" = ${insightId}::uuid`,
      async () => {
        await database.$executeRaw`UPDATE "CoachingInsight" SET "currentRevisionId" = ${revisionId}::uuid WHERE "id" = ${insightId}::uuid`;
        await database.$executeRaw`UPDATE "CoachingInsight" SET "currentRevisionId" = ${otherRevisionId}::uuid WHERE "id" = ${otherInsightId}::uuid`;
      },
    );
    expect(changed).toBe(false);
  });

  it("rejects orphan source and AI-run references", async () => {
    const sourceId = crypto.randomUUID();
    const orphanRevisionId = crypto.randomUUID();
    const sourceInserted = await mutationSucceeded(
      () =>
        database.$executeRaw`
          INSERT INTO "CoachingInsightSource" ("id", "insightId", "revisionId", "sourceId", "sourceKind", "position")
          VALUES (${sourceId}::uuid, ${insightId}::uuid, ${orphanRevisionId}::uuid, ${crypto.randomUUID()}::uuid, 'EVIDENCE', 0)
        `,
      () =>
        database.$executeRaw`DELETE FROM "CoachingInsightSource" WHERE "id" = ${sourceId}::uuid`,
    );
    const aiRevisionId = crypto.randomUUID();
    const aiInserted = await mutationSucceeded(
      () =>
        database.$executeRaw`
          INSERT INTO "CoachingInsightRevision"
            ("id", "insightId", "revision", "pattern", "periodStartsAt", "periodEndsAt", "confidence", "confidenceBasis", "limitations", "conflicts", "cannotConclude", "aiRunId", "createdById")
          VALUES
            (${aiRevisionId}::uuid, ${insightId}::uuid, 2, 'AI pattern', now(), now(), 'LIMITED', 'One source', '[]'::jsonb, '[]'::jsonb, 'Cannot infer performance rating.', ${crypto.randomUUID()}::uuid, ${employeeId}::uuid)
        `,
      () =>
        database.$executeRaw`DELETE FROM "CoachingInsightRevision" WHERE "id" = ${aiRevisionId}::uuid`,
    );
    const evidenceLinkId = crypto.randomUUID();
    const evidenceInserted = await mutationSucceeded(
      () =>
        database.$executeRaw`
          INSERT INTO "FormalDevelopmentPlanEvidenceLink" ("id", "planId", "evidenceId")
          VALUES (${evidenceLinkId}::uuid, ${planId}::uuid, ${crypto.randomUUID()}::uuid)
        `,
      () =>
        database.$executeRaw`DELETE FROM "FormalDevelopmentPlanEvidenceLink" WHERE "id" = ${evidenceLinkId}::uuid`,
    );
    expect({ sourceInserted, aiInserted, evidenceInserted }).toEqual({
      sourceInserted: false,
      aiInserted: false,
      evidenceInserted: false,
    });
  });

  it("rejects duplicate resulting versions", async () => {
    const firstKey = crypto.randomUUID();
    const secondKey = crypto.randomUUID();
    await database.coachingInsightDecision.create({
      data: {
        idempotencyKey: firstKey,
        insightId,
        employeeId,
        decision: "ACCEPT",
        resultingVersion: 2,
      },
    });
    await expect(
      database.coachingInsightDecision.create({
        data: {
          idempotencyKey: secondKey,
          insightId,
          employeeId,
          decision: "DEFER",
          resultingVersion: 2,
        },
      }),
    ).rejects.toBeDefined();
  });
});

function insightRevision(insight: string, author: string) {
  return {
    insightId: insight,
    revision: 1,
    pattern: "Original pattern",
    periodStartsAt: new Date("2026-07-01T00:00:00Z"),
    periodEndsAt: new Date("2026-08-01T00:00:00Z"),
    confidence: "LIMITED" as const,
    confidenceBasis: "One source",
    limitations: ["Cannot infer performance rating."],
    conflicts: [],
    cannotConclude: "Cannot infer performance rating.",
    createdById: author,
  };
}

async function mutationSucceeded(change: () => Promise<unknown>, restore: () => Promise<unknown>) {
  try {
    await change();
    await restore();
    return true;
  } catch {
    return false;
  }
}
