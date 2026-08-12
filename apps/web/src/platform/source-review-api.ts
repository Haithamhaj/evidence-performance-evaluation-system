import { TimelineResponseSchema } from "./updates-evidence-contracts";
import {
  linkContextProject,
  listConnectedWorkContext,
  setContextExclusion,
  unlinkContextProject,
} from "./connected-work-context-api";

export type SourceReviewProject = Readonly<{ id: string; name: string }>;
export type GoogleReviewSource = Readonly<{
  kind: "google";
  id: string;
  provider: "GOOGLE_GMAIL" | "GOOGLE_CALENDAR";
  title: string;
  summary: string | null;
  sourceUrl: string | null;
  occurredAt: string;
  projectId: string | null;
  excluded: boolean;
}>;
export type GitHubReviewSource = Readonly<{
  kind: "github";
  id: string;
  title: string;
  summary: string;
  occurredAt: string;
  projectId: string;
  projectName: string;
}>;
export type SourceReviewSource = GoogleReviewSource | GitHubReviewSource;

export type SourceReviewGateway = Readonly<{
  load(projects: readonly SourceReviewProject[]): Promise<readonly SourceReviewSource[]>;
  correctGoogleProject(input: {
    readonly sourceId: string;
    readonly previousProjectId: string | null;
    readonly projectId: string;
    readonly reason: string;
  }): Promise<void>;
  excludeGoogleSource(sourceId: string): Promise<void>;
}>;

export const sourceReviewGateway: SourceReviewGateway = {
  async load(projects) {
    const [connected, ...timelines] = await Promise.allSettled([
      listConnectedWorkContext(),
      ...projects.map((project) => listProjectTimeline(project)),
    ]);
    const sources: SourceReviewSource[] = [];
    if (connected?.status === "fulfilled") {
      sources.push(
        ...connected.value.items
          .filter((item) => !item.excluded)
          .map((item) => ({
            kind: "google" as const,
            id: item.id,
            provider: item.provider,
            title: item.title,
            summary: item.summary,
            sourceUrl: item.sourceUrl,
            occurredAt: item.occurredAt,
            projectId: item.projectId,
            excluded: item.excluded,
          })),
      );
    }
    for (const timeline of timelines) {
      if (timeline.status === "fulfilled") sources.push(...timeline.value);
    }
    if (
      sources.length === 0 &&
      [connected, ...timelines].every((item) => item?.status === "rejected")
    ) {
      throw new Error("SOURCE_REVIEW_UNAVAILABLE");
    }
    return deduplicate(sources).sort((left, right) =>
      right.occurredAt.localeCompare(left.occurredAt),
    );
  },
  async correctGoogleProject(input) {
    const replacing =
      input.previousProjectId !== null && input.previousProjectId !== input.projectId;
    if (replacing) {
      await unlinkContextProject({
        id: input.sourceId,
        reason: "Employee corrected the source Project before evidence review",
      });
    }
    try {
      await linkContextProject({
        id: input.sourceId,
        projectId: input.projectId,
        reason: input.reason,
      });
    } catch (error) {
      if (replacing) throw new SourceReviewLinkError(error);
      throw error;
    }
  },
  async excludeGoogleSource(sourceId) {
    await setContextExclusion(sourceId, true);
  },
};

export class SourceReviewLinkError extends Error {
  readonly code = "SOURCE_REVIEW_RELINK_FAILED";
  readonly previousLinkRemoved = true;

  constructor(cause: unknown) {
    super("The previous Project link was removed before the replacement failed", { cause });
    this.name = "SourceReviewLinkError";
  }
}

async function listProjectTimeline(project: SourceReviewProject): Promise<GitHubReviewSource[]> {
  const query = new URLSearchParams({ projectId: project.id, limit: "10" });
  const response = await fetch(`/api/daily-work/timeline?${query.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("SOURCE_REVIEW_TIMELINE_FAILED");
  const timeline = TimelineResponseSchema.parse(await response.json());
  return timeline.items.flatMap((item) => {
    const sourceEventId = sourceReferenceId(item.sourceReferences, "github-source-event");
    if (item.kind !== "project_fact" || sourceEventId === null) return [];
    return [
      {
        kind: "github" as const,
        id: sourceEventId,
        title: item.title,
        summary: item.detail,
        occurredAt: item.occurredAt,
        projectId: item.project.id,
        projectName: item.project.name,
      },
    ];
  });
}

function sourceReferenceId(references: readonly string[], kind: string): string | null {
  const prefix = `${kind}:`;
  const reference = references.find((value) => value.startsWith(prefix));
  return reference?.slice(prefix.length) ?? null;
}

function deduplicate(sources: readonly SourceReviewSource[]): SourceReviewSource[] {
  return [...new Map(sources.map((source) => [`${source.kind}:${source.id}`, source])).values()];
}
