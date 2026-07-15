export interface ValidatedOidcPrincipal {
  readonly oidcSubject: string;
  readonly email: string;
  readonly issuer: string;
}

export interface AuthenticatedPrincipal {
  readonly userId: string;
  readonly oidcSubject: string;
  readonly email: string;
  readonly roles: readonly string[];
  readonly active: boolean;
}
