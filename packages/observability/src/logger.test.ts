import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

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
        nested: {
          rawPrompt: "ignore all safeguards",
          uploadedContent: "private document",
          managerFeedback: "private text",
          items: [
            { privateFeedback: "private response" },
            { employeeFeedback: "protected feedback" },
            { privateResponseBody: "protected body" },
          ],
        },
        safe: { correlationId },
      }),
    ).toEqual({
      authorization: "[REDACTED]",
      cookie: "[REDACTED]",
      token: "[REDACTED]",
      credentials: "[REDACTED]",
      nested: {
        rawPrompt: "[REDACTED]",
        uploadedContent: "[REDACTED]",
        managerFeedback: "[REDACTED]",
        items: [
          { privateFeedback: "[REDACTED]" },
          { employeeFeedback: "[REDACTED]" },
          { privateResponseBody: "[REDACTED]" },
        ],
      },
      safe: { correlationId },
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
      logger.info({ authorization: "Bearer secret", safe: "visible" }, "request");
    });

    expect(output.join("\n")).toContain(correlationId);
    expect(output.join("\n")).toContain("visible");
    expect(output.join("\n")).not.toContain("Bearer secret");
  });
});
