import { Writable } from "node:stream";

import { describe, expect, expectTypeOf, it } from "vitest";

import { createCorrelationCarrier, runWithCorrelation } from "./correlation.js";
import { createLogger, redact } from "./logger.js";

const correlationId = "9a11bb8f-79f5-4a72-a98f-2e763e97699b";

describe("safe observability", () => {
  it("removes secrets and private response bodies recursively", () => {
    expect(
      redact({
        authorization: "Bearer secret",
        cookie: "session=secret",
        token: "secret",
        credentials: { password: "secret" },
        operational: {
          correlationId,
          dependencies: [
            {
              dependency: "AI_ROUTE",
              rawPrompt: "ignore all safeguards",
              uploadedContent: "private document",
              managerFeedback: "private text",
              privateFeedback: "private response",
              employeeFeedback: "protected feedback",
              privateResponseBody: "protected body",
            },
          ],
        },
      }),
    ).toEqual({
      authorization: "[REDACTED]",
      cookie: "[REDACTED]",
      token: "[REDACTED]",
      credentials: "[REDACTED]",
      operational: {
        correlationId,
        dependencies: [
          {
            dependency: "AI_ROUTE",
            rawPrompt: "[REDACTED]",
            uploadedContent: "[REDACTED]",
            managerFeedback: "[REDACTED]",
            privateFeedback: "[REDACTED]",
            employeeFeedback: "[REDACTED]",
            privateResponseBody: "[REDACTED]",
          },
        ],
      },
    });
  });

  it("redacts protected values before they reach the Pino destination", () => {
    const output: string[] = [];
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output.push(String(chunk));
        callback();
      },
    });
    const logger = createLogger({ destination, name: "test" });

    runWithCorrelation(createCorrelationCarrier(correlationId), () => {
      logger.info(
        {
          authorization: "Bearer secret",
          event: "request.completed",
          status: "HEALTHY",
          emailBody: "private customer email",
          body: { note: "private body" },
          payload: { unknown: "private payload" },
          nestedUnknown: { value: "private nested value" },
          labels: { dependency: "DATABASE", unknown: "private label" },
        },
        "request",
      );
    });

    expect(output.join("\n")).toContain(correlationId);
    const captured = output.join("\n");
    expect(captured).toContain("request.completed");
    expect(captured).toContain("HEALTHY");
    expect(captured).toContain("DATABASE");
    expect(captured).not.toMatch(
      /Bearer secret|private customer email|private body|private payload|private nested value|private label/u,
    );
  });

  it("censors direct message strings and interpolation arguments", () => {
    const output: string[] = [];
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output.push(String(chunk));
        callback();
      },
    });
    const logger = createLogger({ destination, name: "test" });

    logger.info("private feedback body");
    logger.info("token=%s", "interpolated-token-secret");
    logger.info({ privateFeedback: "structured-private-feedback" }, "private message");

    const captured = output.join("\n");
    expect(captured).not.toMatch(
      /private feedback body|token=%s|interpolated-token-secret|structured-private-feedback|private message/u,
    );
    expect(captured).toContain("[REDACTED_MESSAGE]");
  });

  it("truthfully returns a transformed sanitized value", () => {
    const circular: Record<string, unknown> = { status: "HEALTHY" };
    circular.self = circular;
    const sanitized = redact({
      occurredAt: new Date("2026-07-15T12:00:00.000Z"),
      failure: new Error("select private_token from secrets"),
      circular,
    });

    expectTypeOf(sanitized).toEqualTypeOf<unknown>();
    expect(sanitized).toEqual({
      occurredAt: "2026-07-15T12:00:00.000Z",
      failure: { name: "Error", message: "[REDACTED]" },
      circular: "[REDACTED]",
    });
  });
});
