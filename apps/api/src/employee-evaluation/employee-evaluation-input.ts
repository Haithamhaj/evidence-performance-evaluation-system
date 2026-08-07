import { AppError } from "@evaluation/contracts";
import { z } from "zod";

const UuidSchema = z.string().uuid();

export function parseEvaluationInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AppError("EMPLOYEE_EVALUATION_INPUT_INVALID", "errors.validation", 400);
  }
  return parsed.data;
}

export function parseEvaluationUuid(value: unknown): string {
  return parseEvaluationInput(UuidSchema, value);
}
