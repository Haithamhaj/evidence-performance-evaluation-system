import { describe, expect, it, vi } from "vitest";

import { CORRELATION_HEADER, currentCorrelation } from "@evaluation/observability";

import { CorrelationMiddleware } from "./correlation.middleware.js";

const correlationId = "9a11bb8f-79f5-4a72-a98f-2e763e97699b";

describe("CorrelationMiddleware", () => {
  it("restores and echoes a valid incoming correlation ID", () => {
    const setHeader = vi.fn();
    let observed: string | undefined;

    new CorrelationMiddleware().use(
      { headers: { [CORRELATION_HEADER]: correlationId } },
      { setHeader },
      () => {
        observed = currentCorrelation()?.correlationId;
      },
    );

    expect(observed).toBe(correlationId);
    expect(setHeader).toHaveBeenCalledWith(CORRELATION_HEADER, correlationId);
  });

  it("replaces an invalid incoming value with a UUID", () => {
    const setHeader = vi.fn();
    let observed: string | undefined;

    new CorrelationMiddleware().use(
      { headers: { [CORRELATION_HEADER]: "attacker-controlled" } },
      { setHeader },
      () => {
        observed = currentCorrelation()?.correlationId;
      },
    );

    expect(observed).toMatch(/^[0-9a-f-]{36}$/u);
    expect(setHeader).toHaveBeenCalledWith(CORRELATION_HEADER, observed);
  });
});
