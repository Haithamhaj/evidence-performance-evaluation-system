import { createDatabaseClient } from "@evaluation/database";
import { afterAll, describe, expect, it } from "vitest";

import { seedOperationsAcceptance } from "./seed-operations-acceptance.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

afterAll(async () => database.$disconnect());

describe.sequential("operations acceptance seed", () => {
  it("is rerunnable and proves dedupe, recovery, protected export, and safe degraded health", async () => {
    const first = await seedOperationsAcceptance();
    const before = await counts(first);
    const second = await seedOperationsAcceptance();

    expect(second.notifications.checkInIntentId).toBe(first.notifications.checkInIntentId);
    expect(second.notifications).toMatchObject({
      deduplicated: true,
      emailState: "RETRY_SCHEDULED",
    });
    expect(second.report).toMatchObject({
      artifactId: first.report.artifactId,
      encrypted: true,
      revoked: { allowed: false, reason: "REVOKED" },
    });
    expect(second.health).toMatchObject({
      state: "DEGRADED",
      connector: {
        dependency: "CONNECTOR",
        state: "DEGRADED",
        nextActionKey: "admin.health.reconnectProvider",
      },
    });
    expect(JSON.stringify(second)).not.toMatch(
      /employeeScore|productivityScore|recommendedRating|databaseUrl|accessToken|secret/iu,
    );
    await expect(counts(second)).resolves.toEqual(before);
  });
});

async function counts(input: Awaited<ReturnType<typeof seedOperationsAcceptance>>) {
  return {
    checkInIntents: await database.notificationIntent.count({
      where: { id: input.notifications.checkInIntentId },
    }),
    criticalIntents: await database.notificationIntent.count({
      where: { id: input.notifications.criticalReassignmentIntentId },
    }),
    retryAttempts: await database.notificationDeliveryAttempt.count({
      where: {
        intentId: input.notifications.checkInIntentId,
        channel: "EMAIL",
        state: "RETRY_SCHEDULED",
      },
    }),
    artifacts: await database.exportArtifact.count({ where: { id: input.report.artifactId } }),
    revocations: await database.exportRevocation.count({
      where: { artifactId: input.report.artifactId },
    }),
  };
}
