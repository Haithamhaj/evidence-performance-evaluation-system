import { z } from "zod";

const UuidSchema = z.string().uuid();
const UtcInstantSchema = z.iso.datetime({ offset: true });
const ReasonSchema = z.string().trim().min(1).max(1_000);
const PositiveVersionSchema = z.number().int().positive();
const NonnegativeVersionSchema = z.number().int().nonnegative();

export const PROJECT_PROTECTED_SECTION_KEYS = [
  "project_definition_and_ownership",
  "problem_and_context",
  "objective_and_expected_outcome",
  "scope_and_boundaries",
  "expected_deliverables",
  "definition_of_success",
] as const;

export const WORKSTREAM_REQUIRED_SECTION_KEYS = [
  "purpose",
  "scope",
  "expected_output",
  "parent_project_relationship",
  "dependencies",
  "proposed_approach_or_architecture",
  "definition_of_success",
  "responsible_members",
  "relevant_sources_or_repositories",
] as const;

export const DOCUMENT_ERROR_CODES = [
  "DOCUMENT_ALREADY_EXISTS",
  "DOCUMENT_INPUT_INVALID",
  "DOCUMENT_TEMPLATE_INVALID",
  "DOCUMENT_TEMPLATE_NOT_ACTIVE",
  "RESOURCE_NOT_FOUND",
  "SCOPE_MISMATCH",
  "VERSION_CONFLICT",
  "UPLOAD_TYPE_REJECTED",
  "UPLOAD_SIZE_REJECTED",
  "UPLOAD_SAFETY_REJECTED",
] as const;

export const DocumentErrorCodeSchema = z.enum(DOCUMENT_ERROR_CODES);
export const DocumentKindSchema = z.enum(["project", "workstream"]);
export const TemplateScopeTypeSchema = z.enum(["organization", "department"]);
export const DocumentTemplateVersionStatusSchema = z.enum(["draft", "active", "retired"]);

export const LocalizedDocumentDisplaySchema = z
  .object({
    en: z
      .object({
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().min(1).max(2_000).optional(),
      })
      .strict(),
    ar: z
      .object({
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().min(1).max(2_000).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const DocumentTemplateSectionInputSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_]{0,99}$/u),
    position: z.number().int().positive(),
    display: LocalizedDocumentDisplaySchema,
    required: z.boolean(),
    protected: z.boolean(),
  })
  .strict();

export const CreateDocumentTemplateVersionSchema = z
  .object({
    templateId: UuidSchema.optional(),
    expectedVersion: NonnegativeVersionSchema,
    scopeType: TemplateScopeTypeSchema,
    organizationId: UuidSchema,
    departmentId: UuidSchema.optional(),
    kind: DocumentKindSchema,
    sections: z.array(DocumentTemplateSectionInputSchema).min(1).max(100),
    reason: ReasonSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const hasDepartment = value.departmentId !== undefined;
    if ((value.scopeType === "department") !== hasDepartment) {
      context.addIssue({
        code: "custom",
        path: ["departmentId"],
        message: "departmentId must be present only for department scope",
      });
    }
    if ((value.templateId === undefined) !== (value.expectedVersion === 0)) {
      context.addIssue({
        code: "custom",
        path: ["expectedVersion"],
        message: "new templates require version zero; existing templates require a positive token",
      });
    }
  });

export const ActivateDocumentTemplateVersionSchema = z
  .object({ expectedVersion: PositiveVersionSchema, reason: ReasonSchema })
  .strict();

const UploadSourceInputSchema = z
  .object({ sourceType: z.literal("upload"), uploadedSourceId: UuidSchema })
  .strict();
const ExternalLinkSourceInputSchema = z
  .object({ sourceType: z.literal("external_link"), url: z.url() })
  .strict();
const GithubSourceInputSchema = z
  .object({
    sourceType: z.literal("github"),
    url: z.url(),
    sourceId: z.string().trim().min(1).max(300),
  })
  .strict();

export const DocumentSourceInputSchema = z.discriminatedUnion("sourceType", [
  UploadSourceInputSchema,
  ExternalLinkSourceInputSchema,
  GithubSourceInputSchema,
]);

export const CreateDocumentSchema = z
  .object({
    kind: DocumentKindSchema,
    resourceId: UuidSchema,
    expectedVersion: z.literal(0),
    sources: z.array(DocumentSourceInputSchema).min(1).max(100),
    reason: ReasonSchema,
  })
  .strict();

export const AppendDocumentVersionSchema = z
  .object({
    expectedVersion: PositiveVersionSchema,
    sources: z.array(DocumentSourceInputSchema).min(1).max(100),
    reason: ReasonSchema,
  })
  .strict();

const approvedUploadPairs = new Map<string, ReadonlySet<string>>([
  ["md", new Set(["text/markdown", "text/plain"])],
  ["txt", new Set(["text/plain"])],
  ["docx", new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document"])],
  ["pdf", new Set(["application/pdf"])],
  ["png", new Set(["image/png"])],
  ["jpg", new Set(["image/jpeg"])],
  ["jpeg", new Set(["image/jpeg"])],
  ["webp", new Set(["image/webp"])],
  ["wav", new Set(["audio/wav", "audio/x-wav"])],
  ["mp3", new Set(["audio/mpeg"])],
  ["m4a", new Set(["audio/mp4", "audio/x-m4a"])],
]);

export const StageUploadMetadataSchema = z
  .object({
    kind: DocumentKindSchema,
    resourceId: UuidSchema,
    filename: z.string().trim().min(1).max(255),
    declaredMime: z.string().trim().min(1).max(200),
    reason: ReasonSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const extension = value.filename.toLowerCase().match(/\.([a-z0-9]+)$/u)?.[1];
    if (extension === undefined || !approvedUploadPairs.get(extension)?.has(value.declaredMime)) {
      context.addIssue({
        code: "custom",
        path: ["filename"],
        message: "filename extension and declared MIME must be an approved matching pair",
      });
    }
  });

export const DocumentTemplateVersionSchema = z
  .object({
    id: UuidSchema,
    templateId: UuidSchema,
    aggregateVersion: PositiveVersionSchema,
    version: PositiveVersionSchema,
    status: DocumentTemplateVersionStatusSchema,
    kind: DocumentKindSchema,
    sections: z.array(DocumentTemplateSectionInputSchema),
    createdAt: UtcInstantSchema,
    activatedAt: UtcInstantSchema.nullable(),
    retiredAt: UtcInstantSchema.nullable(),
  })
  .strict();

export const UploadedSourceSchema = z
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

export const DocumentRecordSchema = z
  .object({
    id: UuidSchema,
    kind: DocumentKindSchema,
    resourceId: UuidSchema,
    templateVersionId: UuidSchema,
    currentVersion: NonnegativeVersionSchema,
    createdAt: UtcInstantSchema,
  })
  .strict();

export const DocumentVersionSourceSchema = z.discriminatedUnion("sourceType", [
  z
    .object({
      id: UuidSchema,
      position: PositiveVersionSchema,
      sourceType: z.literal("upload"),
      uploadedSource: UploadedSourceSchema,
    })
    .strict(),
  z
    .object({
      id: UuidSchema,
      position: PositiveVersionSchema,
      sourceType: z.literal("external_link"),
      url: z.url(),
    })
    .strict(),
  z
    .object({
      id: UuidSchema,
      position: PositiveVersionSchema,
      sourceType: z.literal("github"),
      url: z.url(),
      sourceId: z.string().trim().min(1).max(300),
    })
    .strict(),
]);

export const DocumentVersionSchema = z
  .object({
    id: UuidSchema,
    documentId: UuidSchema,
    version: PositiveVersionSchema,
    templateVersionId: UuidSchema,
    createdById: UuidSchema,
    reason: ReasonSchema,
    sources: z.array(DocumentVersionSourceSchema).min(1).max(100),
    createdAt: UtcInstantSchema,
  })
  .strict();

export const DocumentDetailSchema = DocumentRecordSchema.extend({
  versions: z.array(DocumentVersionSchema),
}).strict();

export type DocumentKind = z.infer<typeof DocumentKindSchema>;
export type TemplateScopeType = z.infer<typeof TemplateScopeTypeSchema>;
export type DocumentTemplateSectionInput = z.infer<typeof DocumentTemplateSectionInputSchema>;
export type CreateDocumentTemplateVersionInput = z.infer<
  typeof CreateDocumentTemplateVersionSchema
>;
export type ActivateDocumentTemplateVersionInput = z.infer<
  typeof ActivateDocumentTemplateVersionSchema
>;
export type StageUploadMetadata = z.infer<typeof StageUploadMetadataSchema>;
export type DocumentSourceInput = z.infer<typeof DocumentSourceInputSchema>;
export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;
export type AppendDocumentVersionInput = z.infer<typeof AppendDocumentVersionSchema>;
export type DocumentTemplateVersion = z.infer<typeof DocumentTemplateVersionSchema>;
export type UploadedSource = z.infer<typeof UploadedSourceSchema>;
export type DocumentRecord = z.infer<typeof DocumentRecordSchema>;
export type DocumentVersionSource = z.infer<typeof DocumentVersionSourceSchema>;
export type DocumentVersion = z.infer<typeof DocumentVersionSchema>;
export type DocumentDetail = z.infer<typeof DocumentDetailSchema>;
