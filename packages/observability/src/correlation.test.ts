import { describe, expect, it } from "vitest";

import {
  CORRELATION_HEADER,
  createCorrelationCarrier,
  currentCorrelation,
  restoreCorrelationCarrier,
  runWithCorrelation,
  serializeCorrelationCarrier,
} from "./correlation.js";

const correlationId = "9a11bb8f-79f5-4a72-a98f-2e763e97699b";

describe("framework-neutral correlation carrier", () => {
  it("contains only a UUID correlation ID and optional trace fields", () => {
    const carrier = createCorrelationCarrier(correlationId, {
      traceId: "0af7651916cd43dd8448eb211c80319c",
      spanId: "b7ad6b7169203331",
    });

    expect(CORRELATION_HEADER).toBe("x-correlation-id");
    expect(serializeCorrelationCarrier(carrier)).toEqual({
      correlationId,
      traceId: "0af7651916cd43dd8448eb211c80319c",
      spanId: "b7ad6b7169203331",
    });
    expect(Object.isFrozen(carrier)).toBe(true);
  });

  it("rejects invalid identifiers and unknown carrier fields", () => {
    expect(() => createCorrelationCarrier("not-a-uuid")).toThrow();
    expect(() =>
      restoreCorrelationCarrier({ correlationId, token: "must-not-cross-processes" }),
    ).toThrow();
  });

  it("installs and restores context without a framework dependency", () => {
    const carrier = createCorrelationCarrier(correlationId);

    expect(currentCorrelation()).toBeUndefined();
    expect(runWithCorrelation(carrier, () => currentCorrelation())).toEqual(carrier);
    expect(currentCorrelation()).toBeUndefined();
  });
});
