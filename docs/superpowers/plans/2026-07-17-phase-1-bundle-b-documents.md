# Phase 1 Bundle B Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver T021–T023: governed document-template versions, fail-closed private uploads, and one append-only versioned document per project or workstream.

**Architecture:** Add a bounded `@evaluation/documents` package that owns template, upload, storage, and document-version rules. It consumes a read-only resource lookup exported by `@evaluation/projects`; the API composes authentication and policy enforcement, while PostgreSQL remains authoritative for metadata/history and a private S3-compatible bucket stores bytes.

**Tech Stack:** TypeScript 7, Node.js 24 streams, Zod 4, Prisma 7/PostgreSQL 17, AWS SDK S3 3.1087.0, `file-type` 21.3.4, `yauzl` 3.4.0, ClamAV `INSTREAM`, NestJS 11, Vitest 4, Playwright 1.61.

## Global Constraints

- Do not change any protected product rule, rubric content, rating behavior, or T016 Arabic-rubric status.
- Scope is exactly T021, T022, and T023; readiness analysis, AI calls, material-change analysis, criteria, and UI are excluded.
- `packages/documents` owns templates, versions, protected sections, uploaded-source metadata, storage access, document records, and document versions.
- `packages/documents` may consume only the read-only public project/workstream interface; `packages/projects` must not depend on `packages/documents`.
- All protected API actions use server-side authentication and policy enforcement; UI visibility is never authorization.
- Project owners and workstream owners receive coordination permissions only; System Administrators do not decide project reassignment.
- Six project keys and nine workstream keys listed below are required on activation; existing documents retain their pinned template version.
- File ceilings and signed-URL TTL are required environment-backed operational values, not hard-coded product rules.
- Uploads are private and fail closed through streaming size checks, extension/MIME/magic agreement, DOCX archive checks, malware scan, SHA-256, and generated object keys.
- Do not log file content, credentials, API keys, object-storage secrets, or signed URLs.
- All timestamps are UTC, all history is append-only, and every protected mutation writes an audit event in the same transaction as its database change.

---

## File Map

### Public contracts and authorization

- `packages/contracts/src/documents.ts`: strict Zod request/response contracts, stable section keys, source types, media types, and document errors.
- `packages/contracts/src/documents.test.ts`: contract rejection/acceptance fixtures.
- `packages/contracts/src/index.ts`: export document contracts.
- `packages/permissions/src/model.ts`: add template/document actions and template resource shapes.
- `packages/permissions/src/decide.ts`: authorize system/department template management and resource-scoped document reads/writes.
- `packages/permissions/src/decide.test.ts`: positive and negative policy matrix.

### Project read interface

- `packages/projects/src/document-resource-reader.ts`: public `DocumentResourceReader` that returns resource identity, lifecycle, and parent scope without exposing Prisma.
- `packages/projects/src/document-resource-reader.integration.test.ts`: active/inactive and missing-resource reads.
- `packages/projects/src/index.ts`: export the reader.

### Documents domain

- `packages/documents/package.json`, `packages/documents/tsconfig.json`, `packages/documents/src/index.ts`: package boundary and public exports.
- `packages/documents/src/model.ts`: database, audit, resource-reader, clock, storage, scanner, and upload-policy ports.
- `packages/documents/src/template-invariants.ts`: exact protected-key activation rules.
- `packages/documents/src/template-invariants.test.ts`: project/workstream activation rules.
- `packages/documents/src/template-service.ts`: create template versions, activate atomically, and read active versions.
- `packages/documents/src/template-service.integration.test.ts`: activation, retirement, pinning, scope, and audit behavior.
- `packages/documents/src/file-inspection.ts`: extension/MIME/magic and DOCX central-directory safety checks.
- `packages/documents/src/file-inspection.test.ts`: spoofing, unsafe archive, and accepted-format fixtures.
- `packages/documents/src/clamav-scanner.ts`: bounded `INSTREAM` client that accepts only a clean response.
- `packages/documents/src/clamav-scanner.test.ts`: clean, infected, timeout, and malformed-response cases.
- `packages/documents/src/s3-private-storage.ts`: private put/delete and short-lived signed GET operations.
- `packages/documents/src/s3-private-storage.integration.test.ts`: private object and expiry behavior against MinIO.
- `packages/documents/src/upload-service.ts`: temp-file staging, size/hash/type/scan/storage sequence, cleanup, and metadata persistence.
- `packages/documents/src/upload-service.test.ts`: fail-closed pipeline and compensation tests.
- `packages/documents/src/upload-service.integration.test.ts`: persisted metadata and private-object lifecycle.
- `packages/documents/src/document-service.ts`: create the sole document, append versions with optimistic concurrency, and issue authorized signed reads.
- `packages/documents/src/document-service.integration.test.ts`: uniqueness, history, stale writes, source attachment, and audit.

### Database and runtime composition

- `packages/database/prisma/schema.prisma`: template, section, uploaded-source, document, version, and source models.
- `packages/database/prisma/migrations/0010_documents/migration.sql`: constraints, indexes, immutable-row triggers, and active-template uniqueness.
- `packages/database/src/documents-schema.integration.test.ts`: database-level invariants and append-only protection.
- `packages/database/package.json`: include the document schema integration test.
- `apps/api/src/documents/documents-authentication.guard.ts`: AuthModule-owned authentication wrapper.
- `apps/api/src/documents/document-policy.guard.ts`: load public resource identity/current responsibility and call `decide`.
- `apps/api/src/documents/document-templates.controller.ts`: template creation/activation/read endpoints.
- `apps/api/src/documents/uploads.controller.ts`: streaming binary upload and signed-read endpoints.
- `apps/api/src/documents/documents.controller.ts`: document create/read/version endpoints.
- `apps/api/src/documents/documents.module.ts`: compose package services and infrastructure ports.
- `apps/api/src/documents/*.test.ts`: controller, guard, and error-envelope tests.
- `apps/api/src/documents/documents.e2e.integration.test.ts`: composed manager/owner/contributor/cross-department workflow.
- `apps/api/src/app.module.ts`: import `DocumentsModule`.
- `apps/api/package.json`: add `@evaluation/documents` and AWS runtime dependencies.
- `infra/docker/compose.yml`: add pinned ClamAV and private document bucket dependencies.
- `.env.example`: document storage/scanner variables with local-only example values.
- `scripts/verify-infra.mjs`: verify ClamAV health and private document bucket.
- `tests/repository/compose.test.ts`: assert the pinned scanner and non-public storage configuration.
- `tests/e2e/phase1-documents.spec.ts`: user-level document history and authorization flow.
- `TASKS.md`: mark T021–T023 complete only after all gates pass.
- `project-state/PROJECT_STATE.md`, `project-state/SYSTEM_MAP.html`, `MANIFEST.sha256`: record Bundle B completion and refresh integrity hashes.

---

### Task 1: Document Contracts and Permission Boundary

**Files:**
- Create: `packages/contracts/src/documents.ts`
- Create: `packages/contracts/src/documents.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/errors.ts`
- Modify: `packages/permissions/src/model.ts`
- Modify: `packages/permissions/src/decide.ts`
- Modify: `packages/permissions/src/decide.test.ts`

**Interfaces:**
- Consumes: existing `AppError`, `PolicyInput`, `PolicyResource`, `PolicyContext`, and `decide(subject, action, resource, context)`.
- Produces: `CreateDocumentTemplateVersionSchema`, `ActivateDocumentTemplateVersionSchema`, `StageUploadMetadataSchema`, `CreateDocumentSchema`, `AppendDocumentVersionSchema`, `DocumentTemplateVersionSchema`, `UploadedSourceSchema`, `DocumentRecordSchema`, and policy actions `document.template.manage`, `document.read`, `document.version.create`. Both template mutation schemas require an aggregate `expectedVersion` token and return `VERSION_CONFLICT` for stale use.

- [ ] **Step 1: Write failing contract tests for exact keys and strict request shapes**

```ts
import { describe, expect, it } from "vitest";
import {
  AppendDocumentVersionSchema,
  CreateDocumentTemplateVersionSchema,
  PROJECT_PROTECTED_SECTION_KEYS,
  WORKSTREAM_REQUIRED_SECTION_KEYS,
} from "./documents.js";

describe("document contracts", () => {
  it("publishes the exact protected keys", () => {
    expect(PROJECT_PROTECTED_SECTION_KEYS).toEqual([
      "project_definition_and_ownership", "problem_and_context",
      "objective_and_expected_outcome", "scope_and_boundaries",
      "expected_deliverables", "definition_of_success",
    ]);
    expect(WORKSTREAM_REQUIRED_SECTION_KEYS).toHaveLength(9);
  });

  it("rejects stale-token omission and unknown fields", () => {
    expect(() => AppendDocumentVersionSchema.parse({ sources: [], extra: true })).toThrow();
  });
});
```

- [ ] **Step 2: Run the focused contracts test and verify it fails because exports are absent**

Run: `pnpm exec vitest run --root . packages/contracts/src/documents.test.ts`

Expected: FAIL with missing `./documents.js` or missing named exports.

- [ ] **Step 3: Implement strict schemas and stable domain errors**

```ts
export const PROJECT_PROTECTED_SECTION_KEYS = [
  "project_definition_and_ownership", "problem_and_context",
  "objective_and_expected_outcome", "scope_and_boundaries",
  "expected_deliverables", "definition_of_success",
] as const;
export const WORKSTREAM_REQUIRED_SECTION_KEYS = [
  "purpose", "scope", "expected_output", "parent_project_relationship", "dependencies",
  "proposed_approach_or_architecture", "definition_of_success", "responsible_members",
  "relevant_sources_or_repositories",
] as const;

export const DocumentKindSchema = z.enum(["project", "workstream"]);
export const TemplateScopeTypeSchema = z.enum(["organization", "department"]);
export const DocumentSourceInputSchema = z.discriminatedUnion("sourceType", [
  z.object({ sourceType: z.literal("upload"), uploadedSourceId: UuidSchema }).strict(),
  z.object({ sourceType: z.literal("external_link"), url: z.url() }).strict(),
  z.object({ sourceType: z.literal("github"), url: z.url(), sourceId: z.string().trim().min(1).max(300) }).strict(),
]);
export const AppendDocumentVersionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  sources: z.array(DocumentSourceInputSchema).min(1),
  reason: z.string().trim().min(1).max(1_000),
}).strict();
export const CreateDocumentTemplateVersionSchema = z.object({
  templateId: UuidSchema.optional(),
  expectedVersion: z.number().int().nonnegative(),
  scopeType: TemplateScopeTypeSchema,
  organizationId: UuidSchema,
  departmentId: UuidSchema.optional(),
  kind: DocumentKindSchema,
  sections: z.array(DocumentTemplateSectionInputSchema).min(1),
  reason: z.string().trim().min(1).max(1_000),
}).strict();
export const ActivateDocumentTemplateVersionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(1).max(1_000),
}).strict();
```

Add `VERSION_CONFLICT`, `UPLOAD_TYPE_REJECTED`, `UPLOAD_SIZE_REJECTED`, and `UPLOAD_SAFETY_REJECTED` to the stable error-code schema without changing existing codes.

- [ ] **Step 4: Write the failing permission matrix**

```ts
it.each([
  [manager, "document.template.manage", departmentTemplate, true],
  [systemAdministrator, "document.template.manage", organizationTemplate, true],
  [projectOwner, "document.version.create", projectResource, true],
  [workstreamOwner, "document.version.create", workstreamResource, true],
  [contributor, "document.version.create", workstreamResource, false],
  [crossDepartmentManager, "document.read", projectResource, false],
])("enforces the document boundary", (_subject, action, resource, allowed) => {
  expect(decide(_subject, action, resource, activeContext).allowed).toBe(allowed);
});
```

- [ ] **Step 5: Implement exact policy branches**

```ts
case "document.template.manage":
  if (resource.kind === "organizationTemplate") {
    return hasScopedRole(subject, "system_administrator", "organization", resource.organizationId)
      ? allow : deny("SCOPE_MISMATCH");
  }
  if (resource.kind === "departmentTemplate") {
    return managerCanAccessDepartment(subject, resource.departmentId)
      ? allow : deny(hasRole(subject, "manager") ? "SCOPE_MISMATCH" : "ROLE_REQUIRED");
  }
  return deny("RESOURCE_STATE");
case "document.read":
  return decideResourceRead(subject, resource, context);
case "document.version.create":
  if (resource.kind === "project") {
    return decideOwnerManagement(subject, resource, context, "project_owner", "project", resource.projectId);
  }
  if (resource.kind === "workstream") {
    return decideOwnerManagement(subject, resource, context, "workstream_owner", "workstream", resource.workstreamId);
  }
  return deny("RESOURCE_STATE");
```

- [ ] **Step 6: Verify and commit Task 1**

Run: `pnpm exec vitest run --root . packages/contracts/src/documents.test.ts packages/permissions/src/decide.test.ts && pnpm --filter @evaluation/contracts typecheck && pnpm --filter @evaluation/permissions typecheck`

Expected: PASS.

```bash
git add packages/contracts packages/permissions
git commit -m "feat: define document contracts and policies"
```

### Task 2: Read-Only Project Resource Interface and Document Invariants

**Files:**
- Create: `packages/projects/src/document-resource-reader.ts`
- Create: `packages/projects/src/document-resource-reader.integration.test.ts`
- Modify: `packages/projects/src/index.ts`
- Create: `packages/documents/package.json`
- Create: `packages/documents/tsconfig.json`
- Create: `packages/documents/src/model.ts`
- Create: `packages/documents/src/template-invariants.ts`
- Create: `packages/documents/src/template-invariants.test.ts`
- Create: `packages/documents/src/index.ts`

**Interfaces:**
- Consumes: `ProjectDatabase` and approved project/workstream lifecycle values.
- Produces: `DocumentResourceReader.get(input): Promise<DocumentResourceIdentity | null>`, `assertActivatableTemplate(kind, sections): void`, and all package ports used by Tasks 4–6.

- [ ] **Step 1: Write failing reader and invariant tests**

```ts
expect(await reader.get({ kind: "workstream", resourceId: workstreamId })).toEqual({
  kind: "workstream", resourceId: workstreamId, projectId, organizationId, departmentId,
  status: "active",
});
expect(() => assertActivatableTemplate("project", projectSections.slice(1))).toThrowError(
  expect.objectContaining({ code: "DOCUMENT_TEMPLATE_INVALID" }),
);
expect(() => assertActivatableTemplate("workstream", workstreamSections)).not.toThrow();
```

- [ ] **Step 2: Run focused tests and verify missing-module failures**

Run: `pnpm exec vitest run --root . packages/projects/src/document-resource-reader.integration.test.ts packages/documents/src/template-invariants.test.ts`

Expected: FAIL because reader and documents package do not exist.

- [ ] **Step 3: Implement the public identity interface**

```ts
export type DocumentResourceIdentity = Readonly<{
  kind: "project" | "workstream";
  resourceId: string;
  projectId: string;
  organizationId: string;
  departmentId: string;
  status: "draft" | "active" | "paused" | "completed" | "archived";
}>;

export class DocumentResourceReader {
  constructor(private readonly database: ProjectDatabase) {}
  async get(input: Readonly<{ kind: "project" | "workstream"; resourceId: string }>): Promise<DocumentResourceIdentity | null> {
    return input.kind === "project" ? this.readProject(input.resourceId) : this.readWorkstream(input.resourceId);
  }
}
```

The query selects only IDs, department/organization, parent project, and status; it never returns project persistence models.

- [ ] **Step 4: Define package ports and protected-section validation**

```ts
export interface PrivateObjectStorage {
  put(input: Readonly<{ key: string; path: string; contentType: string; byteSize: number }>): Promise<void>;
  delete(key: string): Promise<void>;
  signGet(input: Readonly<{ key: string; expiresInSeconds: number }>): Promise<string>;
}
export interface MalwareScanner { scan(path: string): Promise<"clean">; }
export type UploadPolicy = Readonly<{
  maxBytesByClass: Readonly<Record<"text" | "office" | "image" | "audio", number>>;
  maxArchiveEntries: number;
  maxArchiveUncompressedBytes: number;
  maxArchiveCompressionRatio: number;
  signedUrlTtlSeconds: number;
}>;
```

`assertActivatableTemplate` rejects duplicate keys/positions, missing required keys, and any project protected key whose `required` or `protected` flag is false.

- [ ] **Step 5: Verify package boundaries and commit Task 2**

Run: `pnpm install --lockfile-only && pnpm exec vitest run --root . packages/projects/src/document-resource-reader.integration.test.ts packages/documents/src/template-invariants.test.ts && pnpm lint && pnpm typecheck`

Expected: PASS, including the repository boundary checker.

```bash
git add pnpm-lock.yaml packages/projects packages/documents
git commit -m "feat: establish documents domain boundary"
```

### Task 3: Immutable Documents Database Schema

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0010_documents/migration.sql`
- Create: `packages/database/src/documents-schema.integration.test.ts`
- Modify: `packages/database/package.json`

**Interfaces:**
- Consumes: existing `Organization`, `Department`, `Project`, `Workstream`, and `User` IDs.
- Produces: Prisma models `DocumentTemplate`, `DocumentTemplateVersion`, `DocumentTemplateSection`, `UploadedSource`, `DocumentRecord`, `DocumentVersion`, and `DocumentVersionSource`.

- [ ] **Step 1: Write failing database constraint tests**

```ts
it("rejects a second project document and stale current-version mutation", async () => {
  await seedProjectDocument(transaction, graph, 1);
  await expect(seedProjectDocument(transaction, graph, 1)).rejects.toSatisfy(uniqueViolation);
  await expect(transaction.documentRecord.update({
    where: { id: graph.documentId }, data: { currentVersion: 3 },
  })).rejects.toSatisfy(checkViolation);
});

it("forbids update or deletion of document versions and sections", async () => {
  await expect(updatePersistedVersion(transaction, graph)).rejects.toThrow();
  await expect(deletePersistedSection(transaction, graph)).rejects.toThrow();
});
```

- [ ] **Step 2: Run schema test and verify missing generated models**

Run: `TEST_DATABASE_URL=postgresql://haitham@127.0.0.1:5432/evaluation_phase1_test pnpm --filter @evaluation/database test:integration`

Expected: FAIL because document models are absent.

- [ ] **Step 3: Add exact relational model constraints**

```prisma
model DocumentRecord {
  id                String            @id @default(uuid()) @db.Uuid
  organizationId    String            @db.Uuid
  organization      Organization      @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  departmentId      String            @db.Uuid
  department        Department        @relation(fields: [departmentId], references: [id], onDelete: Restrict)
  projectId         String?           @db.Uuid
  project           Project?          @relation(fields: [projectId], references: [id], onDelete: Restrict)
  workstreamId      String?           @db.Uuid
  workstream        Workstream?       @relation(fields: [workstreamId], references: [id], onDelete: Restrict)
  templateVersionId String            @db.Uuid
  templateVersion   DocumentTemplateVersion @relation(fields: [templateVersionId], references: [id], onDelete: Restrict)
  currentVersion    Int               @default(0)
  createdById       String            @db.Uuid
  createdBy         User              @relation(fields: [createdById], references: [id], onDelete: Restrict)
  createdAt         DateTime          @default(now()) @db.Timestamptz(6)
  versions          DocumentVersion[]
  @@unique([projectId])
  @@unique([workstreamId])
  @@index([departmentId])
}

model DocumentVersion {
  id                String                  @id @default(uuid()) @db.Uuid
  documentId        String                  @db.Uuid
  document          DocumentRecord          @relation(fields: [documentId], references: [id], onDelete: Restrict)
  version           Int
  templateVersionId String                  @db.Uuid
  templateVersion   DocumentTemplateVersion @relation(fields: [templateVersionId], references: [id], onDelete: Restrict)
  createdById       String                  @db.Uuid
  createdBy         User                    @relation(fields: [createdById], references: [id], onDelete: Restrict)
  reason            String
  createdAt         DateTime                @default(now()) @db.Timestamptz(6)
  sources           DocumentVersionSource[]
  @@unique([documentId, version])
}
```

Every relationship from templates, template versions, sections, uploaded sources, document records, document versions, and version sources to organization, department, project/workstream, creator, and parent history uses a declared foreign key with `ON DELETE RESTRICT`. Migration SQL adds XOR checks for organization/department template scope and project/workstream document scope, positive/monotonic version checks, a partial unique active index per template scope/kind, and triggers that permit only `draft -> active`, `active -> retired`, `DocumentTemplate.lockVersion = old + 1`, or `DocumentRecord.currentVersion = old + 1` through the declared service transaction. It rejects every delete of `DocumentTemplate`, `DocumentTemplateVersion`, `DocumentTemplateSection`, `UploadedSource`, `DocumentRecord`, `DocumentVersion`, and `DocumentVersionSource`, plus every other update of their historical fields.

Add database tests that attempt deletion of each of the seven root/version/source tables, mutation of each immutable historical payload, a skipped/jumped template `lockVersion`, and a skipped/jumped document `currentVersion`; all must fail without changing any row.

- [ ] **Step 4: Verify migration from empty and previous snapshots**

Run: `pnpm db:generate && TEST_DATABASE_URL=postgresql://haitham@127.0.0.1:5432/evaluation_phase1_test pnpm --filter @evaluation/database test:integration && pnpm db:verify`

Expected: PASS for empty database, previous release, rebuild equivalence, constraints, indexes, and triggers.

- [ ] **Step 5: Commit Task 3**

```bash
git add packages/database
git commit -m "feat: add immutable document persistence"
```

### Task 4: T021 Versioned Template Engine

**Files:**
- Create: `packages/documents/src/template-service.ts`
- Create: `packages/documents/src/template-service.integration.test.ts`
- Modify: `packages/documents/src/index.ts`
- Create: `apps/api/src/documents/documents-authentication.guard.ts`
- Create: `apps/api/src/documents/document-policy.guard.ts`
- Create: `apps/api/src/documents/document-templates.controller.ts`
- Create: `apps/api/src/documents/document-templates.controller.test.ts`

**Interfaces:**
- Consumes: Task 1 schemas/policies, Task 2 invariants, database transaction and audit writer.
- Produces: `TemplateService.createVersion(input & { expectedVersion: number })`, `TemplateService.activate(input & { expectedVersion: number })`, and REST `POST /document-templates`, `POST /document-templates/:templateId/versions/:versionId/activate`, `GET /document-templates/active`.

- [ ] **Step 1: Write failing service tests for protected activation and atomic retirement**

```ts
await service.activate({ templateId, versionId: version2Id, actorId, reason: "Approved replacement" });
expect(await statusOf(version1Id)).toBe("retired");
expect(await statusOf(version2Id)).toBe("active");
expect(await pinnedTemplateVersion(documentId)).toBe(version1Id);
expect(await auditEvents("document_template.version_activated")).toHaveLength(1);
await expect(service.activate({
  templateId, versionId: version3Id, expectedVersion: staleLockVersion,
  actorId, reason: "Stale activation",
})).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
expect(await statusOf(version3Id)).toBe("draft");
```

- [ ] **Step 2: Run focused test and verify service is absent**

Run: `pnpm exec vitest run --root . packages/documents/src/template-service.integration.test.ts`

Expected: FAIL with missing service export.

- [ ] **Step 3: Implement serialized activation**

```ts
await database.$transaction(async (tx) => {
  const version = await lockDraftTemplateVersion(tx, input.templateId, input.versionId);
  if (version.template.lockVersion !== input.expectedVersion) throw versionConflict();
  assertActivatableTemplate(version.kind, version.sections);
  await tx.documentTemplateVersion.updateMany({
    where: activeVersionScope(version), data: { status: "retired", retiredAt: now },
  });
  await tx.documentTemplateVersion.update({
    where: { id: version.id }, data: { status: "active", activatedAt: now },
  });
  const advanced = await tx.documentTemplate.updateMany({
    where: { id: input.templateId, lockVersion: input.expectedVersion },
    data: { lockVersion: { increment: 1 } },
  });
  if (advanced.count !== 1) throw versionConflict();
  await audit.append(tx, activationAudit(input, version, now));
}, { isolationLevel: "Serializable" });
```

Creating a correction always requires the current template `lockVersion`, atomically increments it by one with compare-and-set, and creates the next immutable draft version plus complete ordered section set. It never edits an existing section. Concurrent creation or activation with the same token yields one success and one `VERSION_CONFLICT`, with no partial retirement, activation, section, or audit record.

- [ ] **Step 4: Add authenticated, policy-protected controllers and tests**

```ts
Post()(DocumentTemplatesController.prototype, "createVersion", descriptor("createVersion"));
UseGuards(DocumentsAuthenticationGuard, DocumentPolicyGuard)(
  DocumentTemplatesController.prototype, "createVersion", descriptor("createVersion"),
);
```

Controller tests prove strict validation, organization-vs-department scope, cross-department denial, protected-key rejection, and stable error envelopes.

- [ ] **Step 5: Verify T021 and commit**

Run: `pnpm exec vitest run --root . packages/documents/src/template-invariants.test.ts packages/documents/src/template-service.integration.test.ts apps/api/src/documents/document-templates.controller.test.ts && pnpm lint && pnpm typecheck`

Expected: PASS.

```bash
git add packages/documents apps/api/src/documents
git commit -m "feat: implement versioned document templates"
```

### Task 5: T022 Fail-Closed Upload and Private Storage

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `packages/documents/package.json`
- Create: `packages/documents/src/file-inspection.ts`
- Create: `packages/documents/src/file-inspection.test.ts`
- Create: `packages/documents/src/clamav-scanner.ts`
- Create: `packages/documents/src/clamav-scanner.test.ts`
- Create: `packages/documents/src/s3-private-storage.ts`
- Create: `packages/documents/src/s3-private-storage.integration.test.ts`
- Create: `packages/documents/src/upload-service.ts`
- Create: `packages/documents/src/upload-service.test.ts`
- Create: `packages/documents/src/upload-service.integration.test.ts`
- Create: `apps/api/src/documents/uploads.controller.ts`
- Create: `apps/api/src/documents/uploads.controller.test.ts`
- Modify: `infra/docker/compose.yml`
- Modify: `.env.example`
- Modify: `scripts/verify-infra.mjs`
- Modify: `tests/repository/compose.test.ts`

**Interfaces:**
- Consumes: `PrivateObjectStorage`, `MalwareScanner`, `UploadPolicy`, resource-reader, and `StageUploadMetadataSchema`.
- Produces: `UploadService.stage(input, stream): Promise<UploadedSource>`, `UploadService.signRead(input): Promise<{ url: string; expiresAt: string }>`, `ClamAvScanner`, `S3PrivateStorage`, `POST /documents/uploads`, and `POST /documents/uploads/:uploadedSourceId/signed-read`.

- [ ] **Step 1: Write failing file-inspection and pipeline tests**

```ts
it.each([
  ["report.pdf", "application/pdf", jpegBytes, "UPLOAD_TYPE_REJECTED"],
  ["oversize.txt", "text/plain", oversizedStream, "UPLOAD_SIZE_REJECTED"],
  ["unsafe.docx", DOCX_MIME, traversalZip, "UPLOAD_SAFETY_REJECTED"],
  ["forged-size.docx", DOCX_MIME, forgedExpandedSizeZip, "UPLOAD_SAFETY_REJECTED"],
  ["bad-crc.docx", DOCX_MIME, crcMismatchZip, "UPLOAD_SAFETY_REJECTED"],
])("fails closed", async (filename, mime, bytes, code) => {
  await expect(service.stage(metadata(filename, mime), readable(bytes))).rejects.toMatchObject({ code });
  expect(storage.put).not.toHaveBeenCalled();
});

it("deletes a stored object when metadata persistence fails", async () => {
  repository.insert.mockRejectedValue(new Error("database unavailable"));
  await expect(service.stage(validMetadata, readable(pdfBytes))).rejects.toThrow();
  expect(storage.delete).toHaveBeenCalledWith(expect.stringMatching(/^documents\//));
});
```

- [ ] **Step 2: Run focused tests and verify missing implementations**

Run: `pnpm exec vitest run --root . packages/documents/src/file-inspection.test.ts packages/documents/src/clamav-scanner.test.ts packages/documents/src/upload-service.test.ts`

Expected: FAIL with missing modules.

- [ ] **Step 3: Implement streamed staging and exact validation order**

```ts
const staged = await stageToPrivateTempFile(stream, classLimit, createHash("sha256"));
try {
  const detected = await inspectFile({ path: staged.path, filename, declaredMime, policy });
  await scanner.scan(staged.path);
  const key = `documents/${identity.organizationId}/${identity.kind}/${identity.resourceId}/${randomUUID()}`;
  await storage.put({ key, path: staged.path, contentType: detected.mime, byteSize: staged.byteSize });
  try {
    return await repository.insertUploadedSource({ ...metadata, key, sha256: staged.sha256, ...detected });
  } catch (error) {
    await storage.delete(key);
    throw error;
  }
} finally {
  await rm(staged.path, { force: true });
}
```

`file-type` performs binary detection; UTF-8 validation handles Markdown/text. DOCX inspection uses `yauzl` 3.4.0 with lazy entries and validates local-header/central-directory consistency. It streams every decompressed entry through an actual-byte counter and CRC-32 verification, aborting as soon as per-entry or aggregate expanded bytes, actual compression ratio, or entry count crosses the configured bound. It also rejects encryption, unsupported compression methods, absolute/traversal paths, duplicate names, declared-size mismatch, CRC mismatch, trailing/overlapping records, or absence of `[Content_Types].xml` and `word/document.xml`; no entry is extracted to disk.

- [ ] **Step 4: Implement fail-closed ClamAV and private S3 adapters**

```ts
const socket = connect({ host, port });
socket.write("zINSTREAM\0");
for await (const chunk of createReadStream(path)) {
  socket.write(uint32be(chunk.length));
  socket.write(chunk);
}
socket.end(uint32be(0));
const reply = await boundedReply(socket, timeoutMilliseconds);
if (!reply.endsWith("stream: OK\0")) throw uploadSafetyRejected();
```

S3 `PutObject` never sets a public ACL. `signGet` uses `GetObjectCommand` and the environment-backed TTL; errors and audit metadata exclude the returned URL.

- [ ] **Step 5: Add required operational configuration and scanner health**

`.env.example` defines local-only examples for `DOCUMENT_STORAGE_BUCKET`, four `DOCUMENT_MAX_*_BYTES` values, three archive limits, `DOCUMENT_SIGNED_URL_TTL_SECONDS`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `CLAMAV_HOST`, `CLAMAV_PORT`, and `CLAMAV_TIMEOUT_MILLISECONDS`. The config parser rejects missing, zero, negative, non-integer, or unsafe-number values; no fallback becomes a product ceiling.

Add `clamav/clamav:1.4_base@sha256:c24cbe1b4b33399be35a7febda674f5f852b6d20173c4c348e570b41de276889` with healthcheck and a loopback-only `127.0.0.1:3310:3310` mapping so the host-run API can reach it without exposing the scanner on an external interface. Infrastructure verification creates the document bucket without a public policy, stages an EICAR test only through ClamAV, and confirms the scanner rejects it.

- [ ] **Step 6: Add streaming endpoints and authorization tests**

```ts
async upload(request: RawRequest, response: RawResponse) {
  const metadata = StageUploadMetadataSchema.parse(readUploadHeaders(request.headers));
  const result = await this.uploads.stage(authenticatedActor(request), metadata, request);
  response.status(201).json(result);
}
```

Tests prove the controller never buffers the complete request, inactive/cross-department/unassigned users are denied before storage, owners can upload only to their active scope, contributors cannot create a version, and signed reads require `document.read` each time.

- [ ] **Step 7: Verify T022 and commit**

Run: `pnpm install && pnpm infra:up && pnpm infra:verify && pnpm exec vitest run --root . packages/documents/src/file-inspection.test.ts packages/documents/src/clamav-scanner.test.ts packages/documents/src/upload-service.test.ts packages/documents/src/upload-service.integration.test.ts packages/documents/src/s3-private-storage.integration.test.ts apps/api/src/documents/uploads.controller.test.ts && pnpm lint && pnpm typecheck`

Expected: PASS; MinIO object is private, signed URL is bounded, malware is rejected, and failed writes leave no object/temp file/metadata row.

```bash
git add package.json pnpm-lock.yaml packages/documents apps/api/src/documents infra/docker .env.example scripts/verify-infra.mjs tests/repository/compose.test.ts
git commit -m "feat: add fail-closed private document uploads"
```

### Task 6: T023 Project and Workstream Document Versions

**Files:**
- Create: `packages/documents/src/document-service.ts`
- Create: `packages/documents/src/document-service.integration.test.ts`
- Modify: `packages/documents/src/index.ts`
- Create: `apps/api/src/documents/documents.controller.ts`
- Create: `apps/api/src/documents/documents.controller.test.ts`
- Create: `apps/api/src/documents/documents.module.ts`
- Create: `apps/api/src/documents/documents.e2e.integration.test.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/package.json`
- Create: `tests/e2e/phase1-documents.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–5 contracts, resource reader, template service, uploaded-source repository, authorization guard, transaction, audit, and private storage.
- Produces: `DocumentService.create(input)`, `DocumentService.appendVersion(input)`, `DocumentService.get(input)`, `DocumentService.signSourceRead(input)`, and the approved `/documents` routes.

- [ ] **Step 1: Write failing integration tests for uniqueness, pinning, history, and concurrency**

```ts
const first = await service.create({ kind: "project", resourceId: projectId, expectedVersion: 0, sources: [upload], actorId, reason: "Initial source" });
await expect(service.create({ kind: "project", resourceId: projectId, expectedVersion: 0, sources: [upload2], actorId, reason: "Duplicate" })).rejects.toMatchObject({ code: "DOCUMENT_ALREADY_EXISTS" });
const second = await service.appendVersion({ documentId: first.id, expectedVersion: 1, sources: [upload2], actorId, reason: "Approved update" });
await expect(service.appendVersion({ documentId: first.id, expectedVersion: 1, sources: [upload3], actorId, reason: "Stale update" })).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
expect(second.version).toBe(2);
expect(await versionNumbers(first.id)).toEqual([1, 2]);
expect(await templateVersionIds(first.id)).toEqual([first.templateVersionId, first.templateVersionId]);
```

- [ ] **Step 2: Run focused service test and verify failure**

Run: `pnpm exec vitest run --root . packages/documents/src/document-service.integration.test.ts`

Expected: FAIL because `DocumentService` is absent.

- [ ] **Step 3: Implement serializable create and append transactions**

```ts
await database.$transaction(async (tx) => {
  const record = await lockDocumentRecord(tx, input.documentId);
  if (record.currentVersion !== input.expectedVersion) throw versionConflict();
  const sources = await lockAndValidateSources(tx, input.sources, record);
  const nextVersion = record.currentVersion + 1;
  const version = await tx.documentVersion.create({
    data: buildVersion(record, sources, nextVersion, input), include: { sources: true },
  });
  const advanced = await tx.documentRecord.updateMany({
    where: { id: record.id, currentVersion: input.expectedVersion },
    data: { currentVersion: nextVersion },
  });
  if (advanced.count !== 1) throw versionConflict();
  await audit.append(tx, versionAudit(record, version, input));
  return version;
}, { isolationLevel: "Serializable" });
```

The first version resolves the currently active template for the resource organization/department and kind, then pins that `templateVersionId` on the stable record. Later versions reuse it. Upload sources must match the same organization, department, kind, and resource and may be attached once; external/GitHub sources persist URL plus source ID without fetching content.

- [ ] **Step 4: Compose API routes and full authorization tests**

Routes:

```text
POST /documents
GET /documents/:documentId
POST /documents/:documentId/versions
POST /documents/uploads
POST /documents/uploads/:uploadedSourceId/signed-read
```

The composed integration test creates a project with two workstreams, activates templates, uploads a project source and workstream source, creates each sole document, appends a second project version, reads retained version 1, rejects stale version 1 reuse, rejects a second stable document, denies a contributor write, permits contributor read, denies cross-department manager access, and verifies every signed read is authorized.

- [ ] **Step 5: Verify T023 and commit**

Run: `TEST_DATABASE_URL=postgresql://haitham@127.0.0.1:5432/evaluation_phase1_test pnpm exec vitest run --root . packages/documents/src/document-service.integration.test.ts apps/api/src/documents/documents.controller.test.ts apps/api/src/documents/documents.e2e.integration.test.ts && pnpm test:e2e && pnpm lint && pnpm typecheck`

Expected: PASS with old versions retained and all negative authorization cases denied.

```bash
git add packages/documents apps/api tests/e2e pnpm-lock.yaml
git commit -m "feat: implement versioned project documents"
```

### Task 7: Bundle B Verification, Independent Review, and State Update

**Files:**
- Modify: `TASKS.md`
- Modify: `project-state/PROJECT_STATE.md`
- Modify: `project-state/SYSTEM_MAP.html`
- Modify: `MANIFEST.sha256`

**Interfaces:**
- Consumes: completed T021–T023 and all repository verification commands.
- Produces: authoritative Bundle B completion evidence and next action T024–T028 planning.

- [ ] **Step 1: Run all amendment and repository verification gates fresh**

Run:

```bash
pnpm verify
pnpm test:integration
pnpm db:verify
pnpm test:ai
pnpm test:e2e
pnpm infra:verify
```

Expected: every command exits 0. The AI evaluation suite must remain unchanged apart from consuming no new provider route; no paid OpenAI request is required by Bundle B.

- [ ] **Step 2: Run targeted security and history checks**

Run:

```bash
pnpm exec vitest run --root . packages/documents/src apps/api/src/documents packages/database/src/documents-schema.integration.test.ts
pnpm scan:secrets
node scripts/validate-boundaries.mjs
```

Expected: PASS with no secret findings, no direct provider SDK imports outside AI Router, and no module-boundary violation.

- [ ] **Step 3: Request one bounded independent review**

Reviewer brief: compare the amended branch against `AGENTS.md`, `docs/PROJECT_REFERENCE.md`, `docs/IMPLEMENTATION_PLAN.md`, `TASKS.md` T021–T023, and the approved Phase 1 design. Report only unresolved P0/P1 correctness, authorization, upload-safety, history, transaction, or protected-rule violations. Do not request readiness/AI/criteria/UI work and do not open an adversarial review loop.

Expected: APPROVED with zero unresolved P0/P1 findings. Fix only verified in-scope blockers and rerun the affected gate plus the full gate set.

- [ ] **Step 4: Update operational state and task status**

`TASKS.md` marks T021, T022, and T023 complete with verification evidence. `PROJECT_STATE.md` states Bundle B is complete, identifies no protected-rule change, records remaining operational risks without secrets, and sets Bundle C T024–T028 planning as the next action. `SYSTEM_MAP.html` adds the template → private upload → immutable document-version flow and marks readiness/criteria as not yet implemented.

- [ ] **Step 5: Refresh manifest and verify it**

Run: `node scripts/generate-manifest.mjs && node scripts/verify-manifest.mjs`

Expected: PASS with hashes for every tracked authoritative artifact.

- [ ] **Step 6: Commit and push Bundle B**

```bash
git add TASKS.md project-state/PROJECT_STATE.md project-state/SYSTEM_MAP.html MANIFEST.sha256
git commit -m "docs: close Phase 1 documents bundle"
git push origin codex/phase-1-projects-workstreams-documents
```

Expected: push succeeds and the branch is clean and tracking `origin/codex/phase-1-projects-workstreams-documents`.
