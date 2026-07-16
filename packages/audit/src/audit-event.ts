import { z } from "zod";

const forbiddenSafeField =
  /token|secret|password|prompt|rawcontent|privatefeedback|authorization/iu;

export const AuditEventInputSchema = z
  .object({
    eventType: z.string().regex(/^[a-z]+(?:_[a-z]+)*(?:\.[a-z]+(?:_[a-z]+)*)+$/u),
    actor: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("human"), id: z.string().uuid() }).strict(),
      z.object({ kind: z.literal("service"), id: z.enum(["bootstrap"]) }).strict(),
    ]),
    effectiveSubjectId: z.string().uuid(),
    scopeType: z.enum(["system", "organization", "department", "project", "workstream", "cycle"]),
    scopeId: z.string().uuid(),
    targetType: z.string().min(1),
    targetId: z.string().uuid(),
    reason: z.string().trim().min(3).max(500).optional(),
    safeDiff: z.record(z.string(), z.unknown()).optional(),
    correlationId: z.string().uuid(),
    source: z.enum(["api", "worker", "seed", "admin_replay"]),
  })
  .strict();

function assertSafeValue(value: unknown, seen: Set<object>): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value !== "object") throw new Error("Audit safeDiff must contain JSON values only");
  if (seen.has(value)) throw new Error("Audit safeDiff must not contain circular values");
  seen.add(value);

  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw new Error("Audit safeDiff must contain plain JSON objects only");
    }
    let itemCount = 0;
    for (const key of Reflect.ownKeys(value)) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(?:0|[1-9]\d*)$/u.test(key)) {
        throw new Error("Audit safeDiff must contain JSON values only");
      }
      itemCount += 1;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        throw new Error("Audit safeDiff must contain JSON values only");
      }
      assertSafeValue(descriptor.value, seen);
    }
    if (itemCount !== value.length) {
      throw new Error("Audit safeDiff must contain JSON values only");
    }
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error("Audit safeDiff must contain plain JSON objects only");
    }
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") {
        throw new Error("Audit safeDiff must contain JSON values only");
      }
      if (forbiddenSafeField.test(key)) {
        throw new Error("Audit safeDiff contains a forbidden field");
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        throw new Error("Audit safeDiff must contain JSON values only");
      }
      assertSafeValue(descriptor.value, seen);
    }
  }
  seen.delete(value);
}

function assertRawSafeDiff(input: unknown): void {
  if (input === null || typeof input !== "object") return;
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("Audit event input must be a plain object");
  }
  const descriptor = Object.getOwnPropertyDescriptor(input, "safeDiff");
  if (descriptor === undefined) {
    if ("safeDiff" in input) {
      throw new Error("Audit safeDiff must be an own data property");
    }
    return;
  }
  if (!("value" in descriptor) || !descriptor.enumerable) {
    throw new Error("Audit safeDiff must contain JSON values only");
  }
  assertSafeValue(descriptor.value, new Set());
}

export function parseAuditEventInput(
  input: unknown,
): import("@evaluation/contracts").AuditEventInput {
  assertRawSafeDiff(input);
  const parsed = AuditEventInputSchema.parse(input);
  return parsed;
}
