import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  authCookieOptions,
  endSessionUrl,
  OIDC_SESSION_COOKIE,
  OIDC_TRANSACTION_COOKIE,
  oidcSettings,
  safeAuthError,
} from "../../../../auth/oidc";

export async function GET(): Promise<NextResponse> {
  let settings: ReturnType<typeof oidcSettings>;
  try {
    settings = oidcSettings();
  } catch (error) {
    const failure = safeAuthError(error);
    return NextResponse.json(failure.body, { status: failure.status });
  }

  const cookieStore = await cookies();
  let redirect = new URL(settings.postLogoutRedirectUri);
  try {
    redirect = await endSessionUrl(settings, cookieStore.get(OIDC_SESSION_COOKIE)?.value);
  } catch {
    // Local logout must still succeed if the provider session is unavailable or invalid.
  }
  const response = NextResponse.redirect(redirect);
  const expired = { ...authCookieOptions(settings.environment, 0), expires: new Date(0) };
  response.cookies.set(OIDC_SESSION_COOKIE, "", expired);
  response.cookies.set(OIDC_TRANSACTION_COOKIE, "", expired);
  return response;
}
