import {
  AppError,
  EvidenceReviewSchema,
  EvidenceWorkspaceSchema,
  StructuredUpdateDraftSchema,
  UpdateComparisonSchema,
  UpdateResultCardSchema,
} from "@evaluation/contracts";
import { z } from "zod";

import { prepareTimeline } from "./timeline-prepare.js";
import {
  decodeTimelineCursor,
  encodeTimelineCursor,
  itemFollowsCursor,
} from "./timeline-cursor.js";

type DatabaseClient = import("@evaluation/database").DatabaseClient;

export class ActivityReader {
  private readonly client: DatabaseClient;
  private readonly research: ResearchTimelineSourceReader | null;

  constructor(client: DatabaseClient, research: ResearchTimelineSourceReader | null = null) {
    this.client = client;
    this.research = research;
  }

  async updateReview(input: Readonly<{ actorId: string; sessionId: string }>) {
    const session = await this.client.clarificationSession.findFirst({
      where: { id: input.sessionId, updateSource: { employeeId: input.actorId } },
      include: {
        draftRevisions: { orderBy: { revision: "desc" }, take: 1 },
      },
    });
    const draft = session?.draftRevisions[0];
    if (session === null || draft === undefined) throw scopeError();
    return StructuredUpdateDraftSchema.parse({
      id: draft.id,
      sessionId: session.id,
      revision: draft.revision,
      summary: draft.summary,
      result: draft.result,
      blocker: draft.blocker,
      nextAction: draft.nextAction,
      contributionContext: draft.contributionContext,
      executionMode: draft.executionMode,
      sourceReferences: stringArray(draft.sourceReferences),
      evidenceIds: [],
      documentationNeeds: stringArray(draft.documentationNeeds),
      relatedProgressComponentIds: stringArray(draft.relatedProgressComponentIds),
      comparison: UpdateComparisonSchema.parse(draft.comparison),
    });
  }

  async updateResult(
    input: Readonly<{ actorId: string; acceptedEventId: string }>,
  ): Promise<import("@evaluation/contracts").UpdateResultCard> {
    const event = await this.client.acceptedUpdateEvent.findFirst({
      where: { id: input.acceptedEventId, employeeId: input.actorId },
      include: {
        project: { select: { id: true, name: true } },
        workstream: { select: { id: true, name: true } },
        workItem: { select: { id: true, title: true } },
        confirmation: { include: { draftRevision: true } },
      },
    });
    if (event === null) throw scopeError();

    const snapshotSource = await this.client.progressSnapshotSource.findFirst({
      where: {
        sourceKind: "update",
        sourceId: event.id,
      },
      orderBy: { createdAt: "desc" },
      include: { snapshot: true },
    });
    const draft = event.confirmation.draftRevision;
    const documentationNeeds = stringArray(draft.documentationNeeds);
    const relatedProgressComponentIds = stringArray(draft.relatedProgressComponentIds);
    const comparison = UpdateComparisonSchema.parse(draft.comparison);

    return UpdateResultCardSchema.parse({
      acceptedEventId: event.id,
      project: event.project,
      workstream: event.workstream,
      workItem: event.workItem,
      summary: draft.summary,
      result: draft.result,
      sourceReferences: stringArray(event.sourceReferences),
      comparison: {
        previousAcceptedEventId: comparison.previousAcceptedEventId,
        explanation: comparison.explanation,
      },
      blocker: draft.blocker,
      nextAction: draft.nextAction,
      documentationNeeds,
      progressImpact:
        snapshotSource !== null
          ? {
              state: "applied",
              snapshotId: snapshotSource.snapshot.id,
              previousPercent: Number(snapshotSource.snapshot.previousPercent),
              percent: Number(snapshotSource.snapshot.percent),
            }
          : documentationNeeds.length > 0
            ? { state: "insufficient_information", missing: documentationNeeds }
            : relatedProgressComponentIds.length > 0
              ? {
                  state: "awaiting_confirmation",
                  componentIds: relatedProgressComponentIds,
                }
              : { state: "no_measurable_impact" },
      confirmedAt: event.confirmation.confirmedAt.toISOString(),
    });
  }

  async evidenceReview(input: Readonly<{ actorId: string; evidenceId: string }>) {
    const record = await this.client.evidenceRecord.findFirst({
      where: { id: input.evidenceId, employeeId: input.actorId },
      include: {
        project: { select: { id: true, name: true } },
        workstream: { select: { id: true, name: true } },
        workItem: { select: { id: true, title: true } },
        revisions: {
          orderBy: { revision: "desc" },
          take: 1,
          include: {
            links: {
              include: {
                progressComponent: { select: { id: true, name: true } },
                dynamicCriterion: { select: { id: true, name: true } },
              },
            },
            verifications: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 },
          },
        },
      },
    });
    const revision = record?.revisions[0];
    if (record === null || revision === undefined) throw scopeError();
    return EvidenceReviewSchema.parse({
      id: record.id,
      revisionId: revision.id,
      projectId: record.projectId,
      workstreamId: record.workstreamId,
      workItemId: record.workItemId,
      state: record.state,
      revision: revision.revision,
      revisionKind: revision.revisionKind,
      sourceKind: revision.sourceKind,
      sourceText: revision.sourceText,
      sourceUrl: revision.sourceUrl,
      mediaType: revision.mediaType,
      supportedClaim: revision.supportedClaim,
      contributionContext: revision.contributionContext,
      executionMode: revision.executionMode,
      sourceProvenance: evidenceSourceProvenance(record.githubSourceEventId, revision.sourceKind),
      project: record.project,
      workstream: record.workstream,
      workItem: record.workItem,
      relatedKpiComponents: revision.links.flatMap((link) =>
        link.progressComponent === null ? [] : [link.progressComponent],
      ),
      relatedCriteria: revision.links.flatMap((link) =>
        link.dynamicCriterion === null ? [] : [link.dynamicCriterion],
      ),
      verificationState: revision.verifications[0]?.outcome ?? "unverified",
    });
  }

  async evidenceWorkspace(input: unknown) {
    const parsed = EvidenceWorkspaceInputSchema.parse(input);
    const records = await this.client.evidenceRecord.findMany({
      where: {
        employeeId: parsed.actorId,
        ...(parsed.projectId === null ? {} : { projectId: parsed.projectId }),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: parsed.limit,
      include: {
        project: { select: { id: true, name: true } },
        workItem: { select: { id: true, title: true } },
        revisions: {
          orderBy: { revision: "desc" },
          take: 1,
          include: {
            attributions: {
              where: { employeeId: parsed.actorId },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 1,
            },
            verifications: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 },
          },
        },
      },
    });
    const history = records.flatMap((record) => {
      const revision = record.revisions[0];
      if (revision === undefined) return [];
      return [
        {
          id: record.id,
          project: record.project,
          workItem: record.workItem,
          state: record.state,
          revision: revision.revision,
          revisionKind: revision.revisionKind,
          sourceKind: revision.sourceKind,
          supportedClaim: revision.supportedClaim,
          contributionContext: revision.contributionContext,
          verificationState: revision.verifications[0]?.outcome ?? "unverified",
          attributionState: revision.attributions[0]?.state ?? null,
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString(),
        },
      ];
    });
    return EvidenceWorkspaceSchema.parse({
      confirmed: history.filter((item) => item.state === "confirmed"),
      pending: history.filter((item) => item.state === "draft"),
      attributionIssues: history.filter(
        (item) => item.attributionState === "proposed" || item.attributionState === "disputed",
      ),
      gaps: history.filter(
        (item) =>
          item.verificationState === "unverified" ||
          item.verificationState === "partial" ||
          item.verificationState === "conflicting",
      ),
      history,
    });
  }

  async timeline(input: unknown): Promise<import("@evaluation/contracts").TimelineResponse> {
    if (this.research === null) return prepareTimeline(this.client, new Date(), input);
    const parsed = TimelineCompositionInputSchema.parse(input);
    const cursor = parsed.cursor === null ? null : decodeTimelineCursor(parsed.cursor);
    // The existing reader performs the Project authorization before Research is asked for data.
    const existing = await prepareTimeline(this.client, new Date(), parsed);
    const research = await this.research.readTimeline({ ...parsed, cursor });
    const items = [...existing.items, ...research]
      .filter((item) => cursor === null || itemFollowsCursor(item, cursor))
      .sort(compareTimelineItems)
      .slice(0, parsed.limit);
    return {
      items,
      nextCursor:
        items.length < parsed.limit || items.length === 0
          ? null
          : encodeTimelineCursor(items[items.length - 1]!),
    };
  }
}

const TimelineCompositionInputSchema = z
  .object({
    actorId: z.string().uuid(),
    projectId: z.string().uuid(),
    workstreamId: z.string().uuid().nullable(),
    limit: z.number().int().min(1).max(50),
    cursor: z.string().min(1).max(1_000).nullable(),
  })
  .strict();

const EvidenceWorkspaceInputSchema = z
  .object({
    actorId: z.string().uuid(),
    projectId: z.string().uuid().nullable().default(null),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict();

export interface ResearchTimelineSourceReader {
  readTimeline(
    input: Readonly<{
      actorId: string;
      projectId: string;
      workstreamId: string | null;
      limit: number;
      cursor: import("./timeline-cursor.js").TimelineCursor | null;
    }>,
  ): Promise<import("@evaluation/contracts").TimelineItem[]>;
}

function compareTimelineItems(
  left: import("@evaluation/contracts").TimelineItem,
  right: import("@evaluation/contracts").TimelineItem,
): number {
  return (
    right.occurredAt.localeCompare(left.occurredAt) ||
    right.kind.localeCompare(left.kind) ||
    right.id.localeCompare(left.id)
  );
}

function evidenceSourceProvenance(
  githubSourceEventId: string | null,
  sourceKind: string,
): "github_automated" | "employee_text" | "employee_file" | "employee_code" | "employee_url" {
  if (githubSourceEventId !== null) return "github_automated";
  if (sourceKind === "pasted_text") return "employee_text";
  if (sourceKind === "pasted_code" || sourceKind === "cli_snapshot") return "employee_code";
  if (sourceKind === "url") return "employee_url";
  return "employee_file";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new AppError("UPDATE_STATE_INVALID", "errors.updates.stateInvalid", 409);
  }
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      throw new AppError("UPDATE_STATE_INVALID", "errors.updates.stateInvalid", 409);
    }
    items.push(item);
  }
  return items;
}

function scopeError(): AppError {
  return new AppError("SCOPE_MISMATCH", "errors.authorization.scopeMismatch", 403);
}
