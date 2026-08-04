import { z } from "zod";

export const WebUuidSchema = z.string().uuid();

export const WebWorkItemSchema = z
  .object({
    id: WebUuidSchema,
    projectId: WebUuidSchema,
    workstreamId: WebUuidSchema.nullable(),
    title: z.string().trim().min(1).max(200),
    description: z.string().max(8_000),
    status: z.enum([
      "planned",
      "ready",
      "in_progress",
      "blocked",
      "in_review",
      "done",
      "cancelled",
    ]),
    priority: z.enum(["low", "normal", "high", "urgent"]),
    assigneeId: WebUuidSchema.nullable(),
    dueAt: z.iso.datetime({ offset: true }).nullable(),
    requirements: z.array(z.string()),
    acceptanceConditions: z.array(z.string()),
    blocker: z.string().nullable(),
    nextAction: z.string().nullable(),
    version: z.number().int().positive(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    checklist: z
      .array(
        z
          .object({
            id: WebUuidSchema,
            text: z.string().trim().min(1).max(500),
            completed: z.boolean(),
            position: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .default([]),
    collaboratorIds: z.array(WebUuidSchema).default([]),
    allowedActions: z.array(z.enum(["edit", "transition", "assign", "add_update"])),
  })
  .strict();

export const WebPrivateInboxItemSchema = z
  .object({
    id: WebUuidSchema,
    employeeId: WebUuidSchema,
    text: z.string().trim().min(1).max(4_000),
    projectId: WebUuidSchema.nullable(),
    status: z.enum(["open", "promoted", "dismissed"]),
    promotedWorkItemId: WebUuidSchema.nullable(),
    version: z.number().int().positive(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const WebTaskWorkspaceResponseSchema = z
  .object({
    view: z.enum(["my", "team"]),
    layout: z.enum(["list", "board", "calendar"]),
    items: z.array(WebWorkItemSchema),
    nextCursor: WebUuidSchema.nullable(),
  })
  .strict();

export const CapturePrivateInboxBodySchema = z
  .object({
    text: z.string().trim().min(1).max(4_000),
    projectId: WebUuidSchema.nullable().default(null),
  })
  .strict();

export const DismissPrivateInboxBodySchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();

export const CreateTaskBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(8_000).default(""),
    projectId: WebUuidSchema,
    workstreamId: WebUuidSchema.nullable().default(null),
    assigneeId: WebUuidSchema,
    dueAt: z.iso.datetime({ offset: true }).nullable().default(null),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    requirements: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
    acceptanceConditions: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
    blocker: z.string().trim().min(1).max(2_000).nullable().default(null),
    nextAction: z.string().trim().min(1).max(2_000).nullable().default(null),
  })
  .strict();

export const PromotePrivateInboxBodySchema = CreateTaskBodySchema.extend({
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(1).max(1_000),
}).strict();

export const UpdateTaskBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(8_000).optional(),
    workstreamId: WebUuidSchema.nullable().optional(),
    assigneeId: WebUuidSchema.optional(),
    dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    checklist: z
      .array(
        z
          .object({
            text: z.string().trim().min(1).max(500),
            completed: z.boolean().default(false),
          })
          .strict(),
      )
      .max(100)
      .optional(),
    collaboratorIds: z.array(WebUuidSchema).max(100).optional(),
    requirements: z.array(z.string().trim().min(1).max(500)).max(50).optional(),
    acceptanceConditions: z.array(z.string().trim().min(1).max(500)).max(50).optional(),
    blocker: z.string().trim().min(1).max(2_000).nullable().optional(),
    nextAction: z.string().trim().min(1).max(2_000).nullable().optional(),
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();
