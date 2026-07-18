import { TimelineResponseSchema } from "@evaluation/contracts";

import { encodeTimelineCursor } from "./timeline-cursor.js";

export function finalizeTimeline(
  rows: readonly import("@evaluation/contracts").TimelineItem[],
  limit: number,
): import("@evaluation/contracts").TimelineResponse {
  return TimelineResponseSchema.parse({
    items: rows,
    nextCursor:
      rows.length < limit || rows.length === 0
        ? null
        : encodeTimelineCursor(rows[rows.length - 1]!),
  });
}
