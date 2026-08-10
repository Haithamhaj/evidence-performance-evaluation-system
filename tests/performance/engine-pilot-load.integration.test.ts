import { performance } from "node:perf_hooks";

import { queryAuditEvents } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";
import { BullNotificationDeliveryQueue } from "@evaluation/notifications";
import { Queue } from "bullmq";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://evaluation_test:local-evaluation-test-password@127.0.0.1:5432/evaluation_test";
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379/0";
const database = createDatabaseClient(databaseUrl);

function p95(values: readonly number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.ceil(ordered.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
}

describe("pilot engine representative database and queue load", () => {
  beforeAll(async () => database.$connect());
  afterAll(async () => database.$disconnect());

  it("handles concurrent reads, large protected history, pagination, and queue pressure", async () => {
    const concurrentDurations: number[] = [];
    await Promise.all(
      Array.from({ length: 20 }, async () => {
        const started = performance.now();
        const [users, projects, timelineRows, reportRows] = await Promise.all([
          database.user.findMany({ select: { id: true }, take: 25, orderBy: { id: "asc" } }),
          database.project.findMany({ select: { id: true }, take: 25, orderBy: { id: "asc" } }),
          database.acceptedUpdateEvent.findMany({
            select: { id: true },
            take: 25,
            orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
          }),
          database.exportManifest.findMany({
            select: { id: true },
            take: 25,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          }),
        ]);
        expect([users, projects, timelineRows, reportRows].every(Array.isArray)).toBe(true);
        concurrentDurations.push(performance.now() - started);
      }),
    );

    const rollback = new Error("ROLLBACK_ENGINE_LOAD_FIXTURE");
    const historyDurations: number[] = [];
    await expect(
      database.$transaction(
        async (transaction) => {
          const base = Date.now();
          await transaction.auditEvent.createMany({
            data: Array.from({ length: 1_200 }, (_, index) => ({
              id: crypto.randomUUID(),
              eventType: "test.load_probe",
              actorKind: "service",
              actorId: "bootstrap",
              effectiveSubjectId: crypto.randomUUID(),
              scopeType: "system",
              scopeId: crypto.randomUUID(),
              targetType: "engine_load_probe",
              targetId: crypto.randomUUID(),
              reason: "Isolated load verification",
              safeDiff: { fixture: true },
              correlationId: crypto.randomUUID(),
              source: "seed",
              createdAt: new Date(base + index),
            })),
          });
          let cursor: string | undefined;
          let observed = 0;
          do {
            const started = performance.now();
            const page = await queryAuditEvents(transaction, {
              eventType: "test.load_probe",
              cursor,
              limit: 100,
            });
            historyDurations.push(performance.now() - started);
            observed += page.items.length;
            cursor = page.nextCursor ?? undefined;
          } while (cursor !== undefined);
          expect(observed).toBe(1_200);
          throw rollback;
        },
        { timeout: 30_000 },
      ),
    ).rejects.toBe(rollback);

    const queueUrl = new URL(redisUrl);
    const queue = new Queue(`engine-load-${crypto.randomUUID()}`, {
      connection: {
        host: queueUrl.hostname,
        port: queueUrl.port === "" ? 6379 : Number(queueUrl.port),
        db: queueUrl.pathname.length > 1 ? Number(queueUrl.pathname.slice(1)) : 0,
      },
    });
    const delivery = new BullNotificationDeliveryQueue(queue);
    const queueStarted = performance.now();
    try {
      await Promise.all(
        Array.from({ length: 100 }, () =>
          delivery.enqueue({ intentId: crypto.randomUUID(), correlationId: crypto.randomUUID() }),
        ),
      );
      expect(await queue.getJobCountByTypes("waiting", "delayed")).toBe(100);
    } finally {
      await queue.obliterate({ force: true });
      await delivery.close();
    }

    expect(p95(concurrentDurations)).toBeLessThan(2_000);
    expect(p95(historyDurations)).toBeLessThan(500);
    expect(performance.now() - queueStarted).toBeLessThan(5_000);
  });
});
