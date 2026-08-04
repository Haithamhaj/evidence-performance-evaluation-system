import { z } from "zod";

import { CriterionProposalItemSchema } from "./criteria.js";
import { ProjectSchema, ResponsibilityTypeSchema, WorkstreamSchema } from "./projects.js";
import { PrivateInboxItemSchema, WorkItemDetailSchema } from "./work-items.js";

const UuidSchema = z.string().uuid();
const UtcInstantSchema = z.iso.datetime({ offset: true });

export const WorkspacePersonSchema = z
  .object({
    id: UuidSchema,
    displayName: z.string().trim().min(1).max(240),
  })
  .strict();

export const WorkspacePersonPeriodSchema = z
  .object({
    person: WorkspacePersonSchema,
    responsibilityType: ResponsibilityTypeSchema,
    startsAt: UtcInstantSchema,
    endsAt: UtcInstantSchema.nullable(),
  })
  .strict();

export const ProjectWorkspaceSchema = z
  .object({
    project: ProjectSchema,
    people: z.array(WorkspacePersonPeriodSchema),
    workstreams: z.array(WorkstreamSchema),
  })
  .strict();

export const WorkstreamWorkspaceSchema = z
  .object({
    workstream: WorkstreamSchema,
    people: z.array(WorkspacePersonPeriodSchema),
  })
  .strict();

export const CriteriaWorkspaceActionSchema = z.enum([
  "generate",
  "owner_review",
  "publish",
  "respond",
  "manager_resolve",
  "activate",
]);

const actionOrder = CriteriaWorkspaceActionSchema.options;

const ProposalItemSchema = CriterionProposalItemSchema.extend({
  id: UuidSchema,
  position: z.number().int().positive(),
}).strict();

const ProposalSchema = z
  .object({
    id: UuidSchema,
    kind: z.enum(["project", "workstream"]),
    state: z.enum([
      "owner_review",
      "contributor_review",
      "manager_resolution",
      "approved",
      "rejected",
      "superseded",
      "activated",
    ]),
    version: z.number().int().positive(),
    sourceDocumentVersionId: UuidSchema,
    items: z.array(ProposalItemSchema).min(1).max(3),
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
  .strict();

const ActiveSetSchema = z
  .object({
    id: UuidSchema,
    proposalId: UuidSchema,
    version: z.number().int().positive(),
    effectiveFrom: UtcInstantSchema,
    effectiveTo: UtcInstantSchema.nullable(),
    items: z.array(ProposalItemSchema).min(1).max(3),
  })
  .strict();

export const CriteriaWorkspaceSchema = z
  .object({
    proposal: ProposalSchema.nullable(),
    activeSet: ActiveSetSchema.nullable(),
    replacementRequest: z
      .object({
        replacesProposalId: UuidSchema,
        ownerFeedback: z.string().trim().min(1).max(1_000),
      })
      .strict()
      .nullable(),
    allowedActions: z.array(CriteriaWorkspaceActionSchema).superRefine((actions, context) => {
      const indexes = actions.map((action) => actionOrder.indexOf(action));
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
  });

export const ProjectPulseItemSchema = z
  .object({
    id: UuidSchema,
    name: z.string().trim().min(1).max(200),
    status: z.enum(["active", "paused"]),
    progress: z.discriminatedUnion("state", [
      z.object({ state: z.literal("awaiting_contract") }).strict(),
      z.object({ state: z.literal("awaiting_information") }).strict(),
      z
        .object({
          state: z.literal("accepted"),
          percent: z.number().min(0).max(100),
          updatedAt: UtcInstantSchema,
        })
        .strict(),
    ]),
  })
  .strict();

export const DailyWorkspaceSnapshotSchema = z
  .object({
    needsMyAction: z.array(WorkItemDetailSchema),
    today: z.array(WorkItemDetailSchema),
    overdue: z.array(WorkItemDetailSchema),
    reviewQueue: z.array(WorkItemDetailSchema),
    inbox: z.array(PrivateInboxItemSchema),
    projectPulse: z.array(ProjectPulseItemSchema),
    upcoming: z.array(WorkItemDetailSchema),
  })
  .strict();

export type WorkspacePerson = z.infer<typeof WorkspacePersonSchema>;
export type WorkspacePersonPeriod = z.infer<typeof WorkspacePersonPeriodSchema>;
export type ProjectWorkspace = z.infer<typeof ProjectWorkspaceSchema>;
export type WorkstreamWorkspace = z.infer<typeof WorkstreamWorkspaceSchema>;
export type CriteriaWorkspaceAction = z.infer<typeof CriteriaWorkspaceActionSchema>;
export type CriteriaWorkspace = z.infer<typeof CriteriaWorkspaceSchema>;
export type ProjectPulseItem = z.infer<typeof ProjectPulseItemSchema>;
export type DailyWorkspaceSnapshot = z.infer<typeof DailyWorkspaceSnapshotSchema>;
