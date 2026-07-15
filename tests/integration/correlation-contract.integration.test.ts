import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import {
  CORRELATION_HEADER,
  createCorrelationCarrier,
  createLogger,
  currentCorrelation,
  runWithCorrelation,
  serializeCorrelationCarrier,
} from "../../packages/observability/src/index.js";
import { CorrelationMiddleware } from "../../apps/api/src/platform/correlation.middleware.js";
import { createWebCorrelationHeaders } from "../../apps/web/src/platform/correlation.js";
import { runWithWorkerCorrelation } from "../../apps/worker/src/platform/correlation.js";

const correlationId = "9a11bb8f-79f5-4a72-a98f-2e763e97699b";

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

describe("Web/API/Worker correlation carrier contract", () => {
  it("propagates one UUID and keeps every process log sink sanitized", () => {
    const web = captureLogger("web");
    const api = captureLogger("api");
    const worker = captureLogger("worker");

    const webHeaders = createWebCorrelationHeaders({ [CORRELATION_HEADER]: correlationId });
    expect(webHeaders.get(CORRELATION_HEADER)).toBe(correlationId);

    runWithCorrelation(createCorrelationCarrier(correlationId), () => {
      web.logger.info({ cookie: "web-session-secret" }, "forward request");
    });

    let serializedCarrier: ReturnType<typeof serializeCorrelationCarrier> | undefined;
    new CorrelationMiddleware().use(
      { headers: { [CORRELATION_HEADER]: webHeaders.get(CORRELATION_HEADER) } },
      { setHeader: (_name: string, _value: string) => undefined },
      () => {
        const carrier = currentCorrelation();
        expect(carrier?.correlationId).toBe(correlationId);
        api.logger.info({ rawPrompt: "api-private-prompt" }, "accept request");
        serializedCarrier = serializeCorrelationCarrier(carrier!);
      },
    );

    const workerCorrelation = runWithWorkerCorrelation(serializedCarrier, () => {
      worker.logger.info({ uploadedContent: "worker-private-file" }, "handle work");
      return currentCorrelation()?.correlationId;
    });
    expect(workerCorrelation).toBe(correlationId);

    for (const output of [web.lines.join("\n"), api.lines.join("\n"), worker.lines.join("\n")]) {
      expect(output).toContain(correlationId);
      expect(output).not.toMatch(/web-session-secret|api-private-prompt|worker-private-file/u);
    }
  });
});
