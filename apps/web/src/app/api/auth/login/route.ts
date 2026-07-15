import { NextResponse } from "next/server";

import {
  authCookieOptions,
  OIDC_TRANSACTION_COOKIE,
  oidcSettings,
  safeAuthError,
  startOidcLogin,
} from "../../../../auth/oidc";

export async function GET(): Promise<NextResponse> {
  try {
    const settings = oidcSettings();
    const login = await startOidcLogin(settings);
    const response = NextResponse.redirect(login.authorizationUrl);
    response.cookies.set(
      OIDC_TRANSACTION_COOKIE,
      login.transactionCookie,
      authCookieOptions(settings.environment, 300),
    );
    return response;
  } catch (error) {
    const failure = safeAuthError(error);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
