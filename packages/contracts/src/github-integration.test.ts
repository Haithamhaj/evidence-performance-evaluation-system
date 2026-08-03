import { describe, expect, it } from "vitest";

import { GitHubSourceEventSchema } from "./github-integration.js";

describe("GitHub integration contracts", () => {
  it("accepts only a source-addressable, verified or rejected GitHub event", () => {
    const event = {
      installationId: "installation-123",
      repositoryId: "repository-456",
      deliveryId: "delivery-789",
      eventType: "pull_request",
      sourceId: "PR_kwDOExample",
      sourceUrl: "https://github.com/leapai/atlas/pull/42",
      occurredAt: "2026-07-20T10:15:00.000Z",
      verificationState: "VERIFIED",
    } as const;

    expect(GitHubSourceEventSchema.parse(event)).toEqual(event);
    expect(() =>
      GitHubSourceEventSchema.parse({ ...event, verificationState: "PENDING" }),
    ).toThrow();
    expect(() => GitHubSourceEventSchema.parse({ ...event, sourceUrl: "not-a-url" })).toThrow();
  });
});
