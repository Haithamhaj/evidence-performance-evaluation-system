import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@evaluation/database";
import { PrismaContinuityPersistence } from "@evaluation/continuity";

import { seedContinuityAcceptance } from "./seed-continuity-acceptance.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

afterAll(async () => database.$disconnect());

describe.sequential("continuity acceptance seed", () => {
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
      emergencyDelegation,
      emergencyAuditCount,
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
      database.delegation.findUniqueOrThrow({ where: { id: ids.emergencyDelegation } }),
      database.auditEvent.count({
        where: {
          targetId: ids.emergencyDelegation,
          eventType: {
            in: [
              "continuity.delegation.emergency_approved",
              "continuity.delegation.emergency_activated",
              "continuity.delegation.expired",
            ],
          },
        },
      }),
    ]);
    expect(leave.state).toBe("APPROVED");
    expect(handoverCount).toBe(1);
    expect(handoverConfirmationCount).toBe(1);
    expect(delegation).toMatchObject({ state: "RETURNED", emergency: false });
    expect(delegation.periods).toHaveLength(2);
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
    expect(successorWindow.startsAt.toISOString()).toBe("2026-08-12T15:00:00.000Z");
    expect(emergencyDelegation).toMatchObject({ state: "EXPIRED", emergency: true });
    expect(emergencyAuditCount).toBe(3);
  });

  it("rolls back deactivation when continuity-case creation fails, then succeeds atomically", async () => {
    const ids = await seedContinuityAcceptance(database);
    const persistence = new PrismaContinuityPersistence(database);
    const correlationId = crypto.randomUUID();
    await database.user.update({ where: { id: ids.successor }, data: { active: true } });

    await expect(
      persistence.deactivateWithContinuity(
        {
          administratorId: ids.administrator,
          userId: ids.successor,
          occurredAt: "2026-08-13T14:00:00.000Z",
          correlationId,
        },
        async () => {
          throw new Error("injected failure after authentication disable");
        },
      ),
    ).rejects.toThrow("injected failure");
    await expect(
      database.user.findUniqueOrThrow({ where: { id: ids.successor } }),
    ).resolves.toMatchObject({ active: true });
    await expect(
      database.deactivationReceipt.findUnique({ where: { idempotencyKey: correlationId } }),
    ).resolves.toBeNull();

    const completed = await persistence.deactivateWithContinuity({
      administratorId: ids.administrator,
      userId: ids.successor,
      occurredAt: "2026-08-13T14:00:00.000Z",
      correlationId,
    });
    expect(completed.reassignmentCaseIds).toHaveLength(1);
    await expect(
      database.user.findUniqueOrThrow({ where: { id: ids.successor } }),
    ).resolves.toMatchObject({ active: false });
    await expect(
      database.reassignmentQueueItem.findFirst({
        where: { caseId: { in: [...completed.reassignmentCaseIds] } },
      }),
    ).resolves.toMatchObject({ state: "REASSIGNMENT_REQUIRED" });
  });
});
