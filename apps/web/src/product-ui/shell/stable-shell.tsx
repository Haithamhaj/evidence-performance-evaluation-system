"use client";

import { createElement, useState } from "react";

import { DesktopNavigation } from "./desktop-navigation";
import { GlobalActions } from "./global-actions";
import { MobileNavigation } from "./mobile-navigation";
import styles from "./stable-shell.module.css";

export function StableShell({
  authAction,
  catalog,
  children,
  locale,
  localeSwitchHref,
  model,
}: Readonly<{
  authAction: "login" | "logout";
  catalog: import("@evaluation/localization").Catalog;
  children?: import("react").ReactNode;
  locale: import("@evaluation/localization").Locale;
  localeSwitchHref: string;
  model: import("./shell-model").ShellModel;
}>) {
  const [notice, setNotice] = useState("");
  const alternateLocale = locale === "ar" ? "en" : "ar";
  const unavailable = () => setNotice(catalog["shell.availableNextSlice"]);

  return (
    <div className={styles.shell!}>
      <a className={styles.skipLink!} href="#main-content">
        {catalog["shell.skipToContent"]}
      </a>
      <aside className={styles.sidebar!}>
        <a className={styles.brand!} data-focus-id="brand" href={`/${locale}`}>
          <span aria-hidden="true" className={styles.brandMark!}>
            CB
          </span>
          <span>{catalog["shell.brand"]}</span>
        </a>
        {createElement(DesktopNavigation, {
          catalog,
          items: model.navigation,
          onUnavailable: unavailable,
        })}
      </aside>
      <header className={styles.header!}>
        {createElement(GlobalActions, {
          catalog,
          entries: model.globalEntries,
          onUnavailable: unavailable,
        })}
        <div className={styles.accountActions!}>
          <a href={localeSwitchHref} hrefLang={alternateLocale}>
            {catalog[`locale.switchTo${alternateLocale === "ar" ? "Arabic" : "English"}`]}
          </a>
          <a href={`/api/auth/${authAction}`}>{catalog[`actions.${authAction}`]}</a>
        </div>
        <p aria-live="polite" className={styles.notice!} role="status">
          {notice}
        </p>
      </header>
      <main className={`appMain ${styles.content!}`} id="main-content">
        {children}
      </main>
      {createElement(MobileNavigation, {
        catalog,
        onUnavailable: unavailable,
        overflow: model.mobileOverflow,
        primary: model.mobilePrimary,
      })}
    </div>
  );
}
