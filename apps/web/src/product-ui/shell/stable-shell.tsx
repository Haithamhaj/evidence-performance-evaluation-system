"use client";

import { createElement, useState } from "react";

import { DesktopNavigation } from "./desktop-navigation";
import { GlobalActions } from "./global-actions";
import { MobileNavigation } from "./mobile-navigation";
import * as whatChanged from "./what-changed-dialog";
import { CaptureDialog } from "../capture/capture-dialog";
import { loadCaptureUpdateContext } from "../../platform/capture-update-context-api";
import styles from "./stable-shell.module.css";

export function StableShell({
  authAction,
  catalog,
  children,
  locale,
  localeSwitchHref,
  model,
  experienceStream = false,
}: Readonly<{
  authAction: "login" | "logout";
  catalog: import("@evaluation/localization").Catalog;
  children?: import("react").ReactNode;
  locale: import("@evaluation/localization").Locale;
  localeSwitchHref: string;
  model: import("./shell-model").ShellModel;
  experienceStream?: boolean;
}>) {
  const [notice, setNotice] = useState("");
  const alternateLocale = locale === "ar" ? "en" : "ar";
  const unavailable = () => setNotice(catalog["shell.availableNextSlice"]);
  const canCapture = model.globalEntries.some((entry) => entry.id === "capture" && entry.visible);

  return (
    <div className={styles.shell!}>
      <a className={styles.skipLink!} href="#main-content">
        {catalog["shell.skipToContent"]}
      </a>
      <aside className={styles.sidebar!}>
        <a className={styles.brand!} data-focus-id="brand" href={`/${locale}`}>
          <span aria-hidden="true" className={styles.brandMark!}>
            {catalog["shell.brandMark"]}
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
          entries: model.globalEntries.filter(
            (entry) => entry.id !== "capture" && entry.id !== "what-changed",
          ),
          onUnavailable: unavailable,
        })}
        {createElement(whatChanged.WhatChangedDialog, {
          catalog,
          streamEnabled: experienceStream,
        })}
        {canCapture
          ? createElement(CaptureDialog, {
              catalog,
              loadContext: loadCaptureUpdateContext,
              locale,
              onSaved: () => setNotice(catalog["capture.saved"]),
              save: async (input) => {
                const response = await fetch("/api/daily-work/private-inbox", {
                  body: JSON.stringify({ ...input, projectId: null }),
                  headers: { "content-type": "application/json" },
                  method: "POST",
                });
                if (!response.ok) throw new Error("private capture save failed");
              },
            })
          : null}
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
