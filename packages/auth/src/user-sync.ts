import { AppError } from "@evaluation/contracts";

interface InternalUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly active: boolean;
}

interface UserSyncTransaction {
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

export async function syncOidcUser(
  client: UserSyncClient,
  principal: import("./principal.js").ValidatedOidcPrincipal,
  displayName: string = principal.email,
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

    return {
      userId: user.id,
      oidcSubject: principal.oidcSubject,
      email: user.email,
      roles: [],
      active: true,
    };
  });
}
