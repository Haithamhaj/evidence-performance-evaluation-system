import { z } from "zod";

const UtcInstantSchema = z.iso.datetime({ offset: true });

export const GITHUB_EVENT_VERIFICATION_STATES = ["VERIFIED", "REJECTED"] as const;

export const GitHubEventVerificationStateSchema = z.enum(GITHUB_EVENT_VERIFICATION_STATES);

const FactTextSchema = z.string().trim().min(1).max(500);

/**
 * Facts intentionally retain only a source-labelled, reviewable description.
 * Raw provider payloads and activity-volume fields are prohibited at the writer boundary.
 */
export const GovernedGitHubFactSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("pull_request"),
      state: z.enum(["open", "closed", "merged"]),
      title: FactTextSchema.max(300).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("check"),
      state: z.enum(["queued", "in_progress", "success", "failure", "cancelled"]),
      name: FactTextSchema.max(200).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("deployment"),
      state: z.enum(["queued", "in_progress", "success", "failure", "inactive"]),
      environment: FactTextSchema.max(120).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("commit"),
      state: z.literal("created"),
      message: FactTextSchema.max(300).optional(),
    })
    .strict(),
]);

export const GovernedGitHubFactsSchema = z.array(GovernedGitHubFactSchema).min(1).max(10);
export type GovernedGitHubFact = z.infer<typeof GovernedGitHubFactSchema>;
export type GovernedGitHubFacts = z.infer<typeof GovernedGitHubFactsSchema>;

export const GitHubSourceEventSchema = z
  .object({
    installationId: z.string().trim().min(1).max(200),
    repositoryId: z.string().trim().min(1).max(200),
    deliveryId: z.string().trim().min(1).max(200),
    eventType: z.string().trim().min(1).max(200),
    sourceId: z.string().trim().min(1).max(500),
    sourceUrl: z.url().max(2_000),
    occurredAt: UtcInstantSchema,
    verificationState: GitHubEventVerificationStateSchema,
  })
  .strict();

export type GitHubEventVerificationState = z.infer<typeof GitHubEventVerificationStateSchema>;
export type GitHubSourceEvent = z.infer<typeof GitHubSourceEventSchema>;
