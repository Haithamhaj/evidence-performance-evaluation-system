import { NextResponse } from "next/server";

import {
  authCookieOptions,
  OIDC_TRANSACTION_COOKIE,
  oidcSettings,
  safeAuthError,
  startOidcLogin,
} from "../../../../auth/oidc";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const settings = oidcSettings();
    const canonicalLoginUrl = new URL("/api/auth/login", settings.redirectUri);
    const presentedHost = (
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      ""
    )
      .split(",", 1)[0]
      ?.trim()
      .toLowerCase();
    const requestUsesCanonicalOrigin =
      presentedHost === undefined || presentedHost.length === 0
        ? new URL(request.url).origin === canonicalLoginUrl.origin
        : presentedHost === canonicalLoginUrl.host.toLowerCase();
    if (!requestUsesCanonicalOrigin) {
      return NextResponse.redirect(canonicalLoginUrl);
    }
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
