import { randomUUID } from "node:crypto";

import {
  AppError,
  SuggestionFeedbackInputSchema,
  SuggestionFeedbackReceiptSchema,
} from "@evaluation/contracts";

type FeedbackRow = Readonly<{
  id: string;
  preparedItemId: string;
  employeeId: string;
  idempotencyKey: string;
  category: string;
  surface: string;
  createdAt: Date;
}>;

type Database = Readonly<{
  experiencePreparedItem: {
    findUnique(input: unknown): Promise<Readonly<{
      id: string;
      employeeId: string;
      outputReference: string;
      correlationId: string;
    }> | null>;
  };
  experienceSuggestionFeedback: {
    findUnique(input: unknown): Promise<FeedbackRow | null>;
    create(input: unknown): Promise<FeedbackRow>;
  };
}>;

type Actor = Readonly<{ userId: string; active: boolean }>;

export class PreparedExperienceFeedbackService {
  private readonly database: Database;
  private readonly now: () => Date;

  constructor(database: Database, now: () => Date = () => new Date()) {
    this.database = database;
    this.now = now;
  }

  async record(
    input: Readonly<{
      actor: Actor;
      preparedItemId: string;
      input: import("@evaluation/contracts").SuggestionFeedbackInput;
    }>,
  ) {
    if (!input.actor.active) {
      throw new AppError("AUTH_INACTIVE_USER", "errors.auth.inactiveUser", 403);
    }
    const preparedItemId = parseUuid(input.preparedItemId);
    const feedback = SuggestionFeedbackInputSchema.parse(input.input);
    const prepared = await this.database.experiencePreparedItem.findUnique({
      where: { id: preparedItemId },
      select: { id: true, employeeId: true, outputReference: true, correlationId: true },
    });
    if (prepared === null || prepared.employeeId !== input.actor.userId) {
      throw new AppError(
        "EXPERIENCE_PREPARED_NOT_FOUND",
        "errors.experience.preparedNotFound",
        404,
      );
    }

    const existing = await this.database.experienceSuggestionFeedback.findUnique({
      where: { idempotencyKey: feedback.idempotencyKey },
    });
    if (existing !== null)
      return this.replay(existing, preparedItemId, input.actor.userId, feedback);

    try {
      const row = await this.database.experienceSuggestionFeedback.create({
        data: {
          id: randomUUID(),
          preparedItemId,
          employeeId: input.actor.userId,
          idempotencyKey: feedback.idempotencyKey,
          category: feedback.category,
          surface: feedback.surface,
          outputReference: prepared.outputReference,
          correlationId: prepared.correlationId,
          createdAt: this.now(),
        },
      });
      return receipt(row, false);
    } catch (error) {
      if (!hasCode(error, "P2002")) throw error;
      const concurrent = await this.database.experienceSuggestionFeedback.findUnique({
        where: { idempotencyKey: feedback.idempotencyKey },
      });
      if (concurrent === null) throw error;
      return this.replay(concurrent, preparedItemId, input.actor.userId, feedback);
    }
  }

  private replay(
    row: FeedbackRow,
    preparedItemId: string,
    employeeId: string,
    input: import("@evaluation/contracts").SuggestionFeedbackInput,
  ) {
    if (
      row.preparedItemId !== preparedItemId ||
      row.employeeId !== employeeId ||
      row.category !== input.category ||
      row.surface !== input.surface
    ) {
      throw new AppError("IDEMPOTENCY_CONFLICT", "errors.idempotency.conflict", 409);
    }
    return receipt(row, true);
  }
}

function receipt(row: FeedbackRow, replay: boolean) {
  return SuggestionFeedbackReceiptSchema.parse({
    id: row.id,
    preparedItemId: row.preparedItemId,
    category: row.category,
    createdAt: row.createdAt.toISOString(),
    replay,
  });
}

function parseUuid(value: string): string {
  const parsed = SuggestionFeedbackInputSchema.shape.idempotencyKey.safeParse(value);
  if (!parsed.success) {
    throw new AppError("EXPERIENCE_PREPARED_NOT_FOUND", "errors.experience.preparedNotFound", 404);
  }
  return parsed.data;
}

function hasCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}
