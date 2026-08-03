import { TimelineResponseSchema } from "@evaluation/contracts";

import { encodeTimelineCursor } from "./timeline-cursor.js";
import { timelineSourceProvenance } from "./source-provenance.js";

export function finalizeTimeline(
  rows: readonly import("./timeline-row.js").TimelineRow[],
  limit: number,
): import("@evaluation/contracts").TimelineResponse {
  const items = rows.map(({ sourceKinds, ...row }) => ({
    ...row,
    sourceProvenance: timelineSourceProvenance(sourceKinds),
  }));
  return TimelineResponseSchema.parse({
    items,
    nextCursor:
      rows.length < limit || rows.length === 0
        ? null
        : encodeTimelineCursor(items[items.length - 1]!),
  });
}
