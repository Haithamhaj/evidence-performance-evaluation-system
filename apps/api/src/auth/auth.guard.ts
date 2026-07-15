import { Inject, Injectable } from "@nestjs/common";

import { AppError } from "@evaluation/contracts";

interface AuthenticatedRequest {
  readonly headers: { readonly authorization?: string | undefined };
  principal?: import("@evaluation/auth").AuthenticatedPrincipal;
}

export const AUTH_VALIDATION_CONFIG = Symbol("AUTH_VALIDATION_CONFIG");
export const AUTH_DATABASE = Symbol("AUTH_DATABASE");
export const AUTH_TOKEN_VALIDATOR = Symbol("AUTH_TOKEN_VALIDATOR");
export const AUTH_USER_SYNCHRONIZER = Symbol("AUTH_USER_SYNCHRONIZER");

export type TokenValidator = (
  token: string,
  config: import("@evaluation/auth").AccessTokenValidationConfig,
) => Promise<import("@evaluation/auth").ValidatedOidcPrincipal>;
export type UserSynchronizer = (
  client: import("@evaluation/auth").UserSyncClient,
  principal: import("@evaluation/auth").ValidatedOidcPrincipal,
) => Promise<import("@evaluation/auth").AuthenticatedPrincipal>;

export class AuthGuard {
  private readonly validationConfig: import("@evaluation/auth").AccessTokenValidationConfig;
  private readonly database: import("@evaluation/auth").UserSyncClient;
  private readonly tokenValidator: TokenValidator;
  private readonly userSynchronizer: UserSynchronizer;

  constructor(
    validationConfig: import("@evaluation/auth").AccessTokenValidationConfig,
    database: import("@evaluation/auth").UserSyncClient,
    tokenValidator: TokenValidator,
    userSynchronizer: UserSynchronizer,
  ) {
    this.validationConfig = validationConfig;
    this.database = database;
    this.tokenValidator = tokenValidator;
    this.userSynchronizer = userSynchronizer;
  }

  async canActivate(context: import("@nestjs/common").ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const match = /^Bearer ([^\s]+)$/u.exec(authorization ?? "");
    if (match?.[1] === undefined) {
      throw new AppError("AUTH_REQUIRED", "errors.auth.required", 401);
    }

    const externalPrincipal = await this.tokenValidator(match[1], this.validationConfig);
    request.principal = await this.userSynchronizer(this.database, externalPrincipal);
    return true;
  }
}

Injectable()(AuthGuard);
Inject(AUTH_VALIDATION_CONFIG)(AuthGuard, undefined, 0);
Inject(AUTH_DATABASE)(AuthGuard, undefined, 1);
Inject(AUTH_TOKEN_VALIDATOR)(AuthGuard, undefined, 2);
Inject(AUTH_USER_SYNCHRONIZER)(AuthGuard, undefined, 3);
