import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { oidcSettings, openAuthCookie, sealAuthCookie } from "../../../../auth/oidc";
import {
  ConfirmWebResearchDecisionInputSchema,
  CreateWebExperimentInputSchema,
  CreateWebResearchRecordInputSchema,
  StartResearchReviewInputSchema,
  UpstreamResearchSourceReviewSchema,
  WebExperimentRecordListSchema,
  WebExperimentRecordSchema,
  WebResearchRecordSchema,
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
          id: UuidSchema.optional(),
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
const UpstreamResearchListSchema = z.array(
  z
    .object({
      id: UuidSchema,
      projectId: UuidSchema,
      workstreamId: UuidSchema.nullable(),
      workItemId: UuidSchema.nullable(),
      ownerId: UuidSchema,
      state: z.enum(["DRAFT", "ACTIVE", "CONCLUDED", "CANCELLED", "SUPERSEDED"]),
      revision: z.number().int().positive(),
      version: z.number().int().positive(),
      createdAt: z.iso.datetime({ offset: true }),
      transitionedAt: z.iso.datetime({ offset: true }),
    })
    .strict(),
);
const UpstreamResearchWorkspaceDetailSchema = z
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
            assumptions: z.array(z.string().trim().min(1).max(2_000)).max(50),
            constraints: z.array(z.string().trim().min(1).max(2_000)).max(50),
            knownUncertainty: z.array(z.string().trim().min(1).max(2_000)).max(50),
            decisionQuestion: z.string().trim().min(1).max(4_000),
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
          relevanceNote: z.string().trim().min(1).max(4_000),
          credibilityNote: z.string().trim().min(1).max(4_000),
        })
        .passthrough(),
    ),
    conclusions: z
      .array(
        z
          .object({
            id: UuidSchema,
            synthesis: z.string().trim().min(1).max(8_000),
            answer: z.string().trim().min(1).max(8_000),
            remainingUncertainty: z.array(z.string().trim().min(1).max(2_000)).max(50),
            decision: z.enum([
              "ADOPT",
              "REJECT",
              "DEFER",
              "REFINE",
              "RUN_ANOTHER_EXPERIMENT",
              "NO_DECISION",
            ]),
            rationale: z.string().trim().min(1).max(8_000),
            nextAction: z.string().trim().min(1).max(4_000),
            confirmedAt: z.iso.datetime({ offset: true }),
          })
          .passthrough(),
      )
      .default([]),
    appliedLearning: z
      .array(
        z
          .object({
            id: UuidSchema,
            researchConclusionId: UuidSchema,
            targetKind: z.enum([
              "WORK_ITEM",
              "UPDATE",
              "DOCUMENT_VERSION",
              "PROGRESS_CONTRACT_PROPOSAL",
              "CRITERION_PROPOSAL",
              "RESEARCH",
              "EXPERIMENT",
              "KNOWLEDGE_TRANSFER",
            ]),
            whatChanged: z.string().trim().min(1).max(8_000),
            causalRationale: z.string().trim().min(1).max(8_000),
            confirmedAt: z.iso.datetime({ offset: true }),
          })
          .passthrough(),
      )
      .default([]),
  })
  .strict();
const UpstreamExperimentListSchema = z.array(
  z
    .object({
      id: UuidSchema,
      researchId: UuidSchema,
      projectId: UuidSchema,
      workstreamId: UuidSchema.nullable(),
      workItemId: UuidSchema.nullable(),
      title: z.string().trim().min(1).max(500),
      state: z.enum([
        "DRAFT",
        "READY",
        "RUNNING",
        "RESULT_RECORDED",
        "CONCLUDED",
        "ABANDONED",
        "SUPERSEDED",
      ]),
      methodRevision: z.number().int().positive(),
      version: z.number().int().positive(),
      createdAt: z.iso.datetime({ offset: true }),
      transitionedAt: z.iso.datetime({ offset: true }),
    })
    .strict(),
);
const UpstreamVersionResultSchema = z
  .object({ version: z.number().int().positive() })
  .passthrough();
const UpstreamSourceResultSchema = z
  .object({
    sourceReferenceId: UuidSchema,
    sourceReference: z.string().startsWith("research-source:"),
    version: z.number().int().positive(),
  })
  .passthrough();
const UpstreamResearchConclusionResultSchema = z
  .object({
    id: UuidSchema,
    decision: z.enum([
      "ADOPT",
      "REJECT",
      "DEFER",
      "REFINE",
      "RUN_ANOTHER_EXPERIMENT",
      "NO_DECISION",
    ]),
  })
  .passthrough();
const UpstreamAppliedLearningResultSchema = z
  .object({ id: UuidSchema, researchConclusionId: UuidSchema, targetKind: z.literal("RESEARCH") })
  .passthrough();
const UpstreamExperimentWorkspaceDetailSchema = z
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
        currentMethod: z
          .object({
            question: z.string().trim().min(1).max(4_000),
            baseline: z
              .object({
                description: z.string().trim().min(1).max(4_000),
                value: z.string().trim().min(1).max(4_000).nullable(),
                sourceReference: z.string().nullable(),
              })
              .strict(),
            measures: z.array(z.object({ name: z.string().trim().min(1).max(500) }).passthrough()),
            testCases: z.array(
              z.object({ inputIdentity: z.string().trim().min(1).max(2_000) }).passthrough(),
            ),
            controls: z.array(
              z.object({ constantConditions: z.string().trim().min(1).max(4_000) }).passthrough(),
            ),
            conditions: z.array(z.string().trim().min(1).max(2_000)).max(50),
            reproducibilityInstructions: z.string().trim().min(1).max(8_000),
          })
          .passthrough(),
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
          limitations: z.array(z.string().trim().min(1).max(2_000)).max(50),
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
const UpstreamCreatedResearchSchema = z
  .object({
    id: UuidSchema,
    scope: ResearchScopeSchema,
    ownerId: UuidSchema,
    state: z.enum(["DRAFT", "ACTIVE", "CONCLUDED", "CANCELLED", "SUPERSEDED"]),
    revision: z.number().int().positive(),
    version: z.number().int().positive(),
    currentRevision: z
      .object({
        id: UuidSchema,
        revision: z.number().int().positive(),
        problemStatement: z.string().trim().min(1).max(8_000),
        context: z.string().trim().min(1).max(8_000),
        question: z.string().trim().min(1).max(4_000),
        objective: z.string().trim().min(1).max(4_000),
        hypothesis: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("TESTABLE"), statement: z.string().min(1) }).strict(),
          z.object({ kind: z.literal("NO_HYPOTHESIS"), reason: z.string().min(1) }).strict(),
        ]),
        assumptions: z.array(z.string().trim().min(1).max(2_000)).max(50),
        constraints: z.array(z.string().trim().min(1).max(2_000)).max(50),
        knownUncertainty: z.array(z.string().trim().min(1).max(2_000)).max(50),
        alternatives: z.array(z.string().trim().min(1).max(2_000)).max(50),
        decisionQuestion: z.string().trim().min(1).max(4_000),
        sourceReferences: z.array(z.string()).max(100),
        executionMode: z.enum(["manual", "ai_assisted", "agent_generated", "mixed"]),
        origin: z.enum(["EMPLOYEE", "AI_DRAFT"]),
        aiProvenance: z.unknown().nullable(),
        authorId: UuidSchema,
        createdAt: z.iso.datetime({ offset: true }),
      })
      .strict(),
    createdAt: z.iso.datetime({ offset: true }),
    transitionedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export async function GET(request: Request, context: Context): Promise<NextResponse> {
  const path = (await context.params).path;
  if (!safeRequestPath(request, path) || hasDuplicateQueryKeys(request)) return notFound();
  const url = new URL(request.url);
  if (path.length === 1 && path[0] === "records") return listResearch(url);
  if (url.search !== "") return notFound();
  try {
    if (path.length === 3 && path[0] === "records" && path[2] === "experiments") {
      return listExperiments(path[1]!);
    }
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

async function listExperiments(researchHandle: string): Promise<NextResponse> {
  try {
    const research = openHandle(researchHandle, "research");
    const records = await fetchProtectedUpstream({
      path: `/api/v1/experiments/research/${research.id}`,
      schema: UpstreamExperimentListSchema,
    });
    const details = await Promise.all(
      records.slice(0, 20).map((record) =>
        fetchProtectedUpstream({
          path: `/api/v1/experiments/${record.id}`,
          schema: UpstreamExperimentWorkspaceDetailSchema,
        }).then((detail) => ({ detail, title: record.title })),
      ),
    );
    return json(
      WebExperimentRecordListSchema.parse(
        details.map(({ detail, title }) => {
          if (
            detail.detail.researchId !== research.id ||
            detail.detail.scope.projectId !== research.projectId
          ) {
            throw new Error("EXPERIMENT_SCOPE_MISMATCH");
          }
          const run = detail.runs.at(-1) ?? null;
          const conclusion = detail.conclusions.at(-1) ?? null;
          const method = detail.detail.currentMethod;
          return WebExperimentRecordSchema.parse({
            handle: sealExperimentHandle(
              detail.detail.id,
              research.projectId,
              detail.detail.version,
            ),
            title,
            state: detail.detail.state,
            version: detail.detail.version,
            question: method.question,
            baseline: method.baseline.value ?? method.baseline.description,
            measures: method.measures.map(({ name }) => name),
            testCases: method.testCases.map(({ inputIdentity }) => inputIdentity),
            controls: method.controls.map(({ constantConditions }) => constantConditions),
            versions: method.conditions,
            reproducibility: method.reproducibilityInstructions,
            result: run?.executionNotes ?? null,
            resultStatus: run?.resultStatus ?? null,
            humanConclusion: conclusion?.summary ?? null,
            limitations: conclusion?.limitations ?? [],
          });
        }),
      ),
    );
  } catch (error) {
    return safeError(error);
  }
}

async function listResearch(url: URL): Promise<NextResponse> {
  const projectId = url.searchParams.get("projectId");
  if (
    projectId === null ||
    url.searchParams.size !== 1 ||
    !z.string().uuid().safeParse(projectId).success
  ) {
    return notFound();
  }
  try {
    const records = await fetchProtectedUpstream({
      path: `/api/v1/research?projectId=${encodeURIComponent(projectId)}`,
      schema: UpstreamResearchListSchema,
    });
    const details = await Promise.all(
      records.slice(0, 20).map((record) =>
        fetchProtectedUpstream({
          path: `/api/v1/research/${record.id}`,
          schema: UpstreamResearchWorkspaceDetailSchema,
        }),
      ),
    );
    return json(
      details.map((result) => {
        if (result.detail.scope.projectId !== projectId) throw new Error("RESEARCH_SCOPE_MISMATCH");
        return projectResearchRecord(result);
      }),
    );
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  const path = (await context.params).path;
  if (!safeRequestPath(request, path) || new URL(request.url).search !== "") return notFound();
  if (path.length === 2 && path[0] === "source-reviews" && path[1] === "confirm") {
    return confirmReview(request);
  }
  if (path.length === 3 && path[0] === "records" && path[2] === "experiments") {
    return createExperiment(request, path[1]!);
  }
  if (path.length === 3 && path[0] === "records" && path[2] === "decision") {
    return confirmDecision(request, path[1]!);
  }
  if (path.length === 1 && path[0] === "records") return createResearch(request);
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

async function createExperiment(request: Request, researchHandle: string): Promise<NextResponse> {
  let input: z.infer<typeof CreateWebExperimentInputSchema>;
  try {
    input = CreateWebExperimentInputSchema.parse(await request.json());
  } catch {
    return invalid();
  }
  try {
    const research = openHandle(researchHandle, "research");
    const detail = await fetchProtectedUpstream({
      method: "POST",
      path: `/api/v1/research/${research.id}/experiments`,
      body: {
        input: {
          researchId: research.id,
          scope: { projectId: research.projectId, workstreamId: null, workItemId: null },
          idempotencyKey: randomUUID(),
          title: input.title,
        },
        method: {
          question: input.hypothesis,
          baseline: {
            description: "Employee-confirmed baseline",
            value: input.baseline,
            sourceReference: null,
          },
          measures: [
            {
              stableId: "primary_measure",
              name: input.measure,
              kind: "QUALITATIVE",
              unit: null,
              direction: "DESCRIPTIVE",
              baselineValue: input.baseline,
              baselineReference: null,
              interpretationRule: "Compare under the same pinned conditions.",
            },
          ],
          testCases: [
            {
              id: randomUUID(),
              inputIdentity: input.testCase,
              expectedObservation: null,
              category: "employee-defined",
              inclusionReason: "Employee selected this case for the bounded comparison.",
            },
          ],
          controls: [
            {
              comparisonTarget: "Current Project baseline",
              constantConditions: input.control,
            },
          ],
          conditions: [input.versions],
          reproducibilityInstructions: input.reproducibility,
          knownRisks: [],
          failureCases: ["No valid comparison can be made under the pinned conditions."],
          sourceReferences: [],
          executionMode: "ai_assisted",
        },
      },
      schema: UpstreamExperimentWorkspaceDetailSchema.shape.detail,
    });
    const method = detail.currentMethod;
    return json(
      WebExperimentRecordSchema.parse({
        handle: sealExperimentHandle(detail.id, research.projectId, detail.version),
        title: input.title,
        state: detail.state,
        version: detail.version,
        question: method.question,
        baseline: method.baseline.value ?? method.baseline.description,
        measures: method.measures.map(({ name }) => name),
        testCases: method.testCases.map(({ inputIdentity }) => inputIdentity),
        controls: method.controls.map(({ constantConditions }) => constantConditions),
        versions: method.conditions,
        reproducibility: method.reproducibilityInstructions,
        result: null,
        resultStatus: null,
        humanConclusion: null,
        limitations: [],
      }),
    );
  } catch (error) {
    return safeError(error);
  }
}

async function confirmDecision(request: Request, researchHandle: string): Promise<NextResponse> {
  let input: z.infer<typeof ConfirmWebResearchDecisionInputSchema>;
  try {
    input = ConfirmWebResearchDecisionInputSchema.parse(await request.json());
  } catch {
    return invalid();
  }
  try {
    const research = openHandle(researchHandle, "research");
    const current = await fetchProtectedUpstream({
      path: `/api/v1/research/${research.id}`,
      schema: UpstreamResearchWorkspaceDetailSchema,
    });
    if (current.detail.scope.projectId !== research.projectId) {
      return invalid();
    }
    if (current.detail.state === "CONCLUDED") {
      const prior = current.conclusions.at(-1);
      if (prior === undefined || !sameDecision(prior, input)) return invalid();
      if (
        current.appliedLearning.some(
          ({ researchConclusionId }) => researchConclusionId === prior.id,
        )
      ) {
        return json({ state: "confirmed", decision: prior.decision, appliedLearning: true });
      }
      await applyResearchLearning({
        researchId: research.id,
        expectedVersion: current.detail.version,
        conclusionId: prior.id,
        input,
      });
      return json({ state: "confirmed", decision: prior.decision, appliedLearning: true });
    }
    if (!["DRAFT", "ACTIVE"].includes(current.detail.state)) return invalid();
    let version = current.detail.version;
    if (current.detail.state === "DRAFT") {
      if (version !== research.revision) return invalid();
      const transition = await fetchProtectedUpstream({
        method: "POST",
        path: `/api/v1/research/${research.id}/transitions`,
        body: {
          expectedVersion: version,
          state: "ACTIVE",
          reason: "Employee confirmed the Research question before recording a decision.",
          successorResearchId: null,
        },
        schema: UpstreamVersionResultSchema,
      });
      version = transition.version;
    }
    const matchedSource = current.sourceReferences.find(
      (source) =>
        source.id !== undefined &&
        source.canonicalUrl === input.source.url &&
        source.title === input.source.title,
    );
    if (
      current.detail.state === "ACTIVE" &&
      version !== research.revision &&
      version !== research.revision + 1 &&
      matchedSource === undefined
    ) {
      return invalid();
    }
    let sourceReference: string;
    if (matchedSource === undefined) {
      const source = await fetchProtectedUpstream({
        method: "POST",
        path: `/api/v1/research/${research.id}/sources`,
        body: {
          expectedVersion: version,
          source: { kind: "MANUAL_CITATION", canonicalUrl: input.source.url },
          kind: "LINK",
          title: input.source.title,
          relevanceNote: input.source.relevance,
          credibilityNote: input.source.credibility,
          citedLocations: [],
          observedLicense: null,
          reuseWarning: "Employee review remains required before code or asset reuse.",
        },
        schema: UpstreamSourceResultSchema,
      });
      version = source.version;
      sourceReference = source.sourceReference;
    } else {
      sourceReference = `research-source:${matchedSource.id}`;
    }
    const conclusion = await fetchProtectedUpstream({
      method: "POST",
      path: `/api/v1/research/${research.id}/conclusions`,
      body: {
        expectedVersion: version,
        synthesis: input.synthesis,
        answer: input.answer,
        remainingUncertainty: input.remainingUncertainty,
        decision: input.decision,
        rationale: input.rationale,
        nextAction: input.nextAction,
        sourceReferences: [sourceReference],
        experimentIds: [],
      },
      schema: UpstreamResearchConclusionResultSchema,
    });
    version += 1;
    await applyResearchLearning({
      researchId: research.id,
      expectedVersion: version,
      conclusionId: conclusion.id,
      input,
    });
    return json({ state: "confirmed", decision: conclusion.decision, appliedLearning: true });
  } catch (error) {
    return safeError(error);
  }
}

async function applyResearchLearning(
  input: Readonly<{
    researchId: string;
    expectedVersion: number;
    conclusionId: string;
    input: z.infer<typeof ConfirmWebResearchDecisionInputSchema>;
  }>,
) {
  await fetchProtectedUpstream({
    method: "POST",
    path: `/api/v1/research/${input.researchId}/applied-learning`,
    body: {
      expectedVersion: input.expectedVersion,
      researchConclusionId: input.conclusionId,
      target: { kind: "RESEARCH", id: input.researchId },
      whatChanged: input.input.appliedChange,
      causalRationale: input.input.rationale,
    },
    schema: UpstreamAppliedLearningResultSchema,
  });
}

function sameDecision(
  prior: z.infer<typeof UpstreamResearchWorkspaceDetailSchema>["conclusions"][number],
  input: z.infer<typeof ConfirmWebResearchDecisionInputSchema>,
) {
  return (
    prior.decision === input.decision &&
    prior.synthesis === input.synthesis &&
    prior.answer === input.answer &&
    prior.rationale === input.rationale &&
    prior.nextAction === input.nextAction &&
    JSON.stringify(prior.remainingUncertainty) === JSON.stringify(input.remainingUncertainty)
  );
}

async function createResearch(request: Request): Promise<NextResponse> {
  let input: z.infer<typeof CreateWebResearchRecordInputSchema>;
  try {
    input = CreateWebResearchRecordInputSchema.parse(await request.json());
  } catch {
    return invalid();
  }
  try {
    const detail = await fetchProtectedUpstream({
      method: "POST",
      path: "/api/v1/research",
      body: {
        scope: { projectId: input.projectId, workstreamId: null, workItemId: null },
        idempotencyKey: randomUUID(),
        problemStatement: input.question,
        context: input.relevance,
        question: input.question,
        objective: input.relevance,
        hypothesis: { kind: "NO_HYPOTHESIS", reason: "Question framing comes first." },
        assumptions: input.assumptions,
        constraints: input.constraints,
        knownUncertainty: [],
        alternatives: [],
        decisionQuestion: input.question,
        sourceReferences: [],
        executionMode: "ai_assisted",
      },
      schema: UpstreamCreatedResearchSchema,
    });
    return json(
      WebResearchRecordSchema.parse({
        handle: sealHandle("research", detail.id, detail.scope.projectId, detail.version),
        state: detail.state,
        version: detail.version,
        question: detail.currentRevision.question,
        objective: detail.currentRevision.objective,
        assumptions: detail.currentRevision.assumptions,
        constraints: detail.currentRevision.constraints,
        knownUncertainty: detail.currentRevision.knownUncertainty,
        decisionQuestion: detail.currentRevision.decisionQuestion,
        sources: [],
        decision: null,
        appliedLearning: [],
      }),
    );
  } catch (error) {
    return safeError(error);
  }
}

function projectResearchRecord(
  result: z.infer<typeof UpstreamResearchWorkspaceDetailSchema>,
): z.infer<typeof WebResearchRecordSchema> {
  return WebResearchRecordSchema.parse({
    handle: sealHandle(
      "research",
      result.detail.id,
      result.detail.scope.projectId,
      result.detail.version,
    ),
    state: result.detail.state,
    version: result.detail.version,
    question: result.detail.currentRevision.question,
    objective: result.detail.currentRevision.objective,
    assumptions: result.detail.currentRevision.assumptions,
    constraints: result.detail.currentRevision.constraints,
    knownUncertainty: result.detail.currentRevision.knownUncertainty,
    decisionQuestion: result.detail.currentRevision.decisionQuestion,
    sources: result.sourceReferences.map((source) => ({
      title: source.title,
      url: source.canonicalUrl,
      relevance: source.relevanceNote,
      credibility: source.credibilityNote,
    })),
    decision:
      result.conclusions.length === 0
        ? null
        : (() => {
            const conclusion = result.conclusions.at(-1)!;
            return {
              synthesis: conclusion.synthesis,
              answer: conclusion.answer,
              remainingUncertainty: conclusion.remainingUncertainty,
              decision: conclusion.decision,
              rationale: conclusion.rationale,
              nextAction: conclusion.nextAction,
              confirmedAt: conclusion.confirmedAt,
            };
          })(),
    appliedLearning: result.appliedLearning.map((learning) => ({
      targetKind: learning.targetKind,
      whatChanged: learning.whatChanged,
      causalRationale: learning.causalRationale,
      confirmedAt: learning.confirmedAt,
    })),
  });
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
  action: "source_review" | "proposal" | "research",
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

function sealExperimentHandle(id: string, projectId: string, version: number) {
  return sealAuthCookie(
    {
      kind: "context_handle",
      action: "experiment",
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
