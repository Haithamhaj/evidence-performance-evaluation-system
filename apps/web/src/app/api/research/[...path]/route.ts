import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { oidcSettings, openAuthCookie, sealAuthCookie } from "../../../../auth/oidc";
import {
  StartResearchReviewInputSchema,
  UpstreamResearchSourceReviewSchema,
  WebResearchSourceReviewSchema,
} from "../../../../platform/research-experiments-contracts";
import { fetchProtectedUpstream, safeWorkspaceError } from "../../../../platform/workspace-api";

type Context = { readonly params: Promise<{ readonly path: string[] }> };
const ConfirmReviewInputSchema = z
  .object({
    reviewHandle: z.string().min(32).max(4_096),
    expectedVersion: z.number().int().positive(),
    proposalHandles: z.array(z.string().min(32).max(4_096)).min(1).max(20),
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict()
  .superRefine((input, context) => {
    if (new Set(input.proposalHandles).size !== input.proposalHandles.length) {
      context.addIssue({ code: "custom", path: ["proposalHandles"], message: "Duplicate handle" });
    }
  });
const UuidSchema = z.string().uuid();
const ResearchScopeSchema = z
  .object({
    projectId: UuidSchema,
    workstreamId: UuidSchema.nullable(),
    workItemId: UuidSchema.nullable(),
  })
  .strict();
const UpstreamResearchQuerySchema = z
  .object({
    detail: z
      .object({
        id: UuidSchema,
        scope: ResearchScopeSchema,
        state: z.enum(["DRAFT", "ACTIVE", "CONCLUDED", "CANCELLED", "SUPERSEDED"]),
        version: z.number().int().positive(),
        currentRevision: z
          .object({
            question: z.string().trim().min(1).max(4_000),
            objective: z.string().trim().min(1).max(4_000),
          })
          .passthrough(),
      })
      .passthrough(),
    participantEvents: z.array(z.unknown()).optional(),
    transitions: z.array(z.unknown()).optional(),
    sourceReferences: z.array(
      z
        .object({
          title: z.string().trim().min(1).max(500),
          canonicalUrl: z.url().nullable(),
        })
        .passthrough(),
    ),
  })
  .strict();
const UpstreamExperimentQuerySchema = z
  .object({
    detail: z
      .object({
        id: UuidSchema,
        researchId: UuidSchema,
        scope: ResearchScopeSchema,
        state: z.enum([
          "DRAFT",
          "READY",
          "RUNNING",
          "RESULT_RECORDED",
          "CONCLUDED",
          "ABANDONED",
          "SUPERSEDED",
        ]),
        version: z.number().int().positive(),
        currentMethod: z.object({ question: z.string().trim().min(1).max(4_000) }).passthrough(),
      })
      .passthrough(),
    methodRevisions: z.array(z.unknown()).optional(),
    runs: z.array(
      z
        .object({
          resultStatus: z.enum(["COMPLETED", "FAILED", "INVALID", "STOPPED"]),
          executionNotes: z.string().trim().min(1).max(8_000),
        })
        .passthrough(),
    ),
    aiDrafts: z.array(z.unknown()).optional(),
    conclusions: z.array(
      z
        .object({
          summary: z.string().trim().min(1).max(8_000),
          limitations: z.array(z.string().trim().min(1).max(2_000)).max(50).optional(),
        })
        .passthrough(),
    ),
  })
  .strict();
const WebResearchDetailSchema = z
  .object({
    handle: z.string().min(32).max(4_096),
    state: z.enum(["DRAFT", "ACTIVE", "CONCLUDED", "CANCELLED", "SUPERSEDED"]),
    question: z.string().trim().min(1).max(4_000),
    objective: z.string().trim().min(1).max(4_000),
    sources: z.array(
      z.object({ title: z.string().trim().min(1).max(500), url: z.url().nullable() }).strict(),
    ),
  })
  .strict();
const WebExperimentDetailSchema = z
  .object({
    handle: z.string().min(32).max(4_096),
    state: z.enum([
      "DRAFT",
      "READY",
      "RUNNING",
      "RESULT_RECORDED",
      "CONCLUDED",
      "ABANDONED",
      "SUPERSEDED",
    ]),
    question: z.string().trim().min(1).max(4_000),
    result: z.string().trim().min(1).max(8_000).nullable(),
    resultStatus: z.enum(["COMPLETED", "FAILED", "INVALID", "STOPPED"]).nullable(),
    humanConclusion: z.string().trim().min(1).max(8_000).nullable(),
  })
  .strict();

export async function GET(request: Request, context: Context): Promise<NextResponse> {
  const path = (await context.params).path;
  if (!safeRequestPath(request, path) || hasDuplicateQueryKeys(request)) return notFound();
  if (new URL(request.url).search !== "") return notFound();
  try {
    if (path.length === 2 && path[0] === "records") {
      const handle = openHandle(path[1]!, "research");
      const result = await fetchProtectedUpstream({
        path: `/api/v1/research/${handle.id}`,
        schema: UpstreamResearchQuerySchema,
      });
      if (result.detail.scope.projectId !== handle.projectId) return notFound();
      return json(
        WebResearchDetailSchema.parse({
          handle: path[1],
          state: result.detail.state,
          question: result.detail.currentRevision.question,
          objective: result.detail.currentRevision.objective,
          sources: result.sourceReferences.map((source) => ({
            title: source.title,
            url: source.canonicalUrl,
          })),
        }),
      );
    }
    if (path.length === 2 && path[0] === "experiments") {
      const handle = openHandle(path[1]!, "experiment");
      const result = await fetchProtectedUpstream({
        path: `/api/v1/experiments/${handle.id}`,
        schema: UpstreamExperimentQuerySchema,
      });
      if (result.detail.scope.projectId !== handle.projectId) return notFound();
      const run = result.runs.at(-1) ?? null;
      const conclusion = result.conclusions.at(-1) ?? null;
      return json(
        WebExperimentDetailSchema.parse({
          handle: path[1],
          state: result.detail.state,
          question: result.detail.currentMethod.question,
          result: run?.executionNotes ?? null,
          resultStatus: run?.resultStatus ?? null,
          humanConclusion: conclusion?.summary ?? null,
        }),
      );
    }
  } catch (error) {
    return safeError(error);
  }
  return notFound();
}

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  const path = (await context.params).path;
  if (!safeRequestPath(request, path) || new URL(request.url).search !== "") return notFound();
  if (path.length === 2 && path[0] === "source-reviews" && path[1] === "confirm") {
    return confirmReview(request);
  }
  if (path.length !== 1 || path[0] !== "source-reviews") return notFound();

  let input: z.infer<typeof StartResearchReviewInputSchema>;
  try {
    input = StartResearchReviewInputSchema.parse(await request.json());
  } catch {
    return invalid();
  }

  try {
    const detail = await fetchProtectedUpstream({
      method: "POST",
      path: "/api/v1/research/source-reviews",
      body: {
        scope: { projectId: input.projectId, workstreamId: null, workItemId: null },
        idempotencyKey: randomUUID(),
        source: { kind: "URL", url: input.url },
      },
      schema: UpstreamResearchSourceReviewSchema,
    });
    return json(projectReview(detail));
  } catch (error) {
    return safeError(error);
  }
}

async function confirmReview(request: Request): Promise<NextResponse> {
  let input: z.infer<typeof ConfirmReviewInputSchema>;
  try {
    input = ConfirmReviewInputSchema.parse(await request.json());
  } catch {
    return invalid();
  }
  try {
    const review = openHandle(input.reviewHandle, "source_review");
    if (review.revision !== input.expectedVersion) return invalid();
    const proposalIds = input.proposalHandles.map((handle) => {
      const proposal = openHandle(handle, "proposal");
      if (proposal.projectId !== review.projectId || proposal.revision !== review.revision) {
        throw new Error("RESEARCH_HANDLE_SCOPE_MISMATCH");
      }
      return proposal.id;
    });
    await fetchProtectedUpstream({
      method: "POST",
      path: `/api/v1/research/source-reviews/${review.id}/disposition`,
      body: {
        expectedVersion: input.expectedVersion,
        disposition: "CONFIRM",
        proposalIds,
        reason: input.reason,
      },
      schema: UpstreamResearchSourceReviewSchema,
    });
    return json({ state: "confirmed", officialTaskCreated: false });
  } catch (error) {
    return safeError(error);
  }
}

function projectReview(detail: z.infer<typeof UpstreamResearchSourceReviewSchema>) {
  const displayUrl = detail.displayUrl;
  return WebResearchSourceReviewSchema.parse({
    handle: sealHandle("source_review", detail.id, detail.scope.projectId, detail.version),
    state: detail.state,
    version: detail.version,
    displayUrl,
    retrievalState: detail.retrievalState,
    retrievalReason: detail.retrievalReason,
    output:
      detail.output === null
        ? null
        : {
            summary: detail.output.summary,
            relevance: detail.output.relevance,
            citations: detail.output.citations.map((citation, index) => ({
              label: `Source ${index + 1}`,
              locator: citation.locator,
              url: displayUrl,
            })),
            benefits: detail.output.benefits,
            risks: detail.output.risks,
            mismatches: detail.output.mismatches,
            uncertainties: detail.output.uncertainties,
            proposals: detail.output.proposals.map((proposal) => projectProposal(proposal, detail)),
          },
    recoveryOptions: detail.recoveryOptions,
  });
}

function projectProposal(
  proposal: NonNullable<
    z.infer<typeof UpstreamResearchSourceReviewSchema>["output"]
  >["proposals"][number],
  detail: z.infer<typeof UpstreamResearchSourceReviewSchema>,
) {
  const common = {
    handle: sealHandle("proposal", proposal.id, detail.scope.projectId, detail.version),
    kind: proposal.kind,
    title: proposal.title,
    rationale: proposal.rationale,
  };
  if (proposal.kind === "RESEARCH") {
    return {
      ...common,
      kind: proposal.kind,
      question: proposal.question,
      objective: proposal.objective,
    };
  }
  if (proposal.kind === "EXPERIMENT") {
    return {
      ...common,
      kind: proposal.kind,
      question: proposal.question,
      baseline: proposal.baseline,
      measureNames: proposal.measureNames,
    };
  }
  return {
    ...common,
    kind: proposal.kind,
    description: proposal.description,
    acceptanceConditions: proposal.acceptanceConditions,
  };
}

function sealHandle(
  action: "source_review" | "proposal",
  id: string,
  projectId: string,
  version: number,
) {
  return sealAuthCookie(
    {
      kind: "context_handle",
      action,
      id,
      projectId,
      revision: version,
      expiresAt: Date.now() + 15 * 60_000,
    },
    oidcSettings().sessionSecret,
  );
}

function openHandle(
  handle: string,
  action: "source_review" | "proposal" | "research" | "experiment",
) {
  const payload = openAuthCookie(handle, oidcSettings().sessionSecret, "context_handle") as Record<
    string,
    unknown
  >;
  if (
    payload.action !== action ||
    typeof payload.id !== "string" ||
    typeof payload.projectId !== "string" ||
    typeof payload.revision !== "number" ||
    !z.string().uuid().safeParse(payload.id).success ||
    !z.string().uuid().safeParse(payload.projectId).success
  ) {
    throw new Error("RESEARCH_HANDLE_INVALID");
  }
  return { id: payload.id, projectId: payload.projectId, revision: payload.revision };
}

function safeRequestPath(request: Request, path: readonly string[]): boolean {
  return (
    !/%(?:2e|2f|5c)/iu.test(request.url) &&
    path.length > 0 &&
    path.every((segment) => segment !== "." && segment !== ".." && !segment.includes("/"))
  );
}

function hasDuplicateQueryKeys(request: Request): boolean {
  const entries = [...new URL(request.url).searchParams.keys()];
  return new Set(entries).size !== entries.length;
}

function json(value: unknown): NextResponse {
  return NextResponse.json(value, { status: 200 });
}

function invalid(): NextResponse {
  return NextResponse.json(
    { messageKey: "errors.validation", correlationId: randomUUID() },
    { status: 400 },
  );
}

function notFound(): NextResponse {
  return NextResponse.json(
    { messageKey: "errors.notFound", correlationId: randomUUID() },
    { status: 404 },
  );
}

function safeError(error: unknown): NextResponse {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { messageKey: "errors.internal", correlationId: randomUUID() },
      { status: 500 },
    );
  }
  const safe = safeWorkspaceError(error);
  return NextResponse.json(
    { messageKey: safe.messageKey, correlationId: safe.correlationId },
    { status: safe.status },
  );
}

export const PATCH = () => notFound();
export const PUT = () => notFound();
export const DELETE = () => notFound();
export const HEAD = () => notFound();
export const OPTIONS = () => notFound();
