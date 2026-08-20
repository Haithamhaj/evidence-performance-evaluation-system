import { describe, expect, it } from "vitest";

import {
  ActivateDocumentTemplateVersionSchema,
  AppendDocumentVersionSchema,
  CreateDocumentSchema,
  CreateDocumentTemplateVersionSchema,
  DOCUMENT_ERROR_CODES,
  DocumentDetailSchema,
  PROJECT_PROTECTED_SECTION_KEYS,
  StageUploadMetadataSchema,
  WORKSTREAM_REQUIRED_SECTION_KEYS,
} from "./documents.js";

const projectSections = PROJECT_PROTECTED_SECTION_KEYS.map((key, index) => ({
  key,
  position: index + 1,
  display: { en: { title: key.replaceAll("_", " ") } },
  required: true,
  protected: true,
}));

describe("document contracts", () => {
  it("publishes the exact protected project and required workstream keys", () => {
    expect(PROJECT_PROTECTED_SECTION_KEYS).toEqual([
      "project_definition_and_ownership",
      "problem_and_context",
      "objective_and_expected_outcome",
      "scope_and_boundaries",
      "expected_deliverables",
      "definition_of_success",
    ]);
    expect(WORKSTREAM_REQUIRED_SECTION_KEYS).toEqual([
      "purpose",
      "scope",
      "expected_output",
      "parent_project_relationship",
      "dependencies",
      "proposed_approach_or_architecture",
      "definition_of_success",
      "responsible_members",
      "relevant_sources_or_repositories",
    ]);
  });

  it("accepts an organization-scoped project template at aggregate version zero", () => {
    expect(
      CreateDocumentTemplateVersionSchema.parse({
        expectedVersion: 0,
        scopeType: "organization",
        organizationId: "93e6b267-08f9-4cc2-8912-2432e5a43fd0",
        kind: "project",
        sections: projectSections,
        reason: "Initial governed template",
      }),
    ).toMatchObject({ expectedVersion: 0, scopeType: "organization" });
  });

  it("requires department identity only for department-scoped templates", () => {
    const common = {
      expectedVersion: 0,
      organizationId: "93e6b267-08f9-4cc2-8912-2432e5a43fd0",
      kind: "project" as const,
      sections: projectSections,
      reason: "Initial governed template",
    };
    expect(() =>
      CreateDocumentTemplateVersionSchema.parse({ ...common, scopeType: "department" }),
    ).toThrow();
    expect(() =>
      CreateDocumentTemplateVersionSchema.parse({
        ...common,
        scopeType: "organization",
        departmentId: "73b166b8-3520-42c4-b007-06b5814bb77a",
      }),
    ).toThrow();
  });

  it("requires optimistic-concurrency tokens for template activation and document revision", () => {
    expect(() => ActivateDocumentTemplateVersionSchema.parse({ reason: "Approved" })).toThrow();
    expect(() => AppendDocumentVersionSchema.parse({ sources: [], reason: "Update" })).toThrow();
    expect(() =>
      AppendDocumentVersionSchema.parse({
        expectedVersion: 1,
        sources: [],
        reason: "Update",
        extra: true,
      }),
    ).toThrow();
  });

  it("accepts upload, external-link, and GitHub sources without fetching external content", () => {
    const inputs = [
      {
        sourceType: "upload",
        uploadedSourceId: "4b9bf6b4-ad8f-46ca-a0a5-aad6ac5820f3",
      },
      { sourceType: "external_link", url: "https://example.invalid/reference" },
      {
        sourceType: "github",
        url: "https://github.com/example/repository/pull/1",
        sourceId: "pull:1",
      },
    ];
    expect(
      CreateDocumentSchema.parse({
        kind: "project",
        resourceId: "341f5dbe-a7fc-4f37-8388-009b41836caa",
        expectedVersion: 0,
        sources: inputs,
        reason: "Initial sources",
      }).sources,
    ).toHaveLength(3);
  });

  it("accepts only the approved Phase 1 upload metadata", () => {
    expect(
      StageUploadMetadataSchema.parse({
        kind: "workstream",
        resourceId: "c4ddfcd7-d8a0-40e9-a7de-79c1fbc608d5",
        filename: "architecture.docx",
        declaredMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        reason: "Architecture update",
      }),
    ).toMatchObject({ filename: "architecture.docx" });
    expect(() =>
      StageUploadMetadataSchema.parse({
        kind: "project",
        resourceId: "341f5dbe-a7fc-4f37-8388-009b41836caa",
        filename: "script.exe",
        declaredMime: "application/octet-stream",
        reason: "Executable",
      }),
    ).toThrow();
  });

  it("keeps private capture uploads unclassified and limited to files or images", async () => {
    const { PrivateCaptureUploadMetadataSchema } = await import("./documents.js");
    expect(
      PrivateCaptureUploadMetadataSchema.parse({
        filename: "client-notes.pdf",
        declaredMime: "application/pdf",
      }),
    ).toMatchObject({ filename: "client-notes.pdf" });
    expect(() =>
      PrivateCaptureUploadMetadataSchema.parse({
        filename: "recording.mp3",
        declaredMime: "audio/mpeg",
      }),
    ).toThrow();
    expect(() =>
      PrivateCaptureUploadMetadataSchema.parse({
        filename: "unsafe.exe",
        declaredMime: "application/octet-stream",
      }),
    ).toThrow();
  });

  it("publishes the stable document conflict and upload rejection codes", () => {
    expect(DOCUMENT_ERROR_CODES).toEqual(
      expect.arrayContaining([
        "VERSION_CONFLICT",
        "UPLOAD_TYPE_REJECTED",
        "UPLOAD_SIZE_REJECTED",
        "UPLOAD_SAFETY_REJECTED",
      ]),
    );
  });

  it("returns immutable version history without private object keys", () => {
    const detail = {
      id: "00000000-0000-4000-8000-000000000001",
      kind: "project",
      resourceId: "00000000-0000-4000-8000-000000000002",
      templateVersionId: "00000000-0000-4000-8000-000000000003",
      currentVersion: 1,
      createdAt: "2026-07-17T12:00:00.000Z",
      versions: [
        {
          id: "00000000-0000-4000-8000-000000000004",
          documentId: "00000000-0000-4000-8000-000000000001",
          version: 1,
          templateVersionId: "00000000-0000-4000-8000-000000000003",
          createdById: "00000000-0000-4000-8000-000000000005",
          reason: "Initial document",
          createdAt: "2026-07-17T12:00:00.000Z",
          sources: [
            {
              id: "00000000-0000-4000-8000-000000000006",
              position: 1,
              sourceType: "external_link",
              url: "https://example.invalid/source",
            },
          ],
        },
      ],
    };
    expect(DocumentDetailSchema.parse(detail)).toMatchObject({ currentVersion: 1 });
    expect(() =>
      DocumentDetailSchema.parse({
        ...detail,
        versions: [{ ...detail.versions[0], objectKey: "documents/private" }],
      }),
    ).toThrow();
  });
});
