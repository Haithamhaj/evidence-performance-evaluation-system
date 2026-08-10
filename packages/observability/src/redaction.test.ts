import { describe, expect, it } from "vitest";

import { redactStructuredValue } from "./redaction.js";

describe("structured redaction", () => {
  it("redacts sensitive keys and recognizable secret/private values", () => {
    const redacted = redactStructuredValue({
      event: "worker.job.failed",
      status: "ACTION_REQUIRED",
      note: "Bearer private-token",
      provider: "sk-project-secret",
      query: "refresh_token=private-refresh",
      body: "private email body",
      nested: { signedUrl: "https://objects.test/private?X-Amz-Signature=secret" },
      emailBody: "customer email text",
      payload: { arbitrary: "unclassified private text" },
    });

    expect(JSON.stringify(redacted)).not.toMatch(
      /sk-|Bearer |refresh_token|private email body|X-Amz-Signature/iu,
    );
    expect(JSON.stringify(redacted)).not.toMatch(/customer email text|unclassified private text/u);
    expect(redacted).toMatchObject({ event: "worker.job.failed", status: "ACTION_REQUIRED" });
  });
});
