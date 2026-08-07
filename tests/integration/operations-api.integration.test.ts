import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@evaluation/database";
import { NotificationIntentService, NotificationPreferenceService } from "@evaluation/notifications";
import {
  ArtifactAccessService,
  ExportService,
  InMemoryReportStorage,
  ProjectionRegistry,
} from "@evaluation/reporting";

import { AdministrationController } from "../../apps/api/src/operations/administration.controller.js";
import { ExportsController } from "../../apps/api/src/operations/exports.controller.js";
import { NotificationsController } from "../../apps/api/src/operations/notifications.controller.js";
import { OperationsPolicyGuard } from "../../apps/api/src/operations/operations-policy.guard.js";
import { OperationsTargetAuthorizer } from "../../apps/api/src/operations/target-authorizer.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const employeeId = randomUUID();
const otherEmployeeId = randomUUID();
const managerId = randomUUID();

beforeAll(async () => {
  await database.user.createMany({
    data: [employeeId, otherEmployeeId, managerId].map((id) => ({
      id,
      email: `${id}@example.test`,
      displayName: id,
    })),
  });
});
afterAll(async () => database.$disconnect());

function request(userId: string) {
  return {
    headers: {},
    params: {},
    principal: { userId, oidcSubject: userId, email: `${userId}@example.test`, roles: [], active: true },
  };
}

describe("operations API authorization", () => {
  it("returns only the authenticated recipient's inbox", async () => {
    const intents = new NotificationIntentService(database);
    await intents.create({
      recipientId: employeeId,
      category: "CHECK_IN_DUE",
      urgency: "ACTION_REQUIRED",
      template: { version: 1, key: "check_in_due", arguments: {} },
      action: { kind: "CHECK_IN", resourceId: randomUUID() },
      source: { eventId: randomUUID(), eventVersion: 1 },
      dedupeKey: randomUUID(),
      channels: ["IN_APP"],
      deliverAfter: new Date(),
    });
    const controller = new NotificationsController(
      intents,
      new NotificationPreferenceService(database),
      new OperationsTargetAuthorizer(database),
    );
    await expect(controller.inbox(request(otherEmployeeId))).resolves.toEqual([]);
  });

  it("denies an export artifact to another employee", async () => {
    const registry = new ProjectionRegistry();
    registry.register({
      reportType: "PROJECT_OPERATIONAL",
      audience: "EMPLOYEE_SELF",
      source: "projects",
      projectionVersion: 1,
      snapshot: async () => ({ snapshotId: randomUUID(), version: 1 }),
      read: async () => ({ title: "Project", lines: ["Current state"] }),
    });
    const storage = new InMemoryReportStorage();
    const exports = new ExportService(database, registry, storage);
    const requested = await exports.request({
      requesterId: employeeId,
      idempotencyKey: randomUUID(),
      reportType: "PROJECT_OPERATIONAL",
      audience: "EMPLOYEE_SELF",
      format: "HTML",
      locale: "en",
      cycleId: null,
      timezone: "Asia/Riyadh",
    });
    const artifact = await exports.generate(requested.request.id);
    const controller = new ExportsController(exports, new ArtifactAccessService(database, storage));
    await expect(controller.download(request(otherEmployeeId), artifact.artifactId)).resolves.toEqual({
      allowed: false,
      reason: "DENIED",
    });
  });

  it("denies System Administrator health routes to a manager", async () => {
    const httpRequest = request(managerId);
    const guard = new OperationsPolicyGuard(
      { canActivate: async () => true } as never,
      database,
    );
    const context = {
      switchToHttp: () => ({ getRequest: () => httpRequest }),
      getClass: () => AdministrationController,
    } as never;
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403 });
  });
});
