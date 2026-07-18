type DatabaseClient = import("@evaluation/database").DatabaseClient;
type TimelineCursor = import("./timeline-cursor.js").TimelineCursor;

export function queryTimelineRows(
  client: DatabaseClient,
  input: Readonly<{
    projectId: string;
    workstreamId: string | null;
    limit: number;
    cursor: TimelineCursor | null;
  }>,
): Promise<import("@evaluation/contracts").TimelineItem[]> {
  return client.$queryRaw<import("@evaluation/contracts").TimelineItem[]>`
    SELECT
      activity.id,
      activity.kind,
      activity."projectId",
      activity."workstreamId",
      activity."workItemId",
      activity."employeeId",
      to_char(
        activity."occurredAtValue" AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) AS "occurredAt",
      activity.title,
      activity.detail,
      activity."sourceReferences"
    FROM (
      SELECT
        event.id,
        'update'::text AS kind,
        event."projectId",
        event."workstreamId",
        event."workItemId",
        event."employeeId",
        event."occurredAt" AS "occurredAtValue",
        draft.summary AS title,
        draft.result AS detail,
        event."sourceReferences"
      FROM "AcceptedUpdateEvent" event
      INNER JOIN "UpdateConfirmation" confirmation
        ON confirmation.id = event."confirmationId"
      INNER JOIN "StructuredUpdateDraftRevision" draft
        ON draft.id = confirmation."draftRevisionId"
      UNION ALL
      SELECT
        event.id,
        'evidence'::text AS kind,
        event."projectId",
        event."workstreamId",
        evidence."workItemId",
        evidence."employeeId",
        event."occurredAt" AS "occurredAtValue",
        revision."supportedClaim" AS title,
        revision."contributionContext" AS detail,
        event."sourceReferences"
      FROM "AcceptedEvidenceEvent" event
      INNER JOIN "EvidenceRecord" evidence
        ON evidence.id = event."evidenceId"
      INNER JOIN "EvidenceConfirmation" confirmation
        ON confirmation.id = event."confirmationId"
      INNER JOIN "EvidenceRevision" revision
        ON revision.id = confirmation."evidenceRevisionId"
    ) activity
    WHERE activity."projectId" = ${input.projectId}::uuid
      AND (
        ${input.workstreamId}::uuid IS NULL
        OR activity."workstreamId" = ${input.workstreamId}::uuid
      )
      AND (
        ${input.cursor?.occurredAt ?? null}::timestamptz IS NULL
        OR activity."occurredAtValue" < ${input.cursor?.occurredAt ?? null}::timestamptz
        OR (
          activity."occurredAtValue" = ${input.cursor?.occurredAt ?? null}::timestamptz
          AND activity.kind < ${input.cursor?.kind ?? null}::text
        )
        OR (
          activity."occurredAtValue" = ${input.cursor?.occurredAt ?? null}::timestamptz
          AND activity.kind = ${input.cursor?.kind ?? null}::text
          AND activity.id < ${input.cursor?.id ?? null}::uuid
        )
      )
    ORDER BY activity."occurredAtValue" DESC, activity.kind DESC, activity.id DESC
    LIMIT ${input.limit}
  `;
}
