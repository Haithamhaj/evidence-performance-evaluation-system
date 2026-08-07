import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@evaluation/database";

import { seedContinuityAcceptance } from "./seed-continuity-acceptance.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

afterAll(async () => database.$disconnect());

describe("continuity acceptance seed", () => {
  it("is rerunnable and completes the real leave-to-reassignment journey", async () => {
    const ids = await seedContinuityAcceptance(database);
    await seedContinuityAcceptance(database);
    const [
      leave,
      handoverCount,
      handoverConfirmationCount,
      delegation,
      confirmationCount,
      returnRecord,
      owner,
      resolvedCase,
      queueItem,
      successorWindow,
    ] = await Promise.all([
      database.leaveRecord.findUniqueOrThrow({ where: { id: ids.leave } }),
      database.handoverRevision.count({ where: { handoverId: ids.handover } }),
      database.handoverConfirmation.count({ where: { handoverId: ids.handover } }),
      database.delegation.findUniqueOrThrow({
        where: { id: ids.delegation },
        include: { periods: true, scopes: true },
      }),
      database.delegateConfirmation.count({ where: { delegationId: ids.delegation } }),
      database.returnHandover.findUniqueOrThrow({ where: { id: ids.return } }),
      database.user.findUniqueOrThrow({ where: { id: ids.owner } }),
      database.reassignmentRequiredCase.findFirstOrThrow({
        where: { formerOwnerId: ids.owner, state: "RESOLVED" },
      }),
      database.reassignmentQueueItem.findFirstOrThrow({
        where: { case: { formerOwnerId: ids.owner } },
      }),
      database.responsibilityWindow.findFirstOrThrow({
        where: {
          projectId: ids.project,
          employeeId: ids.successor,
          responsibilityType: "permanent",
          endsAt: null,
        },
      }),
    ]);
    expect(leave.state).toBe("APPROVED");
    expect(handoverCount).toBe(1);
    expect(handoverConfirmationCount).toBe(1);
    expect(delegation).toMatchObject({ state: "RETURNED", emergency: false });
    expect(delegation.periods).toHaveLength(1);
    expect(delegation.scopes).toEqual([
      expect.objectContaining({
        projectId: ids.project,
        action: "project.update",
        responsibilityWindowId: expect.any(String),
      }),
    ]);
    expect(confirmationCount).toBe(1);
    expect(returnRecord).toMatchObject({ state: "FINALIZED", choice: "RETURN" });
    expect(owner.active).toBe(false);
    expect(resolvedCase.state).toBe("RESOLVED");
    expect(queueItem.state).toBe("RESOLVED");
    expect(successorWindow.startsAt.toISOString()).toBe("2026-08-11T13:00:00.000Z");
  });
});
