import { AppError } from "@evaluation/contracts";

interface InternalUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly active: boolean;
}

interface UserSyncTransaction {
  readonly auditEvent: {
    create(args: unknown): Promise<{ createdAt: Date; id: string }>;
  };
  readonly authorizationScope: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
  };
  readonly oidcIdentity: {
    findUnique(args: unknown): Promise<{ user: InternalUser } | null>;
    create(args: unknown): Promise<unknown>;
  };
  readonly user: {
    findUnique(args: unknown): Promise<InternalUser | null>;
    update(args: unknown): Promise<InternalUser>;
    create(args: unknown): Promise<InternalUser>;
  };
}

export interface UserSyncClient {
  $transaction<T>(operation: (transaction: UserSyncTransaction) => Promise<T>): Promise<T>;
}

function inactiveUser(): never {
  throw new AppError("AUTH_USER_INACTIVE", "errors.auth.userInactive", 403);
}

function isRetryableSyncConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const code = (error as { readonly code?: unknown }).code;
  return code === "P2002" || code === "P2034";
}

async function synchronizeOnce(
  client: UserSyncClient,
  principal: import("./principal.js").ValidatedOidcPrincipal,
  auditWriter: import("@evaluation/contracts").AuditWriter<UserSyncTransaction>,
  displayName: string,
): Promise<import("./principal.js").AuthenticatedPrincipal> {
  return client.$transaction(async (transaction) => {
    const identity = await transaction.oidcIdentity.findUnique({
      where: { issuer_subject: { issuer: principal.issuer, subject: principal.oidcSubject } },
      include: { user: true },
    });

    let user: InternalUser;
    if (identity !== null) {
      if (!identity.user.active) inactiveUser();
      user = await transaction.user.update({
        where: { id: identity.user.id },
        data: { displayName, email: principal.email },
      });
    } else {
      const emailUser = await transaction.user.findUnique({ where: { email: principal.email } });
      if (emailUser === null) {
        user = await transaction.user.create({
          data: {
            email: principal.email,
            displayName,
            identities: {
              create: { issuer: principal.issuer, subject: principal.oidcSubject },
            },
          },
        });
      } else {
        if (!emailUser.active) inactiveUser();
        await transaction.oidcIdentity.create({
          data: {
            issuer: principal.issuer,
            subject: principal.oidcSubject,
            userId: emailUser.id,
          },
        });
        user = await transaction.user.update({
          where: { id: emailUser.id },
          data: { displayName, email: principal.email },
        });
      }
    }

    if (!user.active) inactiveUser();

    const systemScope = await transaction.authorizationScope.findUnique({
      where: { key: "system" },
    });
    if (systemScope === null) throw new Error("Canonical system authorization scope is missing");
    await auditWriter.append(transaction, {
      eventType: "identity.synchronized",
      actor: { kind: "human", id: user.id },
      effectiveSubjectId: user.id,
      scopeType: "system",
      scopeId: systemScope.id,
      targetType: "user",
      targetId: user.id,
      correlationId: crypto.randomUUID(),
      source: "api",
      safeDiff: { fields: ["displayName", "email"] },
    });

    return {
      userId: user.id,
      oidcSubject: principal.oidcSubject,
      email: user.email,
      roles: [],
      active: true,
    };
  });
}

export async function syncOidcUser(
  client: UserSyncClient,
  principal: import("./principal.js").ValidatedOidcPrincipal,
  auditWriter: import("@evaluation/contracts").AuditWriter<UserSyncTransaction>,
  displayName: string = principal.email,
): Promise<import("./principal.js").AuthenticatedPrincipal> {
  const maximumAttempts = 3;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      return await synchronizeOnce(client, principal, auditWriter, displayName);
    } catch (error) {
      if (!isRetryableSyncConflict(error) || attempt === maximumAttempts) throw error;
    }
  }
  throw new Error("OIDC synchronization retry loop exhausted unexpectedly");
}
