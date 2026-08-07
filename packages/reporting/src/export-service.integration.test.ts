import { randomUUID } from "node:crypto";

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
    snapshot: async () => ({ snapshotId: "closed-snapshot-1", version: 3 }),
    read: async () => ({ title: "Closed evaluation", lines: ["Calibration — Non-Baseline"] }),
  });
  return registry;
}

describe("ExportService", () => {
  it("pins immutable source versions before generation and reproduces the same artifact", async () => {
    const storage = new InMemoryReportStorage();
    const service = new ExportService(database, registry(), storage);
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
    const first = await service.generate(request.request.id);
    const second = await service.generate(request.request.id);
    expect(second.contentHash).toBe(first.contentHash);
    expect(storage.objects.get(first.storageKey)?.encrypted).toBe(true);
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
});
