type DatabaseClient = import("@evaluation/database").DatabaseClient;
type TimelineCursor = import("./timeline-cursor.js").TimelineCursor;

export function queryTimelineRows(
  client: DatabaseClient,
  input: Readonly<{
    actorId: string;
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
      CASE
        WHEN cardinality(activity."sourceKinds") > 1 THEN 'employee_mixed'
        WHEN activity."sourceKinds"[1] = 'github_automated' THEN 'github_automated'
        WHEN activity."sourceKinds"[1] = 'human_decision' THEN 'human_decision'
        WHEN activity."sourceKinds"[1] = 'pasted_text' THEN 'employee_text'
        WHEN activity."sourceKinds"[1] = 'voice_transcript' THEN 'employee_voice'
        WHEN activity."sourceKinds"[1] IN ('image', 'screenshot', 'file', 'document')
          THEN 'employee_file'
        WHEN activity."sourceKinds"[1] IN ('pasted_code', 'cli_snapshot') THEN 'employee_code'
        WHEN activity."sourceKinds"[1] = 'url' THEN 'employee_url'
        WHEN activity."sourceKinds"[1] = 'github_snapshot' THEN 'employee_github_snapshot'
      END::text AS "sourceProvenance",
      activity."reviewState",
      activity.project,
      activity.workstream,
      activity."workItem",
      activity."relatedKpiComponents",
      activity."relatedCriteria",
      activity."verificationState",
      activity."decisionOutcome"
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
        ARRAY(
          SELECT source_kind
          FROM (
            SELECT 'pasted_text'::text AS source_kind
            WHERE btrim(source."rawText") <> ''
            UNION
            SELECT attachment.kind::text
            FROM "UpdateSourceAttachment" attachment
            WHERE attachment."updateSourceId" = source.id
          ) source_kinds
          ORDER BY source_kind
        ) AS "sourceKinds",
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
        NULL::text AS "verificationState",
        NULL::text AS "decisionOutcome"
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
        ARRAY[
          CASE
            WHEN evidence."githubSourceEventId" IS NOT NULL THEN 'github_automated'
            ELSE revision."sourceKind"::text
          END
        ]::text[] AS "sourceKinds",
        'employee_confirmed'::text AS "reviewState",
        jsonb_build_object('id', project.id, 'name', project.name) AS project,
        CASE WHEN workstream.id IS NULL THEN NULL
          ELSE jsonb_build_object('id', workstream.id, 'name', workstream.name)
        END AS workstream,
        CASE WHEN work_item.id IS NULL THEN NULL
          ELSE jsonb_build_object('id', work_item.id, 'title', work_item.title)
        END AS "workItem",
        COALESCE((
          SELECT jsonb_agg(linked.component ORDER BY linked.name, linked.id)
          FROM (
            SELECT DISTINCT
              component.id,
              component.name,
              jsonb_build_object('id', component.id, 'name', component.name) AS component
            FROM "EvidenceLink" link
            INNER JOIN "ProgressContractComponent" component
              ON component.id = link."progressComponentId"
            WHERE link."evidenceRevisionId" = revision.id
          ) linked
        ), '[]'::jsonb) AS "relatedKpiComponents",
        COALESCE((
          SELECT jsonb_agg(linked.criterion ORDER BY linked.name, linked.id)
          FROM (
            SELECT DISTINCT
              criterion.id,
              criterion.name,
              jsonb_build_object('id', criterion.id, 'name', criterion.name) AS criterion
            FROM "EvidenceLink" link
            INNER JOIN "DynamicCriterion" criterion
              ON criterion.id = link."dynamicCriterionId"
            WHERE link."evidenceRevisionId" = revision.id
          ) linked
        ), '[]'::jsonb) AS "relatedCriteria",
        COALESCE((
          SELECT verification.outcome::text
          FROM "EvidenceVerification" verification
          WHERE verification."evidenceRevisionId" = revision.id
          ORDER BY verification."createdAt" DESC, verification.id DESC
          LIMIT 1
        ), 'unverified') AS "verificationState",
        NULL::text AS "decisionOutcome"
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

      UNION ALL

      SELECT
        draft.id,
        'update'::text AS kind,
        source."projectId",
        source."workstreamId",
        source."workItemId",
        source."employeeId",
        draft."createdAt" AS "occurredAtValue",
        draft.summary AS title,
        draft.result AS detail,
        draft."sourceReferences",
        ARRAY(
          SELECT source_kind
          FROM (
            SELECT 'pasted_text'::text AS source_kind
            WHERE btrim(source."rawText") <> ''
            UNION
            SELECT attachment.kind::text
            FROM "UpdateSourceAttachment" attachment
            WHERE attachment."updateSourceId" = source.id
          ) source_kinds
          ORDER BY source_kind
        ) AS "sourceKinds",
        'ai_draft'::text AS "reviewState",
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
        NULL::text AS "verificationState",
        NULL::text AS "decisionOutcome"
      FROM "StructuredUpdateDraftRevision" draft
      INNER JOIN "UpdateSource" source
        ON source.id = draft."updateSourceId"
      INNER JOIN "Project" project
        ON project.id = source."projectId"
      LEFT JOIN "Workstream" workstream
        ON workstream.id = source."workstreamId"
      LEFT JOIN "WorkItem" work_item
        ON work_item.id = source."workItemId"
      WHERE source."employeeId" = ${input.actorId}::uuid
        AND draft."revisionKind" = 'ai_draft'
        AND draft.revision = (
          SELECT max(latest.revision)
          FROM "StructuredUpdateDraftRevision" latest
          WHERE latest."sessionId" = draft."sessionId"
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "UpdateConfirmation" confirmed
          WHERE confirmed."updateSourceId" = source.id
        )

      UNION ALL

      SELECT
        source_event.id,
        'project_fact'::text AS kind,
        binding."projectId",
        NULL::uuid AS "workstreamId",
        NULL::uuid AS "workItemId",
        NULL::uuid AS "employeeId",
        source_event."occurredAt" AS "occurredAtValue",
        COALESCE(NULLIF(source_event."governedFacts"->0->>'title', ''), source_event."sourceId") AS title,
        COALESCE(NULLIF(source_event."governedFacts"->0->>'state', ''), source_event."eventType") AS detail,
        jsonb_build_array(
          'github-source-event:' || source_event.id::text,
          source_event."sourceUrl"
        ) AS "sourceReferences",
        ARRAY['github_automated']::text[] AS "sourceKinds",
        'automated_project_fact'::text AS "reviewState",
        jsonb_build_object('id', project.id, 'name', project.name) AS project,
        NULL::jsonb AS workstream,
        NULL::jsonb AS "workItem",
        COALESCE((
          SELECT jsonb_agg(linked.component ORDER BY linked.name, linked.id)
          FROM (
            SELECT DISTINCT
              component.id,
              component.name,
              jsonb_build_object('id', component.id, 'name', component.name) AS component
            FROM "GitHubProgressReviewCandidate" candidate
            INNER JOIN "GitHubContractRule" rule
              ON rule.id = candidate."ruleId"
            INNER JOIN "ProgressContractComponent" component
              ON component.id = rule."componentId"
            WHERE candidate."sourceEventId" = source_event.id
          ) linked
        ), '[]'::jsonb) AS "relatedKpiComponents",
        '[]'::jsonb AS "relatedCriteria",
        NULL::text AS "verificationState",
        NULL::text AS "decisionOutcome"
      FROM "GitHubSourceEvent" source_event
      INNER JOIN "GitHubProjectBinding" binding
        ON binding.id = source_event."bindingId"
      INNER JOIN "Project" project
        ON project.id = binding."projectId"
      WHERE source_event."verificationState" = 'VERIFIED'

      UNION ALL

      SELECT
        decision.id,
        'decision'::text AS kind,
        contract."projectId",
        contract."workstreamId",
        NULL::uuid AS "workItemId",
        decision."actorId" AS "employeeId",
        decision."createdAt" AS "occurredAtValue",
        component.name AS title,
        decision.reason AS detail,
        jsonb_build_array(decision."sourceRef") AS "sourceReferences",
        ARRAY['human_decision']::text[] AS "sourceKinds",
        'human_decision'::text AS "reviewState",
        jsonb_build_object('id', project.id, 'name', project.name) AS project,
        CASE WHEN workstream.id IS NULL THEN NULL
          ELSE jsonb_build_object('id', workstream.id, 'name', workstream.name)
        END AS workstream,
        NULL::jsonb AS "workItem",
        jsonb_build_array(jsonb_build_object('id', component.id, 'name', component.name))
          AS "relatedKpiComponents",
        '[]'::jsonb AS "relatedCriteria",
        NULL::text AS "verificationState",
        CASE WHEN decision.satisfied THEN 'satisfied' ELSE 'not_satisfied' END::text
          AS "decisionOutcome"
      FROM "ProgressHumanConfirmation" decision
      INNER JOIN "ProgressContract" contract
        ON contract.id = decision."contractId"
      INNER JOIN "ProgressContractComponent" component
        ON component.id = decision."componentId"
      INNER JOIN "Project" project
        ON project.id = contract."projectId"
      LEFT JOIN "Workstream" workstream
        ON workstream.id = contract."workstreamId"
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
