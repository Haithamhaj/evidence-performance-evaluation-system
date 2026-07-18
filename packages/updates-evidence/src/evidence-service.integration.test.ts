import { afterAll, describe, expect, it, vi } from "vitest";

import { AppError } from "@evaluation/contracts";
import { createDatabaseClient } from "@evaluation/database";

import { ActivityReader } from "./activity-reader.js";
import { EvidenceService } from "./evidence-service.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const now = new Date("2026-07-18T12:00:00.000Z");

afterAll(async () => client.$disconnect());

describe("EvidenceService", () => {
  it("requires employee review of an AI-drafted claim before immutable confirmation", async () => {
    const graph = await seedGraph();
    const scopeReader = { authorizeIn: vi.fn(async () => undefined) };
    const service = new EvidenceService(
      client,
      scopeReader,
      { getApprovedUploadIn: vi.fn() },
      auditWriter,
      () => now,
    );
    const created = await service.create({
      actor: { userId: graph.employeeId, active: true },
      correlationId: crypto.randomUUID(),
      input: {
        idempotencyKey: crypto.randomUUID(),
        projectId: graph.projectId,
        workstreamId: null,
        workItemId: null,
        capturedFromWorkItem: false,
        updateSourceId: null,
        source: { kind: "pasted_text", text: "نجحت حالات القبول 12/12." },
        supportedClaim: "نجحت اختبارات القبول.",
        relatedKpiComponentId: null,
        relatedCriterionId: null,
        contributionContext: "نفذت الاختبارات وراجعت النتيجة.",
        executionMode: "ai_assisted",
      },
    });
    expect(created).toMatchObject({ revision: 1, revisionKind: "ai_draft", state: "draft" });
    await expect(
      service.confirm({
        actor: { userId: graph.employeeId, active: true },
        correlationId: crypto.randomUUID(),
        evidenceId: created.id,
        input: { expectedRevision: 1, reason: "لم أراجع بعد" },
      }),
    ).rejects.toMatchObject({ code: "EVIDENCE_EMPLOYEE_EDIT_REQUIRED" });

    const revised = await service.revise({
      actor: { userId: graph.employeeId, active: true },
      correlationId: crypto.randomUUID(),
      evidenceId: created.id,
      input: {
        expectedRevision: 1,
        supportedClaim: "أكد سجل التشغيل نجاح 12 من 12 حالة قبول.",
        contributionContext: "نفذت الاختبارات وراجعت السجل بنفسي.",
      },
    });
    expect(revised).toMatchObject({ revision: 2, revisionKind: "employee_edit" });

    const accepted = await service.confirm({
      actor: { userId: graph.employeeId, active: true },
      correlationId: crypto.randomUUID(),
      evidenceId: created.id,
      input: { expectedRevision: 2, reason: "راجعت الدليل وأكدته." },
    });
    expect(accepted).toMatchObject({
      evidenceId: created.id,
      projectId: graph.projectId,
      sourceReferences: [`evidence:${created.id}`],
    });
    const timeline = await new ActivityReader(client).timeline({
      actorId: graph.employeeId,
      projectId: graph.projectId,
      workstreamId: null,
      limit: 20,
      cursor: null,
    });
    expect(timeline.items).toEqual([
      expect.objectContaining({
        kind: "evidence",
        id: accepted.id,
        projectId: graph.projectId,
        title: revised.supportedClaim,
      }),
    ]);
    await expect(
      client.progressRecalculationRequest.count({
        where: { acceptedEvent: { projectId: graph.projectId } },
      }),
    ).resolves.toBe(0);
    await expect(
      client.evidenceRevision.update({
        where: { id: revised.revisionId },
        data: { supportedClaim: "mutated" },
      }),
    ).rejects.toBeDefined();
  });

  it("accepts only already-inspected private uploads and exposes no object key", async () => {
    const graph = await seedGraph();
    const uploaded = await client.uploadedSource.create({
      data: {
        organizationId: graph.organizationId,
        departmentId: graph.departmentId,
        projectId: graph.projectId,
        originalFilename: "acceptance.png",
        objectKey: `documents/${graph.organizationId}/private-object`,
        detectedType: "png",
        detectedMime: "image/png",
        byteSize: 128,
        sha256: "a".repeat(64),
        createdById: graph.employeeId,
        reason: "Acceptance evidence",
      },
    });
    const sourceReader = {
      getApprovedUploadIn: vi.fn(async () => ({
        objectKey: `documents/${graph.organizationId}/private-object`,
        mediaType: "image/png",
        checksumSha256: "a".repeat(64),
        sizeBytes: 128,
      })),
    };
    const service = new EvidenceService(
      client,
      { authorizeIn: async () => undefined },
      sourceReader,
      auditWriter,
      () => now,
    );
    const created = await service.create({
      actor: { userId: graph.employeeId, active: true },
      correlationId: crypto.randomUUID(),
      input: {
        idempotencyKey: crypto.randomUUID(),
        projectId: graph.projectId,
        workstreamId: null,
        workItemId: null,
        capturedFromWorkItem: false,
        updateSourceId: null,
        source: { kind: "screenshot", uploadedSourceId: uploaded.id },
        supportedClaim: "تظهر الصورة نجاح سيناريو القبول.",
        relatedKpiComponentId: null,
        relatedCriterionId: null,
        contributionContext: "نفذت السيناريو والتقطت النتيجة.",
        executionMode: "manual",
      },
    });
    expect(created).not.toHaveProperty("objectKey");
    expect(sourceReader.getApprovedUploadIn).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ uploadedSourceId: uploaded.id, projectId: graph.projectId }),
    );

    const before = await client.evidenceRecord.count({ where: { projectId: graph.projectId } });
    const unsafe = new EvidenceService(
      client,
      { authorizeIn: async () => undefined },
      {
        getApprovedUploadIn: async () => {
          throw new AppError(
            "UPLOAD_SAFETY_REJECTED",
            "errors.documents.uploadSafetyRejected",
            400,
          );
        },
      },
      auditWriter,
      () => now,
    );
    await expect(
      unsafe.create({
        actor: { userId: graph.employeeId, active: true },
        correlationId: crypto.randomUUID(),
        input: {
          idempotencyKey: crypto.randomUUID(),
          projectId: graph.projectId,
          workstreamId: null,
          workItemId: null,
          capturedFromWorkItem: false,
          updateSourceId: null,
          source: { kind: "file", uploadedSourceId: uploaded.id },
          supportedClaim: "Unsafe",
          relatedKpiComponentId: null,
          relatedCriterionId: null,
          contributionContext: "Unsafe",
          executionMode: "manual",
        },
      }),
    ).rejects.toMatchObject({ code: "UPLOAD_SAFETY_REJECTED" });
    await expect(
      client.evidenceRecord.count({ where: { projectId: graph.projectId } }),
    ).resolves.toBe(before);
  });

  it("lets the employee reject a draft without creating an accepted event", async () => {
    const graph = await seedGraph();
    const append = vi.fn(auditWriter.append);
    const service = new EvidenceService(
      client,
      { authorizeIn: async () => undefined },
      { getApprovedUploadIn: vi.fn() },
      { append },
      () => now,
    );
    const created = await service.create({
      actor: { userId: graph.employeeId, active: true },
      correlationId: crypto.randomUUID(),
      input: {
        idempotencyKey: crypto.randomUUID(),
        projectId: graph.projectId,
        workstreamId: null,
        workItemId: null,
        capturedFromWorkItem: false,
        updateSourceId: null,
        source: { kind: "pasted_text", text: "نتيجة أولية تحتاج المراجعة." },
        supportedClaim: "مسودة دليل",
        relatedKpiComponentId: null,
        relatedCriterionId: null,
        contributionContext: "قيد المراجعة",
        executionMode: "manual",
      },
    });

    const rejected = await service.reject({
      actor: { userId: graph.employeeId, active: true },
      correlationId: crypto.randomUUID(),
      evidenceId: created.id,
      input: { expectedRevision: 1, reason: "لا يدعم الادعاء المطلوب." },
    });

    expect(rejected).toMatchObject({ id: created.id, state: "rejected", revision: 1 });
    await expect(
      client.acceptedEvidenceEvent.count({ where: { evidenceId: created.id } }),
    ).resolves.toBe(0);
    expect(append).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: "evidence.rejected",
        targetId: created.id,
        reason: "لا يدعم الادعاء المطلوب.",
      }),
    );
  });
});

const auditWriter: import("@evaluation/contracts").AuditWriter<
  import("@evaluation/database").DatabaseTransaction
> = {
  append: async () => ({ id: crypto.randomUUID(), createdAt: now.toISOString() }),
};

async function seedGraph() {
  const suffix = crypto.randomUUID();
  const organizationId = crypto.randomUUID();
  const departmentId = crypto.randomUUID();
  const employeeId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  await client.organization.create({
    data: { id: organizationId, key: `evidence-org-${suffix}`, name: "Evidence" },
  });
  await client.department.create({
    data: { id: departmentId, key: `evidence-dept-${suffix}`, name: "Evidence", organizationId },
  });
  await client.user.create({
    data: {
      id: employeeId,
      email: `evidence-${suffix}@example.invalid`,
      displayName: "Employee",
    },
  });
  await client.authorizationScope.create({
    data: {
      id: projectId,
      key: `evidence-project-${suffix}`,
      scopeType: "project",
      departmentId,
    },
  });
  await client.project.create({
    data: {
      id: projectId,
      organizationId,
      departmentId,
      authorizationScopeId: projectId,
      name: "Evidence project",
      description: "",
      status: "active",
      createdById: employeeId,
    },
  });
  await client.projectMember.create({
    data: {
      projectId,
      employeeId,
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      reason: "Evidence contributor",
      createdById: employeeId,
    },
  });
  return { organizationId, departmentId, employeeId, projectId };
}
