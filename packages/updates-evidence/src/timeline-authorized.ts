import { authorizeTimelineProject } from "./timeline-authorization.js";
import { encodeTimelineCursor } from "./timeline-cursor.js";
import { queryTimelineRows } from "./timeline-query.js";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type TimelineCursor = import("./timeline-cursor.js").TimelineCursor;

export async function readAuthorizedTimeline(
  client: DatabaseClient,
  input: Readonly<{
    actorId: string;
    projectId: string;
    workstreamId: string | null;
    limit: number;
    cursor: TimelineCursor | null;
    now: Date;
  }>,
): Promise<import("@evaluation/contracts").TimelineResponse> {
  await authorizeTimelineProject(client, input.actorId, input.projectId, input.now);
  const items = await queryTimelineRows(client, input);
  return {
    items,
    nextCursor:
      items.length < input.limit || items.length === 0
        ? null
        : encodeTimelineCursor(items[items.length - 1]!),
  };
}
