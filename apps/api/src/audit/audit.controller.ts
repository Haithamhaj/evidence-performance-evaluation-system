import { Controller, Get, Inject, Injectable, Query, UseGuards } from "@nestjs/common";

import { queryAuditEvents } from "@evaluation/audit";
import { AppError } from "@evaluation/contracts";
import { decide } from "@evaluation/permissions";

import { AuthGuard } from "../auth/auth.guard.js";

export const AUDIT_DATABASE = Symbol("AUDIT_DATABASE");

type DatabaseClient = ReturnType<typeof import("@evaluation/database").createDatabaseClient>;

export class ManagedAuditDatabaseClient {
  readonly auditEvent: DatabaseClient["auditEvent"];
  readonly authorizationScope: DatabaseClient["authorizationScope"];
  readonly roleAssignment: DatabaseClient["roleAssignment"];
  private readonly client: DatabaseClient;

  constructor(client: DatabaseClient) {
    this.client = client;
    this.auditEvent = client.auditEvent;
    this.authorizationScope = client.authorizationScope;
    this.roleAssignment = client.roleAssignment;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}

type AuditRequest = Readonly<{
  principal?: import("@evaluation/auth").AuthenticatedPrincipal;
}>;

export class AuditQueryGuard {
  private readonly authGuard: AuthGuard;
  private readonly database: ManagedAuditDatabaseClient;

  constructor(authGuard: AuthGuard, database: ManagedAuditDatabaseClient) {
    this.authGuard = authGuard;
    this.database = database;
  }

  async canActivate(context: import("@nestjs/common").ExecutionContext): Promise<boolean> {
    await this.authGuard.canActivate(context);
    const principal = context.switchToHttp().getRequest<AuditRequest>().principal;
    if (principal === undefined) {
      throw new AppError("AUTHZ_UNAUTHENTICATED", "errors.authorization.denied", 401);
    }
    const systemScope = await this.database.authorizationScope.findUnique({
      where: { key: "system" },
      select: { id: true },
    });
    if (systemScope === null) {
      throw new AppError("AUTHZ_RESOURCE_STATE", "errors.authorization.denied", 403);
    }
    const assignments = await this.database.roleAssignment.findMany({
      where: { userId: principal.userId },
      select: { role: true, scopeType: true, scopeId: true },
    });
    const decision = decide(
      {
        subjectId: principal.userId,
        active: principal.active,
        roles: assignments,
      },
      "audit.query",
      { kind: "system", systemId: systemScope.id },
      { now: new Date().toISOString() },
    );
    if (!decision.allowed) {
      throw new AppError(
        `AUTHZ_${decision.reasonCode}`,
        "errors.authorization.denied",
        decision.reasonCode === "UNAUTHENTICATED" ? 401 : 403,
      );
    }
    return true;
  }
}

Injectable()(AuditQueryGuard);
Inject(AuthGuard)(AuditQueryGuard, undefined, 0);
Inject(AUDIT_DATABASE)(AuditQueryGuard, undefined, 1);

function auditQueryInput(query: Record<string, unknown>): Record<string, unknown> {
  const parsed: Record<string, unknown> = { ...query };
  if (typeof parsed.limit === "string" && /^\d+$/u.test(parsed.limit)) {
    parsed.limit = Number(parsed.limit);
  }
  return parsed;
}

export class AuditController {
  private readonly database: ManagedAuditDatabaseClient;

  constructor(database: ManagedAuditDatabaseClient) {
    this.database = database;
  }

  async query(query: Record<string, unknown>) {
    try {
      return await queryAuditEvents(this.database, auditQueryInput(query));
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Error && error.name === "ZodError") {
        throw new AppError("AUDIT_QUERY_INVALID", "errors.audit.queryInvalid", 400);
      }
      throw error;
    }
  }
}

const queryDescriptor = Object.getOwnPropertyDescriptor(AuditController.prototype, "query");
if (queryDescriptor === undefined) throw new Error("Audit query handler descriptor is missing");
Controller("audit")(AuditController);
Query()(AuditController.prototype, "query", 0);
Get()(AuditController.prototype, "query", queryDescriptor);
UseGuards(AuditQueryGuard)(AuditController.prototype, "query", queryDescriptor);
Inject(AUDIT_DATABASE)(AuditController, undefined, 0);
