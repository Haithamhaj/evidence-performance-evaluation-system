import { authorizeTimelineProject } from "./timeline-authorization.js";
import { executeTimeline } from "./timeline-execute.js";

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
  return executeTimeline(client, input);
}
