import { createHash, randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@evaluation/database";

import { ExportService, InMemoryReportStorage } from "./export-service.js";
import { ProjectionRegistry } from "./projection-registry.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const employeeId = randomUUID();

beforeAll(async () => {
  await database.user.create({
    data: { id: employeeId, email: `${employeeId}@example.test`, displayName: "Employee" },
  });
});
afterAll(async () => database.$disconnect());

function registry() {
  const registry = new ProjectionRegistry();
  registry.register({
    reportType: "EMPLOYEE_EVALUATION",
    audience: "EMPLOYEE_SELF",
    source: "employee-evaluation",
    projectionVersion: 1,
    authorizeCurrent: async () => true,
    snapshot: async () => ({ snapshotId: "closed-snapshot-1", version: 3 }),
    read: async () => ({ title: "Closed evaluation", lines: ["Calibration — Non-Baseline"] }),
  });
  return registry;
}

describe("ExportService", () => {
  it("pins immutable source versions before generation and reproduces the same artifact", async () => {
    const storage = new InMemoryReportStorage();
    const service = new ExportService(
      database,
      registry(),
      storage,
      () => new Date("2026-08-07T10:00:00.000Z"),
    );
    const request = await service.request({
      requesterId: employeeId,
      idempotencyKey: randomUUID(),
      reportType: "EMPLOYEE_EVALUATION",
      audience: "EMPLOYEE_SELF",
      format: "HTML",
      locale: "en",
      cycleId: randomUUID(),
      timezone: "Asia/Riyadh",
    });

    expect(request.manifest.sourceVersions).toEqual([
      { source: "employee-evaluation", snapshotId: "closed-snapshot-1", version: 3 },
    ]);
    expect(request.manifest).toMatchObject({
      reportType: "EMPLOYEE_EVALUATION",
      audience: "EMPLOYEE_SELF",
      format: "HTML",
      locale: "en",
      timezone: "Asia/Riyadh",
      cycleId: expect.any(String),
      renderAt: "2026-08-07T10:00:00.000Z",
    });
    const first = await service.materialize(request.request.id);
    const second = await service.materialize(request.request.id);
    expect(second.contentHash).toBe(first.contentHash);
    expect(storage.objects.get(first.storageKey)?.encrypted).toBe(true);
  });

  it("uses only immutable manifest pins so a retry produces identical bytes", async () => {
    const storage = new InMemoryReportStorage();
    const service = new ExportService(
      database,
      registry(),
      storage,
      () => new Date("2026-08-07T10:00:00.000Z"),
    );
    const requested = await service.request({
      requesterId: employeeId,
      idempotencyKey: randomUUID(),
      reportType: "EMPLOYEE_EVALUATION",
      audience: "EMPLOYEE_SELF",
      format: "HTML",
      locale: "en",
      cycleId: randomUUID(),
      timezone: "Asia/Riyadh",
    });
    await database.exportRequest.update({
      where: { id: requested.request.id },
      data: { reportType: "PROJECT_OPERATIONAL", audience: "MANAGER_DEPARTMENT", locale: "ar" },
    });
    const first = await service.materialize(requested.request.id);
    const bytes = storage.objects.get(first.storageKey)?.content;
    expect(bytes?.toString()).toContain("Closed evaluation");
    expect(bytes?.toString()).toContain("Aug 7, 2026");
    expect(first.contentHash).toBe(
      createHash("sha256")
        .update(bytes ?? Buffer.alloc(0))
        .digest("hex"),
    );
  });

  it("claims generation atomically so concurrent jobs return one artifact", async () => {
    const storage = new InMemoryReportStorage();
    const service = new ExportService(database, registry(), storage);
    const requested = await service.request({
      requesterId: employeeId,
      idempotencyKey: randomUUID(),
      reportType: "EMPLOYEE_EVALUATION",
      audience: "EMPLOYEE_SELF",
      format: "HTML",
      locale: "en",
      cycleId: randomUUID(),
      timezone: "Asia/Riyadh",
    });
    const results = await Promise.allSettled([
      service.materialize(requested.request.id),
      service.materialize(requested.request.id),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(2);
    expect(
      await database.exportArtifact.count({
        where: { manifest: { requestId: requested.request.id } },
      }),
    ).toBe(1);
    await expect(service.readRequest(employeeId, requested.request.id)).resolves.toMatchObject({
      state: "READY",
    });
  });

  it("blocks Arabic evaluation exports until T016", async () => {
    const service = new ExportService(database, registry(), new InMemoryReportStorage());
    await expect(
      service.request({
        requesterId: employeeId,
        idempotencyKey: randomUUID(),
        reportType: "EMPLOYEE_EVALUATION",
        audience: "EMPLOYEE_SELF",
        format: "PDF",
        locale: "ar",
        cycleId: randomUUID(),
        timezone: "Asia/Riyadh",
      }),
    ).rejects.toMatchObject({ code: "ARABIC_EVALUATION_NOT_APPROVED" });
  });

  it("records a bounded failed state while leaving the pinned request retryable", async () => {
    const service = new ExportService(database, registry(), {
      put: async () => {
        throw new Error("private provider detail");
      },
      signGet: async () => "unused",
    });
    const request = await service.request({
      requesterId: employeeId,
      idempotencyKey: randomUUID(),
      reportType: "EMPLOYEE_EVALUATION",
      audience: "EMPLOYEE_SELF",
      format: "PDF",
      locale: "en",
      cycleId: randomUUID(),
      timezone: "Asia/Riyadh",
    });
    await expect(service.materialize(request.request.id)).rejects.toThrow(
      "EXPORT_GENERATION_FAILED",
    );
    await expect(service.readRequest(employeeId, request.request.id)).resolves.toMatchObject({
      state: "FAILED",
      artifactId: null,
    });
    await expect(
      database.exportRequest.findUniqueOrThrow({ where: { id: request.request.id } }),
    ).resolves.toMatchObject({ failureCategory: "GENERATION", attemptCount: 1 });
  });
});
