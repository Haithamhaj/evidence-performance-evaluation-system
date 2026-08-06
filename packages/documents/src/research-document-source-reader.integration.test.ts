import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import { createDatabaseClient } from "@evaluation/database";
import { DocumentResourceReader } from "@evaluation/projects";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DocumentAnalysisSourceLoader } from "./document-analysis-source-loader.js";
import {
  ProgressContractDraftSourceLocator,
  ProgressContractDraftSourceReader,
} from "./progress-contract-draft-source-reader.js";
import { ResearchDocumentSourceReader } from "./research-document-source-reader.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const ownerId = crypto.randomUUID();
const outsiderId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const otherProjectId = crypto.randomUUID();
const documentId = crypto.randomUUID();
const historicalVersionId = crypto.randomUUID();
const currentVersionId = crypto.randomUUID();
const draftVersionId = crypto.randomUUID();
const historicalSourceId = crypto.randomUUID();
const currentSourceId = crypto.randomUUID();
const draftSourceId = crypto.randomUUID();
const historicalContent = "# Objective\nRetain the first approved immutable context.";
const currentContent = "# Objective\nUse the newer approved immutable context.";
const draftContent = "# Objective\nThis draft is not approved.";
const contents = new Map<string, string>();

let reader: ResearchDocumentSourceReader;

beforeAll(async () => {
  const suffix = crypto.randomUUID();
  const organization = await client.organization.create({
    data: { key: `research-document-${suffix}`, name: "Research Document" },
  });
  const department = await client.department.create({
    data: {
      key: `research-document-${suffix}`,
      name: "Research Document",
      organizationId: organization.id,
    },
  });
  await client.user.createMany({
    data: [
      {
        id: ownerId,
        email: `research-document-owner-${suffix}@example.invalid`,
        displayName: "Document owner",
      },
      {
        id: outsiderId,
        email: `research-document-outsider-${suffix}@example.invalid`,
        displayName: "Document outsider",
      },
    ],
  });
  await client.authorizationScope.createMany({
    data: [
      {
        id: department.id,
        key: `research-document-department-${suffix}`,
        scopeType: "department",
        departmentId: department.id,
      },
      {
        id: projectId,
        key: `research-document-project-${suffix}`,
        scopeType: "project",
        departmentId: department.id,
      },
      {
        id: otherProjectId,
        key: `research-document-other-project-${suffix}`,
        scopeType: "project",
        departmentId: department.id,
      },
    ],
  });
  await client.project.createMany({
    data: [
      {
        id: projectId,
        organizationId: organization.id,
        departmentId: department.id,
        authorizationScopeId: projectId,
        name: "Document Project",
        description: "Version-pinned document context",
        status: "active",
        createdById: ownerId,
      },
      {
        id: otherProjectId,
        organizationId: organization.id,
        departmentId: department.id,
        authorizationScopeId: otherProjectId,
        name: "Other Document Project",
        description: "Cross-Project boundary",
        status: "active",
        createdById: ownerId,
      },
    ],
  });
  await client.responsibilityWindow.create({
    data: {
      employeeId: ownerId,
      projectId,
      responsibilityType: "original",
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      reason: "Current Project owner",
      managerDecisionById: ownerId,
      managerDecisionAt: new Date("2026-08-01T00:00:00.000Z"),
      managerDecisionReason: "Document test owner",
      createdById: ownerId,
    },
  });
  await client.roleAssignment.create({
    data: {
      userId: ownerId,
      role: "project_owner",
      scopeType: "project",
      scopeId: projectId,
    },
  });
  const template = await client.documentTemplate.create({
    data: {
      organizationId: organization.id,
      departmentId: department.id,
      scopeType: "department",
      kind: "project",
      createdById: ownerId,
      versions: {
        create: {
          version: 1,
          status: "active",
          reason: "Research document fixture",
          createdById: ownerId,
          activatedAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      },
    },
    include: { versions: true },
  });
  const templateVersionId = template.versions[0]!.id;
  await client.documentRecord.create({
    data: {
      id: documentId,
      organizationId: organization.id,
      departmentId: department.id,
      projectId,
      templateVersionId,
      currentVersion: 2,
      createdById: ownerId,
      versions: {
        create: [
          {
            id: historicalVersionId,
            version: 1,
            templateVersionId,
            reason: "First approved version",
            createdById: ownerId,
          },
          {
            id: currentVersionId,
            version: 2,
            templateVersionId,
            reason: "Newer approved version",
            createdById: ownerId,
          },
          {
            id: draftVersionId,
            version: 3,
            templateVersionId,
            reason: "Unapproved draft version",
            createdById: ownerId,
          },
        ],
      },
    },
  });
  const sourceFixtures = [
    {
      versionId: historicalVersionId,
      sourceId: historicalSourceId,
      content: historicalContent,
      label: "historical",
    },
    {
      versionId: currentVersionId,
      sourceId: currentSourceId,
      content: currentContent,
      label: "current",
    },
    {
      versionId: draftVersionId,
      sourceId: draftSourceId,
      content: draftContent,
      label: "draft",
    },
  ];
  for (const fixture of sourceFixtures) {
    const objectKey = `research-document/${suffix}/${fixture.label}.txt`;
    contents.set(objectKey, fixture.content);
    const uploaded = await client.uploadedSource.create({
      data: {
        organizationId: organization.id,
        departmentId: department.id,
        projectId,
        originalFilename: `${fixture.label}.txt`,
        objectKey,
        detectedType: "text",
        detectedMime: "text/plain",
        byteSize: Buffer.byteLength(fixture.content),
        sha256: checksum(fixture.content),
        createdById: ownerId,
        reason: "Version-pinned Research source",
      },
    });
    await client.documentVersionSource.create({
      data: {
        id: fixture.sourceId,
        documentVersionId: fixture.versionId,
        position: 1,
        sourceType: "upload",
        uploadedSourceId: uploaded.id,
      },
    });
  }
  await approveVersion({
    suffix,
    organizationId: organization.id,
    templateVersionId,
    documentVersionId: historicalVersionId,
    version: 1,
  });
  await approveVersion({
    suffix,
    organizationId: organization.id,
    templateVersionId,
    documentVersionId: currentVersionId,
    version: 2,
  });

  const identityReader = new DocumentResourceReader(client);
  const policy = {
    maxSourceBytes: 100_000,
    maxArchiveEntries: 20,
    maxArchiveUncompressedBytes: 1_000_000,
    maxArchiveCompressionRatio: 20,
    maxQuotedCharacters: 20_000,
  };
  const storage = {
    async readStream(input: { key: string }) {
      const content = contents.get(input.key);
      if (content === undefined) throw new Error("Missing test object");
      return Readable.from([Buffer.from(content)]);
    },
  };
  const sourceLoader = new DocumentAnalysisSourceLoader(client, storage as never, policy);
  reader = new ResearchDocumentSourceReader(
    new ProgressContractDraftSourceLocator(client, identityReader),
    new ProgressContractDraftSourceReader(client, identityReader, sourceLoader, policy),
  );
});

afterAll(async () => client.$disconnect());

describe("ResearchDocumentSourceReader", () => {
  it("keeps an earlier approved immutable version readable after a newer approval", async () => {
    await expect(
      reader.readApprovedVersion({
        actor: { userId: ownerId, active: true },
        documentVersionId: historicalVersionId,
        projectId,
      }),
    ).resolves.toEqual({
      projectId,
      documentId,
      documentVersionId: historicalVersionId,
      documentVersion: 1,
      sourceChecksumSha256: checksum(historicalContent),
      sourceReferences: [`document-source:${historicalSourceId}`],
      extractedText: historicalContent,
    });
  });

  it("returns the exact newer approved version rather than silently substituting another version", async () => {
    await expect(
      reader.readApprovedVersion({
        actor: { userId: ownerId, active: true },
        documentVersionId: currentVersionId,
        projectId,
      }),
    ).resolves.toMatchObject({
      documentVersionId: currentVersionId,
      documentVersion: 2,
      sourceChecksumSha256: checksum(currentContent),
      extractedText: currentContent,
    });
  });

  it("rejects an unapproved draft, cross-Project request, and unauthorized actor", async () => {
    await expect(
      reader.readApprovedVersion({
        actor: { userId: ownerId, active: true },
        documentVersionId: draftVersionId,
        projectId,
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_DOCUMENT_SOURCE_INVALID" });
    await expect(
      reader.readApprovedVersion({
        actor: { userId: ownerId, active: true },
        documentVersionId: historicalVersionId,
        projectId: otherProjectId,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      reader.readApprovedVersion({
        actor: { userId: outsiderId, active: true },
        documentVersionId: historicalVersionId,
        projectId,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

async function approveVersion(input: {
  suffix: string;
  organizationId: string;
  templateVersionId: string;
  documentVersionId: string;
  version: number;
}) {
  const artifactVersion = `${input.suffix}-${input.version}`;
  const schemaHash = checksum(`schema-${artifactVersion}`);
  const promptHash = checksum(`prompt-${artifactVersion}`);
  const schema = await client.aiOutputSchemaArtifact.create({
    data: {
      routeKey: "document.analyze",
      version: artifactVersion,
      schemaHash,
      schemaArtifact: { type: "object" },
      reason: "Historical approved version fixture",
      expectedBehavior: "Return source-bound readiness only",
      evaluationEvidenceReferences: [`test:${crypto.randomUUID()}`],
      humanApprovalPolicy: "feature_defined",
      createdById: ownerId,
    },
  });
  const prompt = await client.analysisPromptArtifact.create({
    data: {
      routeKey: "document.analyze",
      version: artifactVersion,
      bodyHash: promptHash,
      trustedBody: "Trusted readiness fixture.",
      expectedBehavior: "Return source-bound readiness only",
      registeredById: ownerId,
      registrationReason: "Historical approved version fixture",
    },
  });
  const operation = await client.operation.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      jobType: "document.readiness",
      jobVersion: 1,
      idempotencyKey: `research-document-operation-${artifactVersion}`,
      correlationId: crypto.randomUUID(),
      payloadHash: checksum(`operation-${artifactVersion}`),
    },
  });
  const request = await client.documentAnalysisRequest.create({
    data: {
      kind: "readiness",
      idempotencyKey: `research-document-request-${artifactVersion}`,
      payloadHash: checksum(`request-${artifactVersion}`),
      routeKey: "document.analyze",
      documentId,
      currentDocumentVersionId: input.documentVersionId,
      expectedAggregateVersion: input.version,
      outputSchemaArtifactId: schema.id,
      outputSchemaVersion: schema.version,
      outputSchemaHash: schema.schemaHash,
      promptArtifactId: prompt.id,
      promptVersion: prompt.version,
      promptHash: prompt.bodyHash,
      operationId: operation.id,
      state: "running",
      startedAt: new Date("2026-08-05T07:59:00.000Z"),
    },
  });
  const readiness = await client.documentReadinessCheck.create({
    data: {
      requestId: request.id,
      documentId,
      documentVersionId: input.documentVersionId,
      templateVersionId: input.templateVersionId,
      analyzedState: "ready_for_criteria_generation",
      managerState: "ready",
      extractionCoverage: "complete",
      output: { state: "ready_for_criteria_generation" },
      outputReference: `readiness-output:${crypto.randomUUID()}`,
      inputSchemaVersion: "document-readiness-input.v1",
      outputSchemaVersion: schema.version,
      promptVersion: prompt.version,
      promptHash: prompt.bodyHash,
      validationOutcome: "valid",
      stale: false,
      sourceReferences: [`document-version:${input.documentVersionId}`],
      createdById: ownerId,
    },
  });
  await client.documentReadinessLifecycleTransition.createMany({
    data: [
      {
        readinessCheckId: readiness.id,
        documentVersionId: input.documentVersionId,
        fromState: "draft",
        toState: "ready_for_criteria_generation",
        actorId: ownerId,
        reason: "Ready for criteria generation",
        effectiveAt: new Date("2026-08-05T08:00:00.000Z"),
      },
      {
        readinessCheckId: readiness.id,
        documentVersionId: input.documentVersionId,
        fromState: "ready_for_criteria_generation",
        toState: "criteria_approved",
        actorId: ownerId,
        reason: "Approved by the authorized owner",
        effectiveAt: new Date("2026-08-05T08:01:00.000Z"),
      },
    ],
  });
  await client.documentAnalysisRequest.update({
    where: { id: request.id },
    data: {
      state: "succeeded",
      resultReference: readiness.outputReference,
      completedAt: new Date("2026-08-05T08:02:00.000Z"),
    },
  });
}

function checksum(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}
