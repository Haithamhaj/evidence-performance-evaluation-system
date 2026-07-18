import { finalizeTimeline } from "./timeline-finalize.js";
import { queryTimelineRows } from "./timeline-query.js";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type TimelineCursor = import("./timeline-cursor.js").TimelineCursor;

export async function executeTimeline(
  client: DatabaseClient,
  input: Readonly<{
    projectId: string;
    workstreamId: string | null;
    limit: number;
    cursor: TimelineCursor | null;
  }>,
): Promise<import("@evaluation/contracts").TimelineResponse> {
  const rows = await queryTimelineRows(client, input);
  return finalizeTimeline(rows, input.limit);
}
