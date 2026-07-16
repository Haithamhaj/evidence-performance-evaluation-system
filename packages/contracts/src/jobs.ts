import { z } from "zod";

export const MAX_JOB_PAYLOAD_BYTES = 65_536;

const jobType = z
  .string()
  .min(3)
  .max(100)
  .regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u);

const trace = z
  .object({
    traceId: z.string().regex(/^(?!0{32}$)[a-f0-9]{32}$/u),
    spanId: z.string().regex(/^(?!0{16}$)[a-f0-9]{16}$/u),
  })
  .strict();

const scope = z
  .object({
    organizationId: z.string().uuid(),
    departmentId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
  })
  .strict();

function hasBoundedSerializedPayload(value: unknown): boolean {
  try {
    const serialized = JSON.stringify(value);
    return (
      serialized !== undefined &&
      new TextEncoder().encode(serialized).byteLength <= MAX_JOB_PAYLOAD_BYTES
    );
  } catch {
    return false;
  }
}

export const JobEnvelopeSchema = z
  .object({
    jobVersion: z.number().int().min(1).max(2_147_483_647),
    jobType,
    operationId: z.string().uuid(),
    correlationId: z.string().uuid(),
    trace: trace.optional(),
    scope,
    idempotencyKey: z
      .string()
      .trim()
      .min(3)
      .max(200)
      .regex(/^[a-z0-9][A-Za-z0-9._:/-]*$/u),
    payload: z.json().refine(hasBoundedSerializedPayload, {
      message: `payload must serialize to at most ${MAX_JOB_PAYLOAD_BYTES} UTF-8 bytes`,
    }),
  })
  .strict();

export type JobEnvelope = z.infer<typeof JobEnvelopeSchema>;

export function jobQueueName(type: string, version: number): string {
  const parsedType = jobType.parse(type);
  const parsedVersion = z.number().int().min(1).max(2_147_483_647).parse(version);
  return `${parsedType.split(".", 1)[0]}:v${String(parsedVersion)}`;
}
