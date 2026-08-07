import { createDatabaseClient } from "@evaluation/database";
import { afterAll, describe, expect, it } from "vitest";

import { seedCoachingDevelopmentAcceptance } from "./seed-coaching-development-acceptance.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

afterAll(async () => database.$disconnect());

describe("coaching development acceptance seed", () => {
  it("is rerunnable without mutating append-only history and links real confirmed evidence", async () => {
    const first = await seedCoachingDevelopmentAcceptance(database);
    const before = await historyCounts(first);

    const second = await seedCoachingDevelopmentAcceptance(database);

    expect(second).toEqual(first);
    await expect(historyCounts(second)).resolves.toEqual(before);
    await expect(
      database.formalDevelopmentPlanEvidenceLink.findUniqueOrThrow({
        where: {
          planId_evidenceId: { planId: first.planId, evidenceId: first.evidenceId },
        },
        include: { evidence: { include: { confirmation: true } } },
      }),
    ).resolves.toMatchObject({
      confirmed: true,
      evidence: {
        employeeId: first.employeeId,
        state: "confirmed",
        confirmation: { employeeId: first.employeeId },
      },
    });
  });
});

async function historyCounts(input: { insightId: string; actionId: string; planId: string }) {
  const [
    insightRevisions,
    insightDecisions,
    actionRevisions,
    actionTransitions,
    planRevisions,
    agreements,
    planTransitions,
  ] = await Promise.all([
    database.coachingInsightRevision.count({ where: { insightId: input.insightId } }),
    database.coachingInsightDecision.count({ where: { insightId: input.insightId } }),
    database.developmentActionRevision.count({ where: { actionId: input.actionId } }),
    database.developmentActionTransition.count({ where: { actionId: input.actionId } }),
    database.formalDevelopmentPlanRevision.count({ where: { planId: input.planId } }),
    database.formalDevelopmentPlanAgreement.count({ where: { planId: input.planId } }),
    database.formalDevelopmentPlanTransition.count({ where: { planId: input.planId } }),
  ]);
  return {
    insightRevisions,
    insightDecisions,
    actionRevisions,
    actionTransitions,
    planRevisions,
    agreements,
    planTransitions,
  };
}
