"use server";

import type { CatalogKey } from "@evaluation/localization";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { mutateCriteriaUpstream, safeWorkspaceError } from "../../../platform/workspace-api";

export type CriteriaActionState = {
  readonly status: "idle" | "success" | "error";
  readonly messageKey?: CatalogKey;
  readonly correlationId?: string;
};

const UuidSchema = z.string().uuid();
const ReasonSchema = z.string().trim().min(1).max(1_000);
const FeedbackSchema = z.string().trim().min(1).max(4_000);
const ContextShape = {
  locale: z.enum(["ar", "en"]),
  kind: z.enum(["project", "workstream"]),
  resourceId: UuidSchema,
  projectId: UuidSchema,
} as const;

const GenerateSchema = z
  .object({
    ...ContextShape,
    documentVersionId: UuidSchema,
    idempotencyKey: z.string().trim().min(1).max(256),
    replacesProposalId: UuidSchema.optional(),
    ownerFeedback: FeedbackSchema.optional(),
  })
  .strict()
  .superRefine(validateContext)
  .superRefine((value, context) => {
    if ((value.replacesProposalId === undefined) !== (value.ownerFeedback === undefined)) {
      context.addIssue({
        code: "custom",
        message: "replacement lineage must be complete",
      });
    }
  });

const OwnerReviewSchema = z
  .discriminatedUnion("action", [
    z
      .object({
        ...ContextShape,
        proposalId: UuidSchema,
        action: z.literal("reject"),
        reason: ReasonSchema,
      })
      .strict(),
    ...(["request_correction", "request_alternative", "request_wording_improvement"] as const).map(
      (action) =>
        z
          .object({
            ...ContextShape,
            proposalId: UuidSchema,
            action: z.literal(action),
            reason: ReasonSchema,
            feedback: FeedbackSchema.optional(),
          })
          .strict(),
    ),
  ])
  .superRefine(validateContext);

const PublishSchema = z
  .object({ ...ContextShape, proposalId: UuidSchema, reason: ReasonSchema })
  .strict()
  .superRefine(validateContext);

const RespondSchema = z
  .discriminatedUnion("action", [
    z
      .object({
        ...ContextShape,
        proposalId: UuidSchema,
        action: z.literal("acknowledge"),
      })
      .strict(),
    z
      .object({
        ...ContextShape,
        proposalId: UuidSchema,
        action: z.literal("object"),
        reason: ReasonSchema,
      })
      .strict(),
  ])
  .superRefine(validateContext);

const ResolveSchema = z
  .object({
    ...ContextShape,
    proposalId: UuidSchema,
    decision: z.enum(["request_revision", "accept_with_objections"]),
    reason: ReasonSchema,
  })
  .strict()
  .superRefine(validateContext);

const ActivateSchema = z
  .object({
    ...ContextShape,
    proposalId: UuidSchema,
    expectedProposalVersion: z.coerce.number().int().positive(),
    effectiveFrom: z.iso.datetime({ offset: true }),
    reason: ReasonSchema,
  })
  .strict()
  .superRefine(validateContext);

export async function generateCriteriaAction(
  _previous: CriteriaActionState,
  formData: FormData,
): Promise<CriteriaActionState> {
  return execute(GenerateSchema, formData, (value) => ({
    route: { kind: "generate" },
    body: {
      kind: value.kind,
      resourceId: value.resourceId,
      documentVersionId: value.documentVersionId,
      idempotencyKey: value.idempotencyKey,
      ...(value.replacesProposalId === undefined
        ? {}
        : {
            replacesProposalId: value.replacesProposalId,
            ownerFeedback: value.ownerFeedback,
          }),
    },
  }));
}

export async function ownerReviewCriteriaAction(
  _previous: CriteriaActionState,
  formData: FormData,
): Promise<CriteriaActionState> {
  return execute(OwnerReviewSchema, formData, (value) => ({
    route: { kind: "owner_review", proposalId: value.proposalId },
    body: {
      action: value.action,
      reason: value.reason,
      ...("feedback" in value && value.feedback !== undefined ? { feedback: value.feedback } : {}),
    },
  }));
}

export async function publishCriteriaAction(
  _previous: CriteriaActionState,
  formData: FormData,
): Promise<CriteriaActionState> {
  return execute(PublishSchema, formData, (value) => ({
    route: { kind: "publish", proposalId: value.proposalId },
    body: { reason: value.reason },
  }));
}

export async function respondToCriteriaAction(
  _previous: CriteriaActionState,
  formData: FormData,
): Promise<CriteriaActionState> {
  return execute(RespondSchema, formData, (value) => ({
    route: { kind: "respond", proposalId: value.proposalId },
    body:
      value.action === "acknowledge"
        ? { action: value.action }
        : { action: value.action, reason: value.reason },
  }));
}

export async function resolveCriteriaAction(
  _previous: CriteriaActionState,
  formData: FormData,
): Promise<CriteriaActionState> {
  return execute(ResolveSchema, formData, (value) => ({
    route: { kind: "manager_resolve", proposalId: value.proposalId },
    body: { decision: value.decision, reason: value.reason },
  }));
}

export async function activateCriteriaAction(
  _previous: CriteriaActionState,
  formData: FormData,
): Promise<CriteriaActionState> {
  return execute(ActivateSchema, formData, (value) => ({
    route: { kind: "activate", proposalId: value.proposalId },
    body: {
      expectedProposalVersion: value.expectedProposalVersion,
      effectiveFrom: value.effectiveFrom,
      reason: value.reason,
    },
  }));
}

async function execute<T extends z.ZodType>(
  schema: T,
  formData: FormData,
  command: (value: z.output<T>) => {
    readonly route: import("../../../platform/workspace-api").CriteriaMutationRoute;
    readonly body: unknown;
  },
): Promise<CriteriaActionState> {
  const input = Object.fromEntries(formData.entries());
  if (input.feedback === "") delete input.feedback;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { status: "error", messageKey: "errors.validation" };

  try {
    await mutateCriteriaUpstream(command(parsed.data));
    revalidatePath(resourcePath(parsed.data as ResourceContext));
    return { status: "success", messageKey: "workspace.actionSuccess" };
  } catch (error) {
    const failure = safeWorkspaceError(error);
    return {
      status: "error",
      messageKey: failure.messageKey,
      correlationId: failure.correlationId,
    };
  }
}

type ResourceContext = z.infer<z.ZodObject<typeof ContextShape>>;

function validateContext(value: ResourceContext, context: z.RefinementCtx): void {
  if (value.kind === "project" && value.resourceId !== value.projectId) {
    context.addIssue({ code: "custom", message: "project resource identity mismatch" });
  }
  if (value.kind === "workstream" && value.resourceId === value.projectId) {
    context.addIssue({ code: "custom", message: "workstream resource identity mismatch" });
  }
}

function resourcePath(value: ResourceContext): string {
  return value.kind === "project"
    ? `/${value.locale}/projects/${value.projectId}`
    : `/${value.locale}/projects/${value.projectId}/workstreams/${value.resourceId}`;
}
