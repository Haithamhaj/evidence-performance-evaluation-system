import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "./index.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const ownedTables = [
  "CoachingInsight",
  "CoachingInsightRevision",
  "CoachingInsightSource",
  "CoachingInsightDecision",
  "DevelopmentAction",
  "DevelopmentActionRevision",
  "DevelopmentActionTransition",
  "ManagerSupportEntry",
  "FormalDevelopmentPlan",
  "FormalDevelopmentPlanRevision",
  "FormalDevelopmentPlanAgreement",
  "FormalDevelopmentPlanTransition",
  "FormalDevelopmentPlanEvidenceLink",
] as const;

afterAll(async () => client.$disconnect());

describe("coaching development schema", () => {
  it("creates retained insight, action, support, and formal-plan history", async () => {
    const tables = await client.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY(${ownedTables}::text[])
    `;
    expect(tables.map(({ table_name }) => table_name)).toEqual(
      expect.arrayContaining([...ownedTables]),
    );
  });
});
