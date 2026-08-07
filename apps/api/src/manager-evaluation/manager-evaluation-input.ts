import { AppError } from "@evaluation/contracts";
import { z } from "zod";

const Uuid = z.string().uuid();

export function parseManagerEvaluationInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AppError("MANAGER_EVALUATION_INPUT_INVALID", "errors.validation", 400);
  }
  return parsed.data;
}

export function parseManagerEvaluationUuid(value: unknown) {
  return parseManagerEvaluationInput(Uuid, value);
}
