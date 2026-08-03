import { GovernedGitHubFactsSchema } from "@evaluation/contracts";
import { z } from "zod";

const InputSchema = z
  .object({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
    sourceId: z.string().trim().min(1).max(500),
    sourceUrl: z.url().max(2_000),
    occurredAt: z.iso.datetime({ offset: true }),
    verificationState: z.enum(["VERIFIED", "REJECTED"]),
    governedFacts: GovernedGitHubFactsSchema,
  })
  .strict();

export type GitHubEvidenceSuggestion = Readonly<{
  state: "suggested";
  sourceEventId: string;
  projectId: string;
  sourceId: string;
  sourceUrl: string;
  occurredAt: string;
  governedFacts: import("@evaluation/contracts").GovernedGitHubFacts;
  confirmationState: "employee_confirmation_required";
}>;

export interface GitHubEvidenceSuggestionWriter {
  publish(suggestion: GitHubEvidenceSuggestion): void | Promise<void>;
}

export class GitHubEvidenceSuggestionService {
  private readonly suggestions: GitHubEvidenceSuggestionWriter;

  constructor(dependencies: Readonly<{ suggestions: GitHubEvidenceSuggestionWriter }>) {
    this.suggestions = dependencies.suggestions;
  }

  suggest(
    input: unknown,
  ): GitHubEvidenceSuggestion | Readonly<{ state: "ignored"; sourceEventId: string }> {
    const event = InputSchema.parse(input);
    if (event.verificationState !== "VERIFIED") {
      return { state: "ignored", sourceEventId: event.id };
    }
    const suggestion: GitHubEvidenceSuggestion = {
      state: "suggested",
      sourceEventId: event.id,
      projectId: event.projectId,
      sourceId: event.sourceId,
      sourceUrl: event.sourceUrl,
      occurredAt: event.occurredAt,
      governedFacts: event.governedFacts,
      confirmationState: "employee_confirmation_required",
    };
    void this.suggestions.publish(suggestion);
    return suggestion;
  }
}
