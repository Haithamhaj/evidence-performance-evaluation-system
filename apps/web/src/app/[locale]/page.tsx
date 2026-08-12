import { isLocale } from "@evaluation/localization";
import { notFound, redirect } from "next/navigation";

import { homeHrefForPrincipal } from "../../product-ui/shell/shell-model";
import { loadShellContext } from "../../server/shell/load-shell-context";

interface HomePageProperties {
  readonly params: Promise<{ readonly locale: string }>;
}

export default async function HomePage({ params }: HomePageProperties) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const { principal } = await loadShellContext();
  redirect(homeHrefForPrincipal(locale, principal));
}
