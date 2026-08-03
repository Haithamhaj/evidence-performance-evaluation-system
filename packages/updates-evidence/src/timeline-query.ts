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
      activity."sourceReferences",
      activity."sourceProvenance",
      activity."reviewState",
      activity.project,
      activity.workstream,
      activity."workItem",
      activity."relatedKpiComponents",
      activity."relatedCriteria",
      activity."verificationState"
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
        event."sourceReferences",
        CASE source."inputKind"
          WHEN 'voice' THEN 'employee_voice'
          ELSE 'employee_text'
        END::text AS "sourceProvenance",
        'employee_confirmed'::text AS "reviewState",
        jsonb_build_object('id', project.id, 'name', project.name) AS project,
        CASE WHEN workstream.id IS NULL THEN NULL
          ELSE jsonb_build_object('id', workstream.id, 'name', workstream.name)
        END AS workstream,
        CASE WHEN work_item.id IS NULL THEN NULL
          ELSE jsonb_build_object('id', work_item.id, 'title', work_item.title)
        END AS "workItem",
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object('id', component.id, 'name', component.name)
            ORDER BY component.position
          )
          FROM "ProgressContractComponent" component
          WHERE component.id IN (
            SELECT component_id.value::uuid
            FROM jsonb_array_elements_text(draft."relatedProgressComponentIds") component_id(value)
          )
        ), '[]'::jsonb) AS "relatedKpiComponents",
        '[]'::jsonb AS "relatedCriteria",
        NULL::text AS "verificationState"
      FROM "AcceptedUpdateEvent" event
      INNER JOIN "UpdateSource" source
        ON source.id = event."updateSourceId"
      INNER JOIN "UpdateConfirmation" confirmation
        ON confirmation.id = event."confirmationId"
      INNER JOIN "StructuredUpdateDraftRevision" draft
        ON draft.id = confirmation."draftRevisionId"
      INNER JOIN "Project" project
        ON project.id = event."projectId"
      LEFT JOIN "Workstream" workstream
        ON workstream.id = event."workstreamId"
      LEFT JOIN "WorkItem" work_item
        ON work_item.id = event."workItemId"
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
        event."sourceReferences",
        CASE
          WHEN evidence."githubSourceEventId" IS NOT NULL THEN 'github_automated'
          WHEN revision."sourceKind" = 'pasted_text' THEN 'employee_text'
          WHEN revision."sourceKind" IN ('pasted_code', 'cli_snapshot') THEN 'employee_code'
          WHEN revision."sourceKind" = 'url' THEN 'employee_url'
          ELSE 'employee_file'
        END::text AS "sourceProvenance",
        'employee_confirmed'::text AS "reviewState",
        jsonb_build_object('id', project.id, 'name', project.name) AS project,
        CASE WHEN workstream.id IS NULL THEN NULL
          ELSE jsonb_build_object('id', workstream.id, 'name', workstream.name)
        END AS workstream,
        CASE WHEN work_item.id IS NULL THEN NULL
          ELSE jsonb_build_object('id', work_item.id, 'title', work_item.title)
        END AS "workItem",
        COALESCE((
          SELECT jsonb_agg(
            DISTINCT jsonb_build_object('id', component.id, 'name', component.name)
          )
          FROM "EvidenceLink" link
          INNER JOIN "ProgressContractComponent" component
            ON component.id = link."progressComponentId"
          WHERE link."evidenceRevisionId" = revision.id
        ), '[]'::jsonb) AS "relatedKpiComponents",
        COALESCE((
          SELECT jsonb_agg(
            DISTINCT jsonb_build_object('id', criterion.id, 'name', criterion.name)
          )
          FROM "EvidenceLink" link
          INNER JOIN "DynamicCriterion" criterion
            ON criterion.id = link."dynamicCriterionId"
          WHERE link."evidenceRevisionId" = revision.id
        ), '[]'::jsonb) AS "relatedCriteria",
        COALESCE((
          SELECT verification.outcome::text
          FROM "EvidenceVerification" verification
          WHERE verification."evidenceRevisionId" = revision.id
          ORDER BY verification."createdAt" DESC, verification.id DESC
          LIMIT 1
        ), 'unverified') AS "verificationState"
      FROM "AcceptedEvidenceEvent" event
      INNER JOIN "EvidenceRecord" evidence
        ON evidence.id = event."evidenceId"
      INNER JOIN "EvidenceConfirmation" confirmation
        ON confirmation.id = event."confirmationId"
      INNER JOIN "EvidenceRevision" revision
        ON revision.id = confirmation."evidenceRevisionId"
      INNER JOIN "Project" project
        ON project.id = event."projectId"
      LEFT JOIN "Workstream" workstream
        ON workstream.id = event."workstreamId"
      LEFT JOIN "WorkItem" work_item
        ON work_item.id = evidence."workItemId"
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
