import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  authCookieOptions,
  finishOidcLogin,
  OIDC_SESSION_COOKIE,
  OIDC_TRANSACTION_COOKIE,
  oidcSettings,
  safeAuthError,
} from "../../../../auth/oidc";

export async function GET(request: Request): Promise<NextResponse> {
  let response: NextResponse;
  let environment = process.env.APP_ENV ?? "production";
  try {
    const settings = oidcSettings();
    environment = settings.environment;
    const cookieStore = await cookies();
    const transaction = cookieStore.get(OIDC_TRANSACTION_COOKIE)?.value ?? "";
    const session = await finishOidcLogin(settings, new URL(request.url), transaction);
    response = NextResponse.redirect(settings.postLogoutRedirectUri);
    response.cookies.set(
      OIDC_SESSION_COOKIE,
      session,
      authCookieOptions(settings.environment, 300),
    );
  } catch (error) {
    const failure = safeAuthError(error);
    response = NextResponse.json(failure.body, { status: failure.status });
  }
  response.cookies.set(OIDC_TRANSACTION_COOKIE, "", {
    ...authCookieOptions(environment, 0),
    expires: new Date(0),
  });
  return response;
}
