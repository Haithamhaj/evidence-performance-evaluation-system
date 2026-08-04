import { z } from "zod";

const UuidSchema = z.string().uuid();
const UtcInstantSchema = z.iso.datetime({ offset: true });
const ReasonSchema = z.string().trim().min(1).max(1_000);
const PositiveVersionSchema = z.number().int().positive();

export const ProjectStatusSchema = z.enum(["draft", "active", "paused", "completed", "archived"]);
export const WorkstreamStatusSchema = ProjectStatusSchema;
export const ResponsibilityTypeSchema = z.enum(["original", "acting", "permanent", "contributor"]);

export const CreateProjectSchema = z
  .object({
    departmentId: UuidSchema,
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(4_000),
    primaryOwnerId: UuidSchema,
    startsAt: UtcInstantSchema,
    reason: ReasonSchema,
  })
  .strict();

export const CreateWorkstreamSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(4_000),
    primaryOwnerId: UuidSchema,
    startsAt: UtcInstantSchema,
    reason: ReasonSchema,
  })
  .strict();

export const AddMemberSchema = z
  .object({
    userId: UuidSchema,
    startsAt: UtcInstantSchema,
    reason: ReasonSchema,
  })
  .strict();

export const EndMembershipSchema = z
  .object({
    endsAt: UtcInstantSchema,
    reason: ReasonSchema,
    expectedVersion: PositiveVersionSchema,
  })
  .strict();

export const UpdateStatusSchema = z
  .object({
    status: ProjectStatusSchema,
    reason: ReasonSchema,
    expectedVersion: PositiveVersionSchema,
  })
  .strict();

const TransferBaseSchema = z.object({
  toUserId: UuidSchema,
  effectiveAt: UtcInstantSchema,
  reason: ReasonSchema,
  expectedVersion: PositiveVersionSchema,
  relatedHandoverReference: z.string().trim().min(1).max(200).optional(),
});

export const TransferOwnershipSchema = z
  .discriminatedUnion("transferKind", [
    TransferBaseSchema.extend({ transferKind: z.literal("permanent") }).strict(),
    TransferBaseSchema.extend({
      transferKind: z.literal("acting"),
      endsAt: UtcInstantSchema,
      delegationType: z.string().trim().min(1).max(80),
    }).strict(),
  ])
  .superRefine((value, context) => {
    if (
      value.transferKind === "acting" &&
      Date.parse(value.endsAt) <= Date.parse(value.effectiveAt)
    ) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "endsAt must follow effectiveAt",
      });
    }
  });

export const ResponsibilityAtSchema = z.object({ at: UtcInstantSchema }).strict();

export const ProjectSchema = z
  .object({
    id: UuidSchema,
    departmentId: UuidSchema,
    name: z.string(),
    description: z.string(),
    status: ProjectStatusSchema,
    version: PositiveVersionSchema,
    primaryOwnerId: UuidSchema.nullable(),
  })
  .strict();

export const WorkstreamSchema = z
  .object({
    id: UuidSchema,
    projectId: UuidSchema,
    name: z.string(),
    description: z.string(),
    status: WorkstreamStatusSchema,
    version: PositiveVersionSchema,
    primaryOwnerId: UuidSchema.nullable(),
  })
  .strict();

export const ResponsibilityWindowSchema = z
  .object({
    id: UuidSchema,
    employeeId: UuidSchema,
    projectId: UuidSchema.nullable(),
    workstreamId: UuidSchema.nullable(),
    responsibilityType: ResponsibilityTypeSchema,
    startsAt: UtcInstantSchema,
    endsAt: UtcInstantSchema.nullable(),
    reason: ReasonSchema,
    delegationType: z.string().nullable(),
    relatedHandoverReference: z.string().nullable(),
    managerDecisionById: UuidSchema.nullable(),
    managerDecisionAt: UtcInstantSchema.nullable(),
    managerDecisionReason: z.string().nullable(),
  })
  .strict();

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type WorkstreamStatus = z.infer<typeof WorkstreamStatusSchema>;
export type ResponsibilityType = z.infer<typeof ResponsibilityTypeSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type CreateWorkstreamInput = z.infer<typeof CreateWorkstreamSchema>;
export type AddMemberInput = z.infer<typeof AddMemberSchema>;
export type EndMembershipInput = z.infer<typeof EndMembershipSchema>;
export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>;
export type TransferOwnershipInput = z.infer<typeof TransferOwnershipSchema>;
export type ResponsibilityAtInput = z.infer<typeof ResponsibilityAtSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Workstream = z.infer<typeof WorkstreamSchema>;
export type ResponsibilityWindow = z.infer<typeof ResponsibilityWindowSchema>;
