import { z } from "zod";

const UuidSchema = z.string().uuid();
const UtcInstantSchema = z.iso.datetime({ offset: true });

export const CONNECTED_SOURCE_PROVIDERS = ["GOOGLE_GMAIL", "GOOGLE_CALENDAR"] as const;

export const ConnectedSourceProviderSchema = z.enum(CONNECTED_SOURCE_PROVIDERS);
export const ConnectedSourcePrivacySchema = z.literal("PRIVATE");

export const ConnectedSourceItemSchema = z
  .object({
    id: UuidSchema,
    employeeId: UuidSchema,
    provider: ConnectedSourceProviderSchema,
    providerSourceId: z.string().min(1),
    occurredAt: UtcInstantSchema,
    title: z.string(),
    summary: z.string().nullable(),
    sourceUrl: z.url().nullable(),
    privacy: ConnectedSourcePrivacySchema,
    excluded: z.boolean(),
  })
  .strict();

export type ConnectedSourceProvider = z.infer<typeof ConnectedSourceProviderSchema>;
export type ConnectedSourceItem = z.infer<typeof ConnectedSourceItemSchema>;
