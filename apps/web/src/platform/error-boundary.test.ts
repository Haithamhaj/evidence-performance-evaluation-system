import { describe, expect, it } from "vitest";

import { getSafeErrorCorrelationId } from "../app/[locale]/error.js";

describe("Web error correlation display", () => {
  it("returns only a valid UUID correlation ID", () => {
    expect(
      getSafeErrorCorrelationId({
        correlationId: "9a11bb8f-79f5-4a72-a98f-2e763e97699b",
      }),
    ).toBe("9a11bb8f-79f5-4a72-a98f-2e763e97699b");
    expect(getSafeErrorCorrelationId({ correlationId: "<script>private-token</script>" })).toBe(
      undefined,
    );
    expect(getSafeErrorCorrelationId({})).toBeUndefined();
  });
});
