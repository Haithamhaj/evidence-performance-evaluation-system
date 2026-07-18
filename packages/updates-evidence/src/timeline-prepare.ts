import { z } from "zod";

import { readAuthorizedTimeline } from "./timeline-authorized.js";
import { decodeTimelineCursor } from "./timeline-cursor.js";

type DatabaseClient = import("@evaluation/database").DatabaseClient;

const TimelineInputSchema = z
  .object({
    actorId: z.string().uuid(),
    projectId: z.string().uuid(),
    workstreamId: z.string().uuid().nullable(),
    limit: z.number().int().min(1).max(50),
    cursor: z.string().min(1).max(1_000).nullable(),
  })
  .strict();

export function prepareTimeline(
  client: DatabaseClient,
  now: Date,
  input: unknown,
): Promise<import("@evaluation/contracts").TimelineResponse> {
  const parsed = TimelineInputSchema.parse(input);
  const cursor = parsed.cursor === null ? null : decodeTimelineCursor(parsed.cursor);
  return readAuthorizedTimeline(client, { ...parsed, cursor, now });
}
