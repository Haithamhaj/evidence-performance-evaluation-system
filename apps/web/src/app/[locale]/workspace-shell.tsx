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
        <a className="brandLink" data-focus-id="brand" href={`/${locale}`}>
          {catalog["shell.title"]}
        </a>
        <nav className="appNavigation" aria-label={catalog["nav.home"]}>
          <a data-focus-id="home" href={`/${locale}`}>
            {catalog["nav.home"]}
          </a>
          <a data-focus-id="projects" href={`/${locale}/projects`}>
            {catalog["nav.projects"]}
          </a>
          <a data-focus-id="locale" href={localeSwitchHref} hrefLang={alternateLocale}>
            {catalog[`locale.switchTo${alternateLocale === "ar" ? "Arabic" : "English"}`]}
          </a>
          <a data-focus-id={authAction} href={`/api/auth/${authAction}`}>
            {catalog[`actions.${authAction}`]}
          </a>
        </nav>
      </header>
      <main className="appMain" id="main-content">
        {children}
      </main>
    </div>
  );
}
