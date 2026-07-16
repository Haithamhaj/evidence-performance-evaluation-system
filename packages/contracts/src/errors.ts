import { z } from "zod";

export const ErrorDetailSchema = z
  .object({
    field: z.string().min(1),
    messageKey: z.string().min(1),
  })
  .strict();

export const ErrorEnvelopeSchema = z
  .object({
    code: z.string().regex(/^[A-Z0-9_]+$/u),
    messageKey: z.string().min(1),
    correlationId: z.string().min(1),
    details: z.array(ErrorDetailSchema).optional(),
  })
  .strict();

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

export class AppError extends Error {
  readonly code: string;
  readonly messageKey: string;
  readonly status: number;
  readonly details: ErrorEnvelope["details"] | undefined;

  constructor(
    code: string,
    messageKey: string,
    status: number,
    details?: ErrorEnvelope["details"],
  ) {
    super(code);
    this.name = "AppError";
    this.code = code;
    this.messageKey = messageKey;
    this.status = status;
    this.details = details;
  }
}
