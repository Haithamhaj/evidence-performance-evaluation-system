import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  fetchProtectedUpstream,
  fetchWorkspaceUpstream,
  safeWorkspaceError,
} from "../../../../platform/workspace-api";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const UuidSchema = z.string().uuid();
const UtcInstantSchema = z.iso.datetime({ offset: true });
const PositiveIntegerSchema = z.number().int().positive();
const NormalizedTextSchema = (maximum: number) =>
  z
    .string()
    .min(1)
    .max(maximum)
    .regex(/^\S(?:[\s\S]*\S)?$/u);

const ProjectStatusSchema = z.enum(["draft", "active", "paused", "completed", "archived"]);
const ProjectSchema = z
  .object({
    id: UuidSchema,
    departmentId: UuidSchema,
    name: z.string(),
    description: z.string(),
    status: ProjectStatusSchema,
    version: PositiveIntegerSchema,
    primaryOwnerId: UuidSchema.nullable(),
  })
  .strict() satisfies z.ZodType<import("@evaluation/contracts").Project>;
const WorkstreamSchema = z
  .object({
    id: UuidSchema,
    projectId: UuidSchema,
    name: z.string(),
    description: z.string(),
    status: ProjectStatusSchema,
    version: PositiveIntegerSchema,
    primaryOwnerId: UuidSchema.nullable(),
  })
  .strict() satisfies z.ZodType<import("@evaluation/contracts").Workstream>;
const WorkspacePersonPeriodSchema = z
  .object({
    person: z.object({ id: UuidSchema, displayName: z.string().trim().min(1).max(240) }).strict(),
    responsibilityType: z.enum(["original", "acting", "permanent", "contributor"]),
    startsAt: UtcInstantSchema,
    endsAt: UtcInstantSchema.nullable(),
  })
  .strict();
const ProjectWorkspaceSchema = z
  .object({
    project: ProjectSchema,
    people: z.array(WorkspacePersonPeriodSchema),
    workstreams: z.array(WorkstreamSchema),
  })
  .strict() satisfies z.ZodType<import("@evaluation/contracts").ProjectWorkspace>;
const WorkstreamWorkspaceSchema = z
  .object({
    workstream: WorkstreamSchema,
    people: z.array(WorkspacePersonPeriodSchema),
  })
  .strict() satisfies z.ZodType<import("@evaluation/contracts").WorkstreamWorkspace>;

const DocumentKindSchema = z.enum(["project", "workstream"]);
const UploadedSourceSchema = z
  .object({
    id: UuidSchema,
    kind: DocumentKindSchema,
    resourceId: UuidSchema,
    filename: z.string(),
    detectedMime: z.string(),
    detectedType: z.string(),
    byteSize: z.number().int().nonnegative(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    createdAt: UtcInstantSchema,
  })
  .strict();
const DocumentVersionSourceSchema = z.discriminatedUnion("sourceType", [
  z
    .object({
      id: UuidSchema,
      position: PositiveIntegerSchema,
      sourceType: z.literal("upload"),
      uploadedSource: UploadedSourceSchema,
    })
    .strict(),
  z
    .object({
      id: UuidSchema,
      position: PositiveIntegerSchema,
      sourceType: z.literal("external_link"),
      url: z.url(),
    })
    .strict(),
  z
    .object({
      id: UuidSchema,
      position: PositiveIntegerSchema,
      sourceType: z.literal("github"),
      url: z.url(),
      sourceId: z.string().trim().min(1).max(300),
    })
    .strict(),
]);
const DocumentDetailSchema = z
  .object({
    id: UuidSchema,
    kind: DocumentKindSchema,
    resourceId: UuidSchema,
    templateVersionId: UuidSchema,
    currentVersion: z.number().int().nonnegative(),
    createdAt: UtcInstantSchema,
    versions: z.array(
      z
        .object({
          id: UuidSchema,
          documentId: UuidSchema,
          version: PositiveIntegerSchema,
          templateVersionId: UuidSchema,
          createdById: UuidSchema,
          reason: z.string().trim().min(1).max(1_000),
          sources: z.array(DocumentVersionSourceSchema).min(1).max(100),
          createdAt: UtcInstantSchema,
        })
        .strict(),
    ),
  })
  .strict() satisfies z.ZodType<import("@evaluation/contracts").DocumentDetail>;

const SourceReferenceSchema = z
  .string()
  .min(3)
  .max(256)
  .regex(
    /^(?!https?:)(?!.*(?:^|[^a-z0-9])(?:api[-_]?key|bearer|credential|password|secret|token)(?:[^a-z0-9]|$))[a-z][a-z0-9._-]{0,63}:(?:[0-9]{1,20}|[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[1-5][A-Fa-f0-9]{3}-[89ABab][A-Fa-f0-9]{3}-[A-Fa-f0-9]{12}|[0-9A-HJKMNP-TV-Z]{26}|[A-Fa-f0-9]{32,64})$/iu,
  );
const MissingDocumentItemSchema = z
  .object({
    templateSectionKey: z.string().regex(/^[a-z][a-z0-9_]{0,99}$/u),
    missingItem: NormalizedTextSchema(2_000),
    whyItMatters: NormalizedTextSchema(2_000),
    correctionInstruction: NormalizedTextSchema(4_000),
    sourceReferences: z.array(SourceReferenceSchema).min(1).max(20),
  })
  .strict();
const ManagerReadinessStateSchema = z.enum([
  "ready",
  "needs_attention",
  "missing_critical_information",
]);
const ReadinessParticipantDetailSchema = z
  .object({
    readinessCheckId: UuidSchema,
    documentVersionId: UuidSchema,
    lifecycleState: z.enum([
      "draft",
      "incomplete",
      "ready_for_criteria_generation",
      "criteria_approved",
      "revision_required",
      "superseded",
    ]),
    missingItems: z.array(MissingDocumentItemSchema).max(100),
    sourceReferences: z.array(SourceReferenceSchema).min(1).max(50),
    analyzedAt: UtcInstantSchema,
  })
  .strict() satisfies z.ZodType<import("@evaluation/contracts").ReadinessParticipantDetail>;

const CriterionItemSchema = z
  .object({
    id: UuidSchema,
    position: PositiveIntegerSchema,
    name: NormalizedTextSchema(300),
    selectionReason: NormalizedTextSchema(2_000),
    successLink: NormalizedTextSchema(2_000),
    expectedBehaviorOrResult: NormalizedTextSchema(4_000),
    evaluationMethod: NormalizedTextSchema(4_000),
    suggestedEvidence: z.array(NormalizedTextSchema(1_000)).min(1).max(20),
    sourceReferences: z.array(SourceReferenceSchema).min(1).max(50),
  })
  .strict();
const CriteriaActionSchema = z.enum([
  "generate",
  "owner_review",
  "publish",
  "respond",
  "manager_resolve",
  "activate",
]);
const criteriaActionOrder = CriteriaActionSchema.options;
const CriteriaWorkspaceSchema = z
  .object({
    proposal: z
      .object({
        id: UuidSchema,
        kind: DocumentKindSchema,
        state: z.enum([
          "owner_review",
          "contributor_review",
          "manager_resolution",
          "approved",
          "rejected",
          "superseded",
          "activated",
        ]),
        version: PositiveIntegerSchema,
        sourceDocumentVersionId: UuidSchema,
        items: z.array(CriterionItemSchema).min(1).max(3),
        requiredResponses: z.number().int().nonnegative(),
        completedResponses: z.number().int().nonnegative(),
        objectionCount: z.number().int().nonnegative(),
        viewerResponse: z
          .object({
            action: z.enum(["acknowledge", "object"]),
            reason: z.string().nullable(),
          })
          .strict()
          .nullable(),
        managerResolution: z
          .object({
            decision: z.enum(["request_revision", "accept_with_objections"]),
            reason: z.string().trim().min(1).max(1_000),
          })
          .strict()
          .nullable(),
      })
      .strict()
      .nullable(),
    activeSet: z
      .object({
        id: UuidSchema,
        proposalId: UuidSchema,
        version: PositiveIntegerSchema,
        effectiveFrom: UtcInstantSchema,
        effectiveTo: UtcInstantSchema.nullable(),
        items: z.array(CriterionItemSchema).min(1).max(3),
      })
      .strict()
      .nullable(),
    replacementRequest: z
      .object({
        replacesProposalId: UuidSchema,
        ownerFeedback: z.string().trim().min(1).max(1_000),
      })
      .strict()
      .nullable(),
    allowedActions: z.array(CriteriaActionSchema).superRefine((actions, context) => {
      const indexes = actions.map((action) => criteriaActionOrder.indexOf(action));
      if (
        new Set(actions).size !== actions.length ||
        indexes.some((index, position) => position > 0 && index <= indexes[position - 1]!)
      ) {
        context.addIssue({ code: "custom", message: "allowedActions must be unique and sorted" });
      }
    }),
  })
  .strict()
  .superRefine((workspace, context) => {
    if (workspace.proposal?.kind === "workstream" && workspace.proposal.items.length < 2) {
      context.addIssue({
        code: "custom",
        path: ["proposal", "items"],
        message: "workstream proposals require two to three items",
      });
    }
  }) satisfies z.ZodType<import("@evaluation/contracts").CriteriaWorkspace>;

const ManagerReadinessProjectionSchema = z
  .object({
    audience: z.literal("manager"),
    state: ManagerReadinessStateSchema,
  })
  .strict();

const ReadinessViewSchema = z
  .union([ReadinessParticipantDetailSchema, ManagerReadinessProjectionSchema])
  .nullable();

const ProjectScreenSchema = z
  .object({
    workspace: ProjectWorkspaceSchema,
    document: DocumentDetailSchema.nullable(),
    readiness: ReadinessViewSchema,
    criteria: CriteriaWorkspaceSchema,
  })
  .strict();

const WorkstreamScreenSchema = z.union([
  z
    .object({
      workspace: WorkstreamWorkspaceSchema,
      document: DocumentDetailSchema.nullable(),
      readiness: ReadinessViewSchema,
      criteria: CriteriaWorkspaceSchema,
    })
    .strict(),
  z
    .object({
      workspace: z.null(),
      document: z.null(),
      readiness: z.null(),
      criteria: CriteriaWorkspaceSchema,
    })
    .strict(),
]);

const ConnectedWorkContextSchema = z
  .object({
    mode: z.enum(["synthetic", "live"]),
    synthetic: z.boolean(),
    items: z.array(
      z
        .object({
          id: UuidSchema,
          provider: z.enum(["GOOGLE_GMAIL", "GOOGLE_CALENDAR"]),
          occurredAt: UtcInstantSchema,
          title: z.string(),
          summary: z.string().nullable(),
          sourceUrl: z.url().nullable(),
          privacy: z.literal("PRIVATE"),
          excluded: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();
const ConnectionStartSchema = z
  .object({
    mode: z.enum(["synthetic", "live"]),
    synthetic: z.boolean(),
    authorizationUrl: z.url(),
  })
  .strict();
const ConnectionResultSchema = z
  .object({ mode: z.enum(["synthetic", "live"]), synthetic: z.boolean(), connected: z.boolean() })
  .strict();
const ItemExclusionResultSchema = z.object({ id: UuidSchema, excluded: z.boolean() }).strict();
const ProjectLinkResultSchema = z
  .object({ id: UuidSchema, projectId: UuidSchema.optional(), linked: z.boolean() })
  .strict();
const ConnectionCallbackSchema = z
  .object({
    mode: z.enum(["synthetic", "live"]),
    synthetic: z.boolean(),
    connected: z.literal(true),
    synchronizedProviders: z.array(z.enum(["GOOGLE_GMAIL", "GOOGLE_CALENDAR"])),
  })
  .strict();
const StartBodySchema = z.object({ redirectUri: z.url().max(2_000) }).strict();
const ExclusionBodySchema = z.object({ excluded: z.boolean() }).strict();
const ProjectLinkBodySchema = z
  .object({ projectId: UuidSchema, reason: z.string().trim().min(1).max(1_000) })
  .strict();
const UnlinkBodySchema = z.object({ reason: z.string().trim().min(1).max(1_000) }).strict();

type RouteContext = {
  readonly params: Promise<{ readonly path: readonly string[] }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const path = (await context.params).path;
  const callbackPath = approvedConnectedCallbackPath(request, path);
  if (callbackPath !== null) {
    try {
      const body = await fetchProtectedUpstream({
        method: "GET",
        path: callbackPath,
        schema: ConnectionCallbackSchema,
      });
      return NextResponse.json(body);
    } catch (error) {
      const failure = safeWorkspaceError(error);
      return NextResponse.json(failure, { status: failure.status });
    }
  }
  const route = approvedRoute(request, path);
  if (route === null) return notFound();

  try {
    let body: unknown;
    if (route.kind === "connected_context") {
      body = await fetchProtectedUpstream({
        method: "GET",
        path: "/api/v1/connected-work/items",
        schema: ConnectedWorkContextSchema,
      });
    } else if (route.kind === "projects") {
      body = await fetchWorkspaceUpstream({ route, schema: z.array(ProjectSchema) });
    } else if (route.kind === "project") {
      body = await fetchWorkspaceUpstream({ route, schema: ProjectScreenSchema });
    } else {
      body = await fetchWorkspaceUpstream({ route, schema: WorkstreamScreenSchema });
    }
    return NextResponse.json(body);
  } catch (error) {
    const failure = safeWorkspaceError(error);
    return NextResponse.json(failure, { status: failure.status });
  }
}

export function POST(_request: Request): Promise<NextResponse> {
  return forwardConnectedMutation(_request, "POST");
}

export function PUT(request: Request): NextResponse | Promise<NextResponse> {
  return forwardConnectedMutation(request, "PUT");
}

export function PATCH(request: Request): NextResponse | Promise<NextResponse> {
  return forwardConnectedMutation(request, "PATCH");
}

export function DELETE(request: Request): NextResponse | Promise<NextResponse> {
  return forwardConnectedMutation(request, "DELETE");
}
export const HEAD = POST;
export const OPTIONS = POST;

async function forwardConnectedMutation(
  request: Request,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
): Promise<NextResponse> {
  const path = new URL(request.url).pathname.split("/").filter(Boolean).slice(2);
  const route = approvedConnectedMutationRoute(request, path, method);
  if (route === null) return notFound();
  try {
    const body = route.body === null ? undefined : route.body.parse(await request.json());
    const result = await fetchProtectedUpstream({
      body,
      method,
      path: route.path,
      schema: route.schema,
    });
    return NextResponse.json(result);
  } catch (error) {
    const failure = safeWorkspaceError(error);
    return NextResponse.json(failure, { status: failure.status });
  }
}

function approvedConnectedMutationRoute(
  request: Request,
  path: readonly string[],
  method: "POST" | "PATCH" | "PUT" | "DELETE",
): {
  readonly path: string;
  readonly body: z.ZodTypeAny | null;
  readonly schema: z.ZodTypeAny;
} | null {
  const url = new URL(request.url);
  if (
    url.search !== "" ||
    /%(?:2e|2f|5c)/iu.test(request.url) ||
    path.some((segment) => segment === "." || segment === "..")
  )
    return null;
  if (method === "POST" && path.join("/") === "connected-work/google/start") {
    return {
      path: "/api/v1/connected-work/google/start",
      body: StartBodySchema,
      schema: ConnectionStartSchema,
    };
  }
  if (method === "DELETE" && path.join("/") === "connected-work/google") {
    return { path: "/api/v1/connected-work/google", body: null, schema: ConnectionResultSchema };
  }
  if (path.length !== 4 || path[0] !== "connected-work" || path[1] !== "items" || !isUuid(path[2]))
    return null;
  const id = path[2];
  if (method === "PATCH" && path[3] === "exclusion") {
    return {
      path: `/api/v1/connected-work/items/${id}/exclusion`,
      body: ExclusionBodySchema,
      schema: ItemExclusionResultSchema,
    };
  }
  if (method === "PUT" && path[3] === "project-link") {
    return {
      path: `/api/v1/connected-work/items/${id}/project-link`,
      body: ProjectLinkBodySchema,
      schema: ProjectLinkResultSchema,
    };
  }
  if (method === "DELETE" && path[3] === "project-link") {
    return {
      path: `/api/v1/connected-work/items/${id}/project-link`,
      body: UnlinkBodySchema,
      schema: ProjectLinkResultSchema,
    };
  }
  return null;
}

function approvedRoute(request: Request, path: readonly string[]) {
  const url = new URL(request.url);
  if (url.search !== "" || /%(?:2e|2f|5c)/iu.test(request.url)) return null;
  if (path.some((segment) => segment === "." || segment === "..")) return null;
  if (path.length === 2 && path[0] === "connected-work" && path[1] === "items") {
    return { kind: "connected_context" } as const;
  }
  if (path.length === 1 && path[0] === "projects") return { kind: "projects" } as const;
  if (path.length === 2 && path[0] === "projects" && isUuid(path[1])) {
    return { kind: "project", projectId: path[1] } as const;
  }
  if (
    path.length === 4 &&
    path[0] === "projects" &&
    isUuid(path[1]) &&
    path[2] === "workstreams" &&
    isUuid(path[3])
  ) {
    return {
      kind: "workstream",
      projectId: path[1],
      workstreamId: path[3],
    } as const;
  }
  return null;
}

function approvedConnectedCallbackPath(request: Request, path: readonly string[]): string | null {
  const url = new URL(request.url);
  if (path.join("/") !== "connected-work/google/callback" || /%(?:2e|2f|5c)/iu.test(url.pathname))
    return null;
  const parsed = z
    .object({
      state: z.string().min(1).max(2_000),
      nonce: z.string().min(1).max(2_000),
      redirectUri: z.url().max(2_000),
    })
    .strict()
    .safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success || Array.from(url.searchParams.keys()).length !== 3) return null;
  return `/api/v1/connected-work/google/callback?${new URLSearchParams(parsed.data).toString()}`;
}

function isUuid(value: string | undefined): value is string {
  return value !== undefined && UUID_PATTERN.test(value);
}

function notFound(): NextResponse {
  return NextResponse.json(
    { messageKey: "errors.notFound", correlationId: randomUUID() },
    { status: 404 },
  );
}
