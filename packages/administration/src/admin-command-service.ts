import { randomUUID } from "node:crypto";

import { AdminCommandSchema, AppError } from "@evaluation/contracts";

const REASON_REQUIRED = new Set<import("@evaluation/contracts").AdminCommand["capability"]>([
  "TECHNICAL_ROLES_MANAGE",
  "INTEGRATIONS_MANAGE",
  "AI_ROUTES_MANAGE",
  "RETENTION_POLICIES_MANAGE",
]);

export type AdminMutationReceiptView = Readonly<{
  id: string;
  capability: string;
  ownerDomain: string;
  ownerReceiptId: string;
  expectedVersion: number;
  createdAt: Date;
}>;

export class AdminCommandService {
  private readonly database: import("@evaluation/database").DatabaseClient;
  private readonly authorization: import("./ports.js").AdminAuthorizationPort;
  private readonly owners: import("./ports.js").OwnerCommandRegistry;

  constructor(
    database: import("@evaluation/database").DatabaseClient,
    authorization: import("./ports.js").AdminAuthorizationPort,
    owners: import("./ports.js").OwnerCommandRegistry,
  ) {
    this.database = database;
    this.authorization = authorization;
    this.owners = owners;
  }

  async execute(input: unknown): Promise<AdminMutationReceiptView> {
    const command = AdminCommandSchema.parse(input);
    if (!(await this.authorization.isSystemAdministrator(command.actorId))) {
      throw denied();
    }
    if (REASON_REQUIRED.has(command.capability) && !command.reason) {
      throw new AppError("ADMIN_REASON_REQUIRED", "errors.administration.reasonRequired", 400);
    }
    const existing = await this.database.adminMutationReceipt.findUnique({
      where: { idempotencyKey: command.idempotencyKey },
    });
    if (existing) return existing;
    const owner = this.owners[command.capability];
    if (!owner) {
      throw new AppError("ADMIN_CAPABILITY_UNAVAILABLE", "errors.administration.unavailable", 409);
    }
    const ownerReceipt = await owner.execute(command);
    if (!ownerReceipt.auditEventId) {
      throw new AppError(
        "ADMIN_OWNER_AUDIT_REQUIRED",
        "errors.administration.ownerAuditRequired",
        500,
      );
    }
    return this.database.adminMutationReceipt.create({
      data: {
        id: randomUUID(),
        idempotencyKey: command.idempotencyKey,
        actorId: command.actorId,
        capability: command.capability,
        ownerDomain: ownerReceipt.ownerDomain,
        ownerReceiptId: ownerReceipt.ownerReceiptId,
        expectedVersion: command.expectedVersion,
        reason: command.reason,
      },
    });
  }

  async evaluateEmployee(): Promise<never> {
    throw denied();
  }

  async reassignProject(): Promise<never> {
    throw denied();
  }
}

function denied() {
  return new AppError("AUTHZ_ACTION", "errors.authorization.denied", 403);
}
