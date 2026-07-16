import { Module } from "@nestjs/common";

import { createDatabaseClient } from "@evaluation/database";

import { AuthModule } from "../auth/auth.module.js";
import {
  AUDIT_DATABASE,
  AuditController,
  AuditQueryGuard,
  ManagedAuditDatabaseClient,
} from "./audit.controller.js";

function requiredDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (value === undefined || value.length === 0) throw new Error("DATABASE_URL must be configured");
  return value;
}

export class AuditModule {}

Module({
  imports: [AuthModule],
  controllers: [AuditController],
  providers: [
    {
      provide: AUDIT_DATABASE,
      useFactory: () => new ManagedAuditDatabaseClient(createDatabaseClient(requiredDatabaseUrl())),
    },
    AuditQueryGuard,
  ],
})(AuditModule);
