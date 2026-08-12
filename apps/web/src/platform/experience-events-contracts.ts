import { z } from "zod";

const UuidSchema = z.string().uuid();

export const WhatChangedProjectionSchema = z
  .object({
    items: z.array(
      z
        .object({
          receiptId: UuidSchema,
          cursor: z.string().regex(/^[1-9]\d*$/u),
          type: z.string().trim().min(1).max(100),
          source: z.string().trim().min(1).max(100),
          entityRefs: z.unknown(),
          occurredAt: z.iso.datetime({ offset: true }),
          freshness: z.unknown(),
          state: z.enum(["delivered", "acknowledged"]),
        })
        .strict(),
    ),
    nextCursor: z
      .string()
      .regex(/^[1-9]\d*$/u)
      .nullable(),
  })
  .strict();

export type WhatChangedProjection = z.infer<typeof WhatChangedProjectionSchema>;
