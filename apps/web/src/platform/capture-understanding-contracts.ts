import { z } from "zod";

const UuidSchema = z.string().uuid();
const SourceSchema = z
  .object({
    kind: z.enum([
      "progress_contract",
      "project_document",
      "work_item",
      "update",
      "evidence",
      "github",
      "google_gmail",
      "google_calendar",
      "manual_capture",
      "human_decision",
    ]),
    label: z.string().trim().min(1).max(240),
    observedAt: z.iso.datetime({ offset: true }).nullable().optional(),
    freshness: z.enum(["fresh", "possibly_stale", "stale", "unknown"]),
  })
  .strict();

export const CaptureUnderstandingInputSchema = z
  .object({
    locale: z.enum(["ar", "en"]),
    rawText: z.string().trim().max(8_000),
    sources: z
      .array(
        z
          .object({
            kind: z.enum(["voice", "link", "image", "code", "file"]),
            label: z.string().trim().min(1).max(500),
          })
          .strict(),
      )
      .max(20),
  })
  .strict()
  .refine((value) => value.rawText.length > 0 || value.sources.length > 0);

export const WebCaptureUnderstandingSchema = z
  .object({
    schemaVersion: z.literal("capture-understanding.v1"),
    likelyProject: z
      .object({
        id: UuidSchema,
        name: z.string().trim().min(1).max(240),
        confidence: z.enum(["high", "uncertain"]),
      })
      .strict()
      .nullable(),
    likelyMeaning: z.enum(["private_note", "task", "project_update", "suggested_evidence"]),
    relatedWorkItemId: UuidSchema.nullable(),
    relatedWorkItemTitle: z.string().trim().min(1).max(500).nullable(),
    relatedComponentId: UuidSchema.nullable(),
    sourceRefs: z.array(SourceSchema).max(20),
    clarification: z
      .object({
        question: z.string().trim().min(1).max(1_000),
        missingField: z.string().trim().min(1).max(100),
      })
      .strict()
      .nullable(),
    confidence: z.enum(["high", "uncertain"]),
    createsOfficialRecord: z.literal(false),
  })
  .strict();

export type WebCaptureUnderstanding = z.infer<typeof WebCaptureUnderstandingSchema>;
export type CaptureUnderstandingInput = z.infer<typeof CaptureUnderstandingInputSchema>;
