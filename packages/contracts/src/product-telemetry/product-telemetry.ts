import { z } from "zod";

const base = z.object({
  schemaVersion: z.literal(1),
  occurredAt: z.iso.datetime({ offset: true }),
});
const token = z.string().trim().min(1).max(80);

export const ProductTelemetryEventV1Schema = z.discriminatedUnion("type", [
  base
    .extend({
      type: z.literal("telemetry.today_loaded"),
      metadata: z
        .object({
          locale: token,
          viewport_class: token,
          duration_bucket: token,
          result_class: token,
        })
        .strict(),
    })
    .strict(),
  base
    .extend({
      type: z.literal("telemetry.manual_fallback_opened"),
      metadata: z.object({ capability_id: token, surface: token, reason_code: token }).strict(),
    })
    .strict(),
  base
    .extend({
      type: z.literal("telemetry.recovery_completed"),
      metadata: z
        .object({ capability_id: token, recovery_mode: token, result_class: token })
        .strict(),
    })
    .strict(),
  base
    .extend({
      type: z.literal("telemetry.prepared_item_decided"),
      metadata: z.object({ capability_id: token, decision_class: token, surface: token }).strict(),
    })
    .strict(),
  base
    .extend({
      type: z.literal("telemetry.capture_completed"),
      metadata: z.object({ input_type: token, surface: token, result_class: token }).strict(),
    })
    .strict(),
  base
    .extend({
      type: z.literal("telemetry.preference_changed"),
      metadata: z.object({ preference_key: token, new_state: token }).strict(),
    })
    .strict(),
  base
    .extend({
      type: z.literal("telemetry.surface_performance"),
      metadata: z.object({ surface: token, duration_bucket: token, result_class: token }).strict(),
    })
    .strict(),
]);

export type ProductTelemetryEventV1 = z.infer<typeof ProductTelemetryEventV1Schema>;
