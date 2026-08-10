import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@evaluation/database";
import {
  ArtifactAccessService,
  ExportService,
  InMemoryReportStorage,
  ProjectionRegistry,
} from "@evaluation/reporting";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const ownerId = randomUUID();
const otherId = randomUUID();

beforeAll(async () => {
  await database.user.createMany({
    data: [
      { id: ownerId, email: `${ownerId}@example.test`, displayName: "Owner" },
      { id: otherId, email: `${otherId}@example.test`, displayName: "Other" },
    ],
  });
});
afterAll(async () => database.$disconnect());

async function artifact(expiresAt = new Date(Date.now() + 60_000)) {
  let currentlyAuthorized = true;
  const registry = new ProjectionRegistry();
  registry.register({
    reportType: "PROJECT_OPERATIONAL",
    audience: "EMPLOYEE_SELF",
    source: "projects",
    projectionVersion: 1,
    authorizeCurrent: async () => currentlyAuthorized,
    snapshot: async () => ({ snapshotId: randomUUID(), version: 1 }),
    read: async () => ({ title: "Project", lines: ["Current state"] }),
  });
  const storage = new InMemoryReportStorage();
  const generatedAt =
    expiresAt.getTime() <= Date.now() ? new Date(expiresAt.getTime() - 60_000) : new Date();
  const service = new ExportService(
    database,
    registry,
    storage,
    () => generatedAt,
    () => expiresAt,
  );
  const requested = await service.request({
    requesterId: ownerId,
    idempotencyKey: randomUUID(),
    reportType: "PROJECT_OPERATIONAL",
    audience: "EMPLOYEE_SELF",
    format: "HTML",
    locale: "ar",
    cycleId: null,
    timezone: "Asia/Riyadh",
  });
  const generated = await service.materialize(requested.request.id);
  return {
    access: new ArtifactAccessService(database, storage, registry),
    generated,
    revokeSourceAccess: () => {
      currentlyAuthorized = false;
    },
    requestId: requested.request.id,
    exports: new ExportService(database, registry, storage),
  };
}

describe("artifact authorization", () => {
  it("denies another employee and records the denied access", async () => {
    const { access, generated } = await artifact();
    await expect(access.open(otherId, generated.artifactId, randomUUID())).resolves.toEqual({
      allowed: false,
      reason: "DENIED",
    });
    await expect(
      database.exportAccessEvent.count({
        where: { artifactId: generated.artifactId, allowed: false },
      }),
    ).resolves.toBe(1);
  });

  it("denies an expired artifact even to its owner", async () => {
    const { access, generated } = await artifact(new Date(Date.now() - 1_000));
    await expect(access.open(ownerId, generated.artifactId, randomUUID())).resolves.toEqual({
      allowed: false,
      reason: "EXPIRED",
    });
  });

  it("reauthorizes each read and denies a revoked artifact", async () => {
    const { access, generated } = await artifact();
    await access.revoke(ownerId, generated.artifactId, "No longer required");
    await expect(access.open(ownerId, generated.artifactId, randomUUID())).resolves.toEqual({
      allowed: false,
      reason: "REVOKED",
    });
  });

  it("reruns the current report source authorization before signing", async () => {
    const { access, generated, revokeSourceAccess } = await artifact();
    revokeSourceAccess();
    await expect(access.open(ownerId, generated.artifactId, randomUUID())).resolves.toEqual({
      allowed: false,
      reason: "DENIED",
    });
  });

  it("reports effective revoked and expired request states", async () => {
    const revoked = await artifact();
    await revoked.access.revoke(ownerId, revoked.generated.artifactId, "No longer required");
    await expect(revoked.exports.readRequest(ownerId, revoked.requestId)).resolves.toMatchObject({
      state: "REVOKED",
    });
    const expired = await artifact(new Date(Date.now() - 1_000));
    await expect(expired.exports.readRequest(ownerId, expired.requestId)).resolves.toMatchObject({
      state: "EXPIRED",
    });
  });
});
