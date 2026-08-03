import { z } from "zod";

const UuidSchema = z.string().uuid();
const AcceptanceStateSchema = z.enum([
  "open",
  "closed",
  "merged",
  "created",
  "queued",
  "in_progress",
  "success",
  "failure",
  "cancelled",
  "inactive",
]);

const SourceSchema = z
  .object({
    eventId: UuidSchema,
    installationId: z.string().trim().min(1).max(200),
    repositoryId: z.string().trim().min(1).max(200),
    sourceId: z.string().trim().min(1).max(500),
    acceptanceState: AcceptanceStateSchema,
  })
  .strict();

const ConditionSchema = z
  .object({
    id: z.string().trim().min(1).max(200),
    contractId: UuidSchema,
    contractVersion: z.number().int().positive(),
    componentId: UuidSchema,
    sourceIdentity: z
      .object({
        installationId: z.string().trim().min(1).max(200),
        repositoryId: z.string().trim().min(1).max(200),
        sourceId: z.string().trim().min(1).max(500),
      })
      .strict(),
    acceptanceState: AcceptanceStateSchema,
  })
  .strict();

const InputSchema = z
  .object({
    source: SourceSchema,
    activeContract: z
      .object({
        id: UuidSchema,
        version: z.number().int().positive(),
        state: z.literal("active"),
      })
      .strict(),
    conditions: z.array(ConditionSchema).max(100),
  })
  .strict();

export type ProgressConditionMatch =
  | Readonly<{
      state: "matched";
      conditionId: string;
      componentId: string;
      sourceEventId: string;
      contractId: string;
      contractVersion: number;
    }>
  | Readonly<{ state: "no_match"; sourceEventId: string }>
  | Readonly<{
      state: "owner_review_required";
      sourceEventId: string;
      contractId: string;
      contractVersion: number;
      conditionIds: readonly string[];
    }>;

/**
 * Matches only an exact, persisted source identity and allowed acceptance state.
 * The strict condition schema intentionally has no count, size, author, or frequency fields.
 */
export function matchProgressConditions(input: unknown): ProgressConditionMatch {
  const parsed = InputSchema.parse(input);
  const matches = parsed.conditions.filter(
    (condition) =>
      condition.contractId === parsed.activeContract.id &&
      condition.contractVersion === parsed.activeContract.version &&
      condition.sourceIdentity.installationId === parsed.source.installationId &&
      condition.sourceIdentity.repositoryId === parsed.source.repositoryId &&
      condition.sourceIdentity.sourceId === parsed.source.sourceId &&
      condition.acceptanceState === parsed.source.acceptanceState,
  );
  if (matches.length === 0) return { state: "no_match", sourceEventId: parsed.source.eventId };
  if (matches.length > 1) {
    return {
      state: "owner_review_required",
      sourceEventId: parsed.source.eventId,
      contractId: parsed.activeContract.id,
      contractVersion: parsed.activeContract.version,
      conditionIds: matches.map((condition) => condition.id).sort(),
    };
  }
  const matched = matches[0]!;
  return {
    state: "matched",
    conditionId: matched.id,
    componentId: matched.componentId,
    sourceEventId: parsed.source.eventId,
    contractId: parsed.activeContract.id,
    contractVersion: parsed.activeContract.version,
  };
}
