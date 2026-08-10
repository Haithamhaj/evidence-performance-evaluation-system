import { createHash, randomUUID } from "node:crypto";

import { afterAll, describe, expect, it, vi } from "vitest";

import { databaseAuditWriter } from "../../packages/audit/src/index.js";
import { createDatabaseClient } from "../../packages/database/src/index.js";
import { createNotificationDeliveryQueue } from "../../packages/notifications/src/delivery-queue.js";
import { AiRouterUpdateStructurer } from "../../packages/updates-evidence/src/ai-structurer.js";
import { UPDATE_STRUCTURE_TRUSTED_PROMPT } from "../../packages/updates-evidence/src/prompts.js";
import { PrivateInboxService } from "../../packages/work-items/src/inbox-service.js";

const client = createDatabaseClient(
  process.env.TEST_DATABASE_URL ??
    "postgresql://evaluation_test:local-evaluation-test-password@127.0.0.1:5432/evaluation_test",
);
const queues: Array<{ close(): Promise<unknown> }> = [];

afterAll(async () => {
  await Promise.all(queues.splice(0).map((queue) => queue.close()));
  await client.$disconnect();
});

describe("provider outage and idempotent recovery", () => {
  it("keeps the manual employee capture path available when AI is unavailable", async () => {
    const run = vi.fn().mockRejectedValue(new Error("AI provider unavailable"));
    const updateSourceId = randomUUID();
    const structurer = new AiRouterUpdateStructurer(
      { run } as never,
      {
        analysisPromptArtifact: {
          findUnique: vi.fn(async () => ({
            id: randomUUID(),
            bodyHash: createHash("sha256").update(UPDATE_STRUCTURE_TRUSTED_PROMPT).digest("hex"),
            trustedBody: UPDATE_STRUCTURE_TRUSTED_PROMPT,
          })),
        },
      } as never,
      { systemId: randomUUID(), timeoutMs: 1_000 },
    );
    await expect(
      structurer.structure(
        {
          projectScopeId: randomUUID(),
          departmentScopeId: randomUUID(),
          correlationId: randomUUID(),
          updateSourceId,
          rawText: "Continue manually during provider outage.",
          answers: [],
          previousAcceptedState: null,
          activeContract: null,
          sourceReferences: [`update-source:${updateSourceId}`],
        },
        vi.fn(),
      ),
    ).rejects.toThrow("AI provider unavailable");
    expect(run).toHaveBeenCalledOnce();

    const createdAt = new Date("2026-08-07T00:00:00.000Z");
    const employeeId = randomUUID();
    const correlationId = randomUUID();
    const captureText = "Follow up manually while AI assistance is unavailable.";
    await client.user.create({
      data: {
        id: employeeId,
        email: `provider-outage-${employeeId}@example.invalid`,
        displayName: "Provider outage employee",
      },
    });
    const service = new PrivateInboxService(client, databaseAuditWriter as never, () => createdAt);

    const captured = await service.capture({
      actor: { userId: employeeId, active: true },
      correlationId,
      input: { text: captureText, projectId: null },
    });
    await expect(
      client.privateInboxItem.findUnique({ where: { id: captured.id } }),
    ).resolves.toMatchObject({ employeeId, text: captureText, status: "open" });
    await expect(
      client.auditEvent.findFirst({
        where: { correlationId, eventType: "private_inbox.captured" },
      }),
    ).resolves.toMatchObject({ targetId: captured.id, actorId: employeeId });
  });

  it("returns the same effect receipt when the same delivery envelope is replayed", async () => {
    const queue = createNotificationDeliveryQueue(
      process.env.REDIS_URL ?? "redis://127.0.0.1:6379/0",
    );
    queues.push(queue);
    const envelope = {
      intentId: randomUUID(),
      correlationId: randomUUID(),
    };

    const first = await queue.enqueue(envelope);
    const replay = await queue.enqueue(envelope);

    expect(replay).toEqual(first);
    expect(first.jobId).toBe(envelope.intentId);
  });
});
