import path from "node:path";
import { fileURLToPath } from "node:url";

import { AdminHealthComposition } from "@evaluation/administration";
import { createDatabaseClient } from "@evaluation/database";
import {
  InMemoryEmailAdapter,
  NotificationEventProducer,
  NotificationDeliveryService,
  NotificationIntentService,
  NotificationPreferenceService,
} from "@evaluation/notifications";
import {
  ArtifactAccessService,
  createEvaluationProjectionRegistry,
  ExportService,
  InMemoryReportStorage,
} from "@evaluation/reporting";

import { seedEmployeeEvaluationAcceptance } from "./seed-employee-evaluation-acceptance.js";

const ids = {
  checkInEvent: "e6b-check-in-due-v1",
  reassignmentEvent: "e6b-reassignment-required-v1",
  exportKey: "e6b00000-0000-4000-8000-000000000001",
  revocationCorrelation: "e6b00000-0000-4000-8000-000000000003",
} as const;

export async function seedOperationsAcceptance() {
  const evaluation = await seedEmployeeEvaluationAcceptance();
  if (evaluation.state !== "CLOSED" || evaluation.assignmentId === null) {
    throw new Error(
      "The deterministic employee evaluation must be closed before export acceptance",
    );
  }

  const database = createDatabaseClient(required("DATABASE_URL"));
  try {
    const assignment = await database.evaluationAssignment.findUniqueOrThrow({
      where: { id: evaluation.assignmentId },
      select: { employeeId: true },
    });
    const intents = new NotificationIntentService(database);
    const preferences = new NotificationPreferenceService(database);
    const email = new InMemoryEmailAdapter();
    const delivery = new NotificationDeliveryService(database, preferences, email);
    const now = new Date("2026-08-07T12:00:00.000Z");
    const producer = new NotificationEventProducer(intents, {
      enqueue: async (job) => {
        const attempted = await database.notificationDeliveryAttempt.count({
          where: { intentId: job.intentId },
        });
        if (attempted === 0) {
          await delivery.deliver(job.intentId, job.correlationId);
        }
        return { jobId: job.intentId };
      },
      close: async () => undefined,
    });

    const checkInEvent = {
      type: "CHECK_IN_DUE" as const,
      eventId: ids.checkInEvent,
      eventVersion: 1,
      recipientId: assignment.employeeId,
      obligationId: evaluation.cycleId,
      dueAt: now.toISOString(),
    };
    const previousRetry = await database.notificationDeliveryAttempt.findFirst({
      where: {
        intent: { recipientId: assignment.employeeId, sourceEventId: ids.checkInEvent },
        channel: "EMAIL",
        state: "RETRY_SCHEDULED",
      },
    });
    if (previousRetry === null) {
      email.failNext("TRANSIENT");
    }
    const firstCheckIn = await producer.publish(checkInEvent);
    const duplicateCheckIn = await producer.publish(checkInEvent);
    const emailState =
      previousRetry?.state ??
      (
        await database.notificationDeliveryAttempt.findFirstOrThrow({
          where: { intentId: firstCheckIn.id, channel: "EMAIL" },
          orderBy: { attempt: "desc" },
        })
      ).state;

    const reassignment = await producer.publish({
      type: "REASSIGNMENT_REQUIRED",
      eventId: ids.reassignmentEvent,
      eventVersion: 1,
      recipientId: assignment.employeeId,
      caseId: evaluation.assignmentId,
      occurredAt: now.toISOString(),
    });

    const storage = new InMemoryReportStorage();
    const exports = new ExportService(
      database,
      createEvaluationProjectionRegistry(database),
      storage,
      () => now,
      (generatedAt) => new Date(generatedAt.getTime() + 24 * 60 * 60 * 1_000),
    );
    const requested = await exports.request({
      requesterId: assignment.employeeId,
      idempotencyKey: ids.exportKey,
      reportType: "EMPLOYEE_EVALUATION",
      audience: "EMPLOYEE_SELF",
      format: "PDF",
      locale: "en",
      cycleId: evaluation.cycleId,
      timezone: "Asia/Riyadh",
    });
    const artifact = await exports.materializeFor(assignment.employeeId, requested.request.id);
    const access = new ArtifactAccessService(database, storage, registry, () => now);
    const existingRevocation = await database.exportRevocation.findFirst({
      where: { artifactId: artifact.artifactId },
    });
    if (existingRevocation === null) {
      await access.revoke(
        assignment.employeeId,
        artifact.artifactId,
        "Acceptance fixture verifies immediate artifact revocation.",
      );
    }
    const revoked = await access.open(
      assignment.employeeId,
      artifact.artifactId,
      ids.revocationCorrelation,
    );

    const health = await new AdminHealthComposition(
      [
        {
          dependency: "API",
          check: async () => ({ state: "HEALTHY" as const, nextActionKey: null }),
        },
        {
          dependency: "CONNECTOR",
          check: async () => ({
            state: "DEGRADED" as const,
            nextActionKey: "admin.health.reconnectProvider",
          }),
        },
      ],
      () => now,
    ).read();

    return {
      fixture: "postgresql-domain-services",
      evaluation,
      notifications: {
        checkInIntentId: firstCheckIn.id,
        deduplicated: firstCheckIn.id === duplicateCheckIn.id,
        emailState,
        criticalReassignmentIntentId: reassignment.id,
      },
      report: {
        requestId: requested.request.id,
        manifestId: requested.manifest.id,
        artifactId: artifact.artifactId,
        encrypted: true,
        revoked,
      },
      health: {
        state: health.state,
        connector: health.dependencies.find(({ dependency }) => dependency === "CONNECTOR"),
      },
    } as const;
  } finally {
    await database.$disconnect();
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  process.stdout.write(`${JSON.stringify(await seedOperationsAcceptance())}\n`);
}
