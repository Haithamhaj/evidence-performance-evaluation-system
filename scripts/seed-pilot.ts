import path from "node:path";
import { fileURLToPath } from "node:url";

import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient, seedPilot } from "@evaluation/database";

type SeedTransaction = Parameters<typeof seedPilot>[0];
type SeedClient = Pick<ReturnType<typeof createDatabaseClient>, "$transaction">;
type AuditWriter<T> = import("@evaluation/contracts").AuditWriter<T>;

export async function seedPilotWithAudit(
  client: SeedClient,
  subjects: import("@evaluation/database").PilotSubjects,
  writer: AuditWriter<SeedTransaction> = databaseAuditWriter,
) {
  return client.$transaction(async (transaction) => {
    const roleChanges = await seedPilot(transaction, subjects);
    const correlationId = crypto.randomUUID();
    const auditEvents = [];
    for (const change of roleChanges) {
      auditEvents.push(
        await writer.append(transaction, {
          eventType: "role.assignment.changed",
          actor: { kind: "service", id: "bootstrap" },
          effectiveSubjectId: change.userId,
          scopeType: change.scopeType,
          scopeId: change.scopeId,
          targetType: "role_assignment",
          targetId: change.assignmentId,
          correlationId,
          source: "seed",
          safeDiff: { change: change.change, role: change.role, scopeType: change.scopeType },
        }),
      );
    }
    return { roleChanges, auditEventIds: auditEvents.map(({ id }) => id) };
  });
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`);
  return value;
}

async function main(): Promise<void> {
  const client = createDatabaseClient(requiredEnvironment("DATABASE_URL"));
  try {
    await seedPilotWithAudit(client, {
      managerSubject: requiredEnvironment("PILOT_MANAGER_OIDC_SUBJECT"),
      adminSubject: requiredEnvironment("PILOT_ADMIN_OIDC_SUBJECT"),
      oidcIssuer: requiredEnvironment("OIDC_ISSUER"),
    });
  } finally {
    await client.$disconnect();
  }
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  await main();
}
