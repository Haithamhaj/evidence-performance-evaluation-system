import { describe, expect, it } from "vitest";

import { redactStructuredValue } from "./redaction.js";

describe("structured redaction", () => {
  it("redacts sensitive keys and recognizable secret/private values", () => {
    const redacted = redactStructuredValue({
      safe: "visible",
      note: "Bearer private-token",
      provider: "sk-project-secret",
      query: "refresh_token=private-refresh",
      body: "private email body",
      nested: { signedUrl: "https://objects.test/private?X-Amz-Signature=secret" },
    });

    expect(JSON.stringify(redacted)).not.toMatch(
      /sk-|Bearer |refresh_token|private email body|X-Amz-Signature/iu,
    );
    expect(redacted).toMatchObject({ safe: "visible" });
  });
});
