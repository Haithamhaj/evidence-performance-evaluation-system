import type { Catalog, Locale } from "@evaluation/localization";
import type { ReactNode } from "react";

type WorkspaceShellProperties = {
  readonly authAction?: "login" | "logout";
  readonly catalog: Catalog;
  readonly children?: ReactNode;
  readonly locale: Locale;
  readonly localeSwitchHref: string;
};

export function WorkspaceShell({
  authAction = "logout",
  catalog,
  children,
  locale,
  localeSwitchHref,
}: WorkspaceShellProperties) {
  const alternateLocale = locale === "ar" ? "en" : "ar";

  return (
    <div className="appShell">
      <header className="appHeader">
        <a className="brandLink" href={`/${locale}`}>
          {catalog["shell.title"]}
        </a>
        <nav className="appNavigation" aria-label={catalog["nav.home"]}>
          <a href={`/${locale}`}>{catalog["nav.home"]}</a>
          <a href={`/${locale}/projects`}>{catalog["nav.projects"]}</a>
          <a href={localeSwitchHref} hrefLang={alternateLocale}>
            {catalog[`locale.switchTo${alternateLocale === "ar" ? "Arabic" : "English"}`]}
          </a>
          <a href={`/api/auth/${authAction}`}>{catalog[`actions.${authAction}`]}</a>
        </nav>
      </header>
      <main className="appMain" id="main-content">
        {children}
      </main>
    </div>
  );
}
