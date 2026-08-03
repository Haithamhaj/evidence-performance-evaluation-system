import { describe, expect, it } from "vitest";

import { GitHubEvidenceSuggestionService } from "./evidence-suggestion-service.js";

const event = {
  id: "00000000-0000-4000-8000-000000000001",
  projectId: "00000000-0000-4000-8000-000000000002",
  sourceId: "PR_42",
  sourceUrl: "https://github.com/leapai/atlas/pull/42",
  occurredAt: "2026-08-03T10:00:00.000Z",
  verificationState: "VERIFIED" as const,
  governedFacts: [{ kind: "pull_request" as const, state: "merged" as const }],
};

describe("GitHubEvidenceSuggestionService", () => {
  it.each([
    [{ kind: "pull_request", state: "merged" }],
    [{ kind: "commit", state: "created", message: "Keep source facts governed" }],
    [{ kind: "check", state: "success", name: "required-ci" }],
    [{ kind: "deployment", state: "success", environment: "production" }],
  ] as const)(
    "creates a governed suggestion for a verified %s fact without creating personal evidence",
    (fact) => {
      const suggestions: unknown[] = [];
      const service = new GitHubEvidenceSuggestionService({
        suggestions: { publish: (suggestion) => void suggestions.push(suggestion) },
      });

      const result = service.suggest({ ...event, governedFacts: [fact] });

      expect(result).toMatchObject({
        state: "suggested",
        sourceEventId: event.id,
        projectId: event.projectId,
        sourceId: event.sourceId,
        sourceUrl: event.sourceUrl,
        confirmationState: "employee_confirmation_required",
      });
      expect(suggestions).toEqual([result]);
      expect(result).not.toHaveProperty("evidenceId");
      expect(result).not.toHaveProperty("employeeId");
    },
  );

  it("does not create a suggestion from an unverified source event", () => {
    const suggestions: unknown[] = [];
    const service = new GitHubEvidenceSuggestionService({
      suggestions: { publish: (suggestion) => void suggestions.push(suggestion) },
    });

    expect(service.suggest({ ...event, verificationState: "REJECTED" })).toEqual({
      state: "ignored",
      sourceEventId: event.id,
    });
    expect(suggestions).toEqual([]);
  });
});
