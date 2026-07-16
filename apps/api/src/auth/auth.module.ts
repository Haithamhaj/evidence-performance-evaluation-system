import { Module } from "@nestjs/common";

import {
  remoteAccessTokenValidationConfig,
  syncOidcUser,
  validateAccessToken,
} from "@evaluation/auth";
import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";

import { ManagedAuthDatabaseClient } from "./auth-database.js";
import {
  AUTH_DATABASE,
  AUTH_TOKEN_VALIDATOR,
  AUTH_USER_SYNCHRONIZER,
  AUTH_VALIDATION_CONFIG,
  AuthGuard,
} from "./auth.guard.js";
import { MeController } from "./me.controller.js";

function requiredEnvironment(name: "DATABASE_URL" | "OIDC_AUDIENCE" | "OIDC_ISSUER"): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} must be configured`);
  }
  return value;
}

export class AuthModule {}

Module({
  controllers: [MeController],
  providers: [
    {
      provide: AUTH_DATABASE,
      useFactory: () =>
        new ManagedAuthDatabaseClient(
          createDatabaseClient(
            requiredEnvironment("DATABASE_URL"),
          ) as unknown as ConstructorParameters<typeof ManagedAuthDatabaseClient>[0],
        ),
    },
    {
      provide: AUTH_VALIDATION_CONFIG,
      useFactory: () =>
        remoteAccessTokenValidationConfig(
          requiredEnvironment("OIDC_ISSUER"),
          requiredEnvironment("OIDC_AUDIENCE"),
        ),
    },
    { provide: AUTH_TOKEN_VALIDATOR, useValue: validateAccessToken },
    {
      provide: AUTH_USER_SYNCHRONIZER,
      useValue: (
        client: import("@evaluation/auth").UserSyncClient,
        principal: import("@evaluation/auth").ValidatedOidcPrincipal,
      ) => syncOidcUser(client, principal, databaseAuditWriter),
    },
    AuthGuard,
  ],
  exports: [AuthGuard],
})(AuthModule);
