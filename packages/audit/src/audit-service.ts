import { z } from "zod";

import { parseAuditEventInput } from "./audit-event.js";

type AuditRow = Readonly<{
  id: string;
  eventType: string;
  actorKind: string;
  actorId: string;
  effectiveSubjectId: string;
  scopeType: string;
  scopeId: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  safeDiff: unknown;
  correlationId: string;
  source: string;
  createdAt: Date;
}>;

interface AuditAppendPersistence {
  readonly auditEvent: {
    create(args: unknown): Promise<Pick<AuditRow, "createdAt" | "id">>;
  };
}

interface AuditQueryPersistence {
  readonly auditEvent: {
    findMany(args: unknown): Promise<AuditRow[]>;
  };
}

export const AuditQuerySchema = z
  .object({
    eventType: z
      .string()
      .regex(/^[a-z]+(?:\.[a-z]+)+$/u)
      .optional(),
    actorKind: z.enum(["human", "service"]).optional(),
    actorId: z.string().min(1).optional(),
    scopeType: z
      .enum(["system", "organization", "department", "project", "workstream", "cycle"])
      .optional(),
    scopeId: z.string().uuid().optional(),
    targetType: z.string().min(1).optional(),
    targetId: z.string().uuid().optional(),
    correlationId: z.string().uuid().optional(),
    utcFrom: z.iso.datetime({ offset: true }).optional(),
    utcTo: z.iso.datetime({ offset: true }).optional(),
    cursor: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict();

function serialize(row: AuditRow) {
  return {
    id: row.id,
    eventType: row.eventType,
    actor: { kind: row.actorKind, id: row.actorId },
    effectiveSubjectId: row.effectiveSubjectId,
    scopeType: row.scopeType,
    scopeId: row.scopeId,
    targetType: row.targetType,
    targetId: row.targetId,
    reason: row.reason,
    safeDiff: row.safeDiff,
    correlationId: row.correlationId,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function appendAuditEvent(
  transaction: AuditAppendPersistence,
  input: import("@evaluation/contracts").AuditEventInput,
): Promise<import("@evaluation/contracts").AuditEventRef> {
  const parsed = parseAuditEventInput(input);
  const row = await transaction.auditEvent.create({
    data: {
      eventType: parsed.eventType,
      actorKind: parsed.actor.kind,
      actorId: parsed.actor.id,
      effectiveSubjectId: parsed.effectiveSubjectId,
      scopeType: parsed.scopeType,
      scopeId: parsed.scopeId,
      targetType: parsed.targetType,
      targetId: parsed.targetId,
      reason: parsed.reason,
      safeDiff: parsed.safeDiff,
      correlationId: parsed.correlationId,
      source: parsed.source,
    },
  });
  return { id: row.id, createdAt: row.createdAt.toISOString() };
}

function decodeCursor(cursor: string): Readonly<{ createdAt: string; id: string }> {
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid audit cursor");
  }
  return z
    .object({ createdAt: z.iso.datetime({ offset: true }), id: z.string().uuid() })
    .parse(decoded);
}

function encodeCursor(row: AuditRow): string {
  return Buffer.from(
    JSON.stringify({ createdAt: row.createdAt.toISOString(), id: row.id }),
  ).toString("base64url");
}

export async function queryAuditEvents(transaction: AuditQueryPersistence, input: unknown) {
  const query = AuditQuerySchema.parse(input);
  const cursor = query.cursor === undefined ? undefined : decodeCursor(query.cursor);
  const rows = await transaction.auditEvent.findMany({
    where: {
      eventType: query.eventType,
      actorKind: query.actorKind,
      actorId: query.actorId,
      scopeType: query.scopeType,
      scopeId: query.scopeId,
      targetType: query.targetType,
      targetId: query.targetId,
      correlationId: query.correlationId,
      createdAt: { gte: query.utcFrom, lte: query.utcTo },
      OR:
        cursor === undefined
          ? undefined
          : [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
  });
  const hasMore = rows.length > query.limit;
  const items = rows.slice(0, query.limit);
  return {
    items: items.map(serialize),
    nextCursor: hasMore && items.length > 0 ? encodeCursor(items.at(-1)!) : null,
  };
}

export const databaseAuditWriter: import("@evaluation/contracts").AuditWriter<AuditAppendPersistence> =
  {
    append: appendAuditEvent,
  };
