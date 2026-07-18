import { AppError } from "@evaluation/contracts";
import { z } from "zod";

type TimelineItem = import("@evaluation/contracts").TimelineItem;

const CursorSchema = z
  .object({
    occurredAt: z.iso.datetime({ offset: true }),
    kind: z.enum(["update", "evidence"]),
    id: z.string().uuid(),
  })
  .strict();

export type TimelineCursor = z.infer<typeof CursorSchema>;

export function decodeTimelineCursor(value: string): TimelineCursor {
  try {
    return CursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
  } catch {
    throw new AppError("TIMELINE_CURSOR_INVALID", "errors.timeline.cursorInvalid", 400);
  }
}

export function encodeTimelineCursor(item: TimelineItem): string {
  return Buffer.from(
    JSON.stringify({ occurredAt: item.occurredAt, kind: item.kind, id: item.id }),
  ).toString("base64url");
}

export function itemFollowsCursor(item: TimelineItem, cursor: TimelineCursor): boolean {
  return (
    item.occurredAt < cursor.occurredAt ||
    (item.occurredAt === cursor.occurredAt &&
      (item.kind < cursor.kind || (item.kind === cursor.kind && item.id < cursor.id)))
  );
}
