import { z } from "zod";

const UtcInstantSchema = z.iso.datetime({ offset: true });

export const GITHUB_EVENT_VERIFICATION_STATES = ["VERIFIED", "REJECTED"] as const;

export const GitHubEventVerificationStateSchema = z.enum(GITHUB_EVENT_VERIFICATION_STATES);

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
