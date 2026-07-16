import { Writable } from "node:stream";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "../../packages/database/src/index.js";
import {
  createCorrelationCarrier,
  createLogger,
  currentCorrelation,
  runWithCorrelation,
} from "../../packages/observability/src/index.js";
import { CorrelationMiddleware } from "../../apps/api/src/platform/correlation.middleware.js";
import { createWebCorrelationHeaders } from "../../apps/web/src/platform/correlation.js";
import {
  closeQueueRuntime,
  createQueueRuntime,
  enqueueJob,
} from "../../apps/worker/src/queue/queue.module.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const organizationId = crypto.randomUUID();
const correlationId = crypto.randomUUID();

function captureLogger(name: string) {
  const lines: string[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });
  return { lines, logger: createLogger({ destination, name }) };
}

beforeAll(async () => {
  await database.organization.create({
    data: { id: organizationId, key: `correlation-${organizationId}`, name: "Correlation Test" },
  });
});

afterAll(async () => {
  await database.operation.deleteMany({ where: { organizationId } });
  await database.organization.delete({ where: { id: organizationId } });
  await database.$disconnect();
});

describe("real queued correlation propagation", () => {
  it("preserves Web -> API -> Redis/BullMQ -> Worker correlation in sanitized sinks", async () => {
    const api = captureLogger("api");
    const worker = captureLogger("worker");
    const input = {
      jobVersion: 1,
      jobType: "correlation.test",
      operationId: crypto.randomUUID(),
      correlationId,
      trace: { traceId: "0123456789abcdef0123456789abcdef", spanId: "0123456789abcdef" },
      scope: { organizationId },
      idempotencyKey: `correlation.test:${crypto.randomUUID()}`,
      payload: { uploadedContent: "private-worker-content" },
    };
    const runtime = createQueueRuntime({
      database,
      jobType: input.jobType,
      jobVersion: 1,
      logger: worker.logger,
      redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
      processor: async () => {
        worker.logger.info({ uploadedContent: "private-worker-content" }, "worker processing");
        expect(currentCorrelation()).toMatchObject({ correlationId, ...input.trace });
        return "result:correlation";
      },
    });

    try {
      const headers = createWebCorrelationHeaders({ "x-correlation-id": correlationId });
      let completion: Promise<string> | undefined;
      new CorrelationMiddleware().use(
        { headers: { "x-correlation-id": headers.get("x-correlation-id") } },
        { setHeader: () => undefined },
        () => {
          runWithCorrelation(createCorrelationCarrier(correlationId, input.trace), () => {
            api.logger.info({ rawPrompt: "private-api-content" }, "enqueue");
            completion = enqueueJob(runtime, input);
          });
        },
      );
      await expect(completion).resolves.toBe("result:correlation");

      for (const output of [api.lines.join("\n"), worker.lines.join("\n")]) {
        expect(output).toContain(correlationId);
        expect(output).not.toMatch(/private-api-content|private-worker-content/u);
      }
    } finally {
      await closeQueueRuntime(runtime);
    }
  });
});
