import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@evaluation/database";

import { seedContinuityAcceptance } from "./seed-continuity-acceptance.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

afterAll(async () => database.$disconnect());

describe("continuity acceptance seed", () => {
  it("is rerunnable and persists the approved leave, handover, and active exact delegation", async () => {
    const ids = await seedContinuityAcceptance(database);
    await seedContinuityAcceptance(database);
    const [leave, handoverCount, delegation, confirmationCount] = await Promise.all([
      database.leaveRecord.findUniqueOrThrow({ where: { id: ids.leave } }),
      database.handoverRevision.count({ where: { handoverId: ids.handover } }),
      database.delegation.findUniqueOrThrow({
        where: { id: ids.delegation },
        include: { periods: true, scopes: true },
      }),
      database.delegateConfirmation.count({ where: { delegationId: ids.delegation } }),
    ]);
    expect(leave.state).toBe("APPROVED");
    expect(handoverCount).toBe(1);
    expect(delegation).toMatchObject({ state: "ACTIVE", emergency: false });
    expect(delegation.periods).toHaveLength(1);
    expect(delegation.scopes).toEqual([
      expect.objectContaining({ projectId: ids.project, action: "project.update" }),
    ]);
    expect(confirmationCount).toBe(1);
  });
});
