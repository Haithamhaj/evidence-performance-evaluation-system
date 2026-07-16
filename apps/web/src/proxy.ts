import { defaultLocale } from "@evaluation/localization";
import { NextResponse } from "next/server";

export function proxy(request: import("next/server").NextRequest) {
  return NextResponse.redirect(new URL(`/${defaultLocale}`, request.url));
}

export const config = {
  matcher: "/",
};
