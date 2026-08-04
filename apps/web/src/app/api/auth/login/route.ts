import { NextResponse } from "next/server";

import {
  authCookieOptions,
  oidcTransactionCookieName,
  oidcSettings,
  safeAuthError,
  safeOidcReturnPath,
  startOidcLogin,
} from "../../../../auth/oidc";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const settings = oidcSettings();
    const canonicalLoginUrl = new URL("/api/auth/login", settings.redirectUri);
    const requestedReturnTo = new URL(request.url).searchParams.get("returnTo") ?? undefined;
    const returnTo = safeOidcReturnPath(settings, requestedReturnTo);
    const fallbackReturnTo = safeOidcReturnPath(settings);
    if (requestedReturnTo !== undefined && returnTo !== fallbackReturnTo) {
      canonicalLoginUrl.searchParams.set("returnTo", returnTo);
    }
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
    const login = await startOidcLogin(settings, returnTo);
    const transactionCookieName = oidcTransactionCookieName(login.state);
    if (transactionCookieName === undefined) throw new Error("generated OIDC state is invalid");
    const response = NextResponse.redirect(login.authorizationUrl);
    response.cookies.set(
      transactionCookieName,
      login.transactionCookie,
      authCookieOptions(settings.environment, 300),
    );
    return response;
  } catch (error) {
    const failure = safeAuthError(error);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
