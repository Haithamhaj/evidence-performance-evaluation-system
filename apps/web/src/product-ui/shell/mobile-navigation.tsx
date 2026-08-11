"use client";

import { ProductIcon } from "@evaluation/ui";
import { createElement } from "react";

import styles from "./stable-shell.module.css";

const icons: Readonly<
  Record<import("./shell-model").ShellNavigationId, import("@evaluation/ui").ProductIconName>
> = {
  administration: "settings",
  evaluation: "chart",
  health: "check",
  help: "help",
  "manager-operations": "briefcase",
  projects: "folder",
  research: "research",
  settings: "settings",
  today: "calendar",
  work: "check",
};

export function MobileNavigation({
  catalog,
  overflow,
  primary,
  onUnavailable,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  onUnavailable: () => void;
  overflow: readonly import("./shell-model").ShellNavigationItem[];
  primary: readonly import("./shell-model").ShellNavigationItem[];
}>) {
  const visible = primary.slice(0, 4);
  const more = [...primary.slice(4), ...overflow];
  return (
    <nav aria-label={catalog["shell.brand"]} className={styles.mobileNavigation!}>
      {visible.map((item) =>
        item.availability === "current" && item.href ? (
          <a className={styles.mobileItem!} href={item.href} key={item.id}>
            {createElement(ProductIcon, { name: icons[item.id] })}
            <span>{catalog[item.labelKey]}</span>
          </a>
        ) : (
          <button
            className={styles.mobileItem!}
            key={item.id}
            onClick={onUnavailable}
            type="button"
          >
            {createElement(ProductIcon, { name: icons[item.id] })}
            <span>{catalog[item.labelKey]}</span>
          </button>
        ),
      )}
      <details className={styles.mobileMore!}>
        <summary
          aria-label={catalog["shell.nav.more"]}
          className={styles.mobileItem!}
          role="button"
        >
          {createElement(ProductIcon, { name: "chevron-down" })}
          <span>{catalog["shell.nav.more"]}</span>
        </summary>
        <div className={styles.mobileOverflow!}>
          {more.map((item) =>
            item.availability === "current" && item.href ? (
              <a href={item.href} key={item.id}>
                {catalog[item.labelKey]}
              </a>
            ) : (
              <button key={item.id} onClick={onUnavailable} type="button">
                {catalog[item.labelKey]}
              </button>
            ),
          )}
        </div>
      </details>
    </nav>
  );
}
