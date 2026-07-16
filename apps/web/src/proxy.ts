import { defaultLocale, isLocale } from "@evaluation/localization";
import { NextResponse } from "next/server";

export function proxy(request: import("next/server").NextRequest) {
  const url = new URL(request.url);
  if (url.pathname === "/") {
    return NextResponse.redirect(new URL(`/${defaultLocale}`, request.url));
  }

  const locale = url.pathname.split("/")[1];
  if (locale !== undefined && locale.length > 0 && !isLocale(locale)) {
    url.pathname = `/${defaultLocale}/__unsupported-locale`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/((?!api|_next|fonts|favicon.ico).*)"],
};
