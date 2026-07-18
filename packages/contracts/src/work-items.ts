import { z } from "zod";

const UuidSchema = z.string().uuid();
const UtcInstantSchema = z.iso.datetime({ offset: true });
const PositiveVersionSchema = z.number().int().positive();
const ReasonSchema = z.string().trim().min(1).max(1_000);

export const WORK_ITEM_STATUSES = [
  "planned",
  "ready",
  "in_progress",
  "blocked",
  "in_review",
  "done",
  "cancelled",
] as const;

export const WorkItemStatusSchema = z.enum(WORK_ITEM_STATUSES);
export const WorkItemPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);
export const WorkItemAllowedActionSchema = z.enum(["edit", "transition", "assign", "add_update"]);

const WorkItemContentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(8_000).default(""),
  projectId: UuidSchema,
  workstreamId: UuidSchema.nullable().default(null),
  assigneeId: UuidSchema.nullable().default(null),
  dueAt: UtcInstantSchema.nullable().default(null),
  priority: WorkItemPrioritySchema.default("normal"),
  requirements: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
  acceptanceConditions: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
  blocker: z.string().trim().min(1).max(2_000).nullable().default(null),
  nextAction: z.string().trim().min(1).max(2_000).nullable().default(null),
});

export const CreateWorkItemInputSchema = WorkItemContentSchema.strict();

export const UpdateWorkItemInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(8_000).optional(),
    dueAt: UtcInstantSchema.nullable().optional(),
    priority: WorkItemPrioritySchema.optional(),
    requirements: z.array(z.string().trim().min(1).max(500)).max(50).optional(),
    acceptanceConditions: z.array(z.string().trim().min(1).max(500)).max(50).optional(),
    blocker: z.string().trim().min(1).max(2_000).nullable().optional(),
    nextAction: z.string().trim().min(1).max(2_000).nullable().optional(),
    expectedVersion: PositiveVersionSchema,
    reason: ReasonSchema,
  })
  .strict();

export const TransitionWorkItemInputSchema = z
  .object({
    status: WorkItemStatusSchema,
    expectedVersion: PositiveVersionSchema,
    reason: ReasonSchema,
  })
  .strict();

export const AssignWorkItemInputSchema = z
  .object({
    assigneeId: UuidSchema.nullable(),
    expectedVersion: PositiveVersionSchema,
    reason: ReasonSchema,
  })
  .strict();

export const WorkItemDetailSchema = WorkItemContentSchema.extend({
  id: UuidSchema,
  status: WorkItemStatusSchema,
  version: PositiveVersionSchema,
  createdAt: UtcInstantSchema,
  updatedAt: UtcInstantSchema,
  allowedActions: z.array(WorkItemAllowedActionSchema).default([]),
}).strict();

export const MyWorkGroupKeySchema = z.enum([
  "needs_my_action",
  "today",
  "overdue",
  "waiting_blocked",
  "reviews_criteria",
  "this_week",
  "no_due_date",
  "recent_activity",
]);

export const MyWorkGroupSchema = z
  .object({
    key: MyWorkGroupKeySchema,
    items: z.array(WorkItemDetailSchema),
    collapsedByDefault: z.boolean(),
  })
  .strict();

export const MyWorkResponseSchema = z
  .object({
    groups: z.array(MyWorkGroupSchema),
    nextCursor: z.string().min(1).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const requiredOrder = ["needs_my_action", "today", "overdue"];
    for (const [index, key] of requiredOrder.entries()) {
      if (value.groups[index]?.key !== key) {
        context.addIssue({
          code: "custom",
          path: ["groups", index, "key"],
          message: `group ${key} must appear at position ${index}`,
        });
      }
    }
  });

export type WorkItemStatus = z.infer<typeof WorkItemStatusSchema>;
export type WorkItemPriority = z.infer<typeof WorkItemPrioritySchema>;
export type CreateWorkItemInput = z.infer<typeof CreateWorkItemInputSchema>;
export type UpdateWorkItemInput = z.infer<typeof UpdateWorkItemInputSchema>;
export type TransitionWorkItemInput = z.infer<typeof TransitionWorkItemInputSchema>;
export type AssignWorkItemInput = z.infer<typeof AssignWorkItemInputSchema>;
export type WorkItemDetail = z.infer<typeof WorkItemDetailSchema>;
export type MyWorkResponse = z.infer<typeof MyWorkResponseSchema>;
