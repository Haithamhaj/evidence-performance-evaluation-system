import {
  AppError,
  EvidenceReviewSchema,
  StructuredUpdateDraftSchema,
  UpdateComparisonSchema,
} from "@evaluation/contracts";

import { prepareTimeline } from "./timeline-prepare.js";

type DatabaseClient = import("@evaluation/database").DatabaseClient;

export class ActivityReader {
  private readonly client: DatabaseClient;

  constructor(client: DatabaseClient) {
    this.client = client;
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
      comparison: UpdateComparisonSchema.parse(draft.comparison),
    });
  }

  async evidenceReview(input: Readonly<{ actorId: string; evidenceId: string }>) {
    const record = await this.client.evidenceRecord.findFirst({
      where: { id: input.evidenceId, employeeId: input.actorId },
      include: { revisions: { orderBy: { revision: "desc" }, take: 1 } },
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
    });
  }

  async timeline(input: unknown): Promise<import("@evaluation/contracts").TimelineResponse> {
    return prepareTimeline(this.client, new Date(), input);
  }
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
