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

export function DesktopNavigation({
  catalog,
  items,
  onUnavailable,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  items: readonly import("./shell-model").ShellNavigationItem[];
  onUnavailable: () => void;
}>) {
  return (
    <nav aria-label={catalog["shell.brand"]} className={styles.desktopNavigation!}>
      {items.map((item) =>
        item.availability === "current" && item.href ? (
          <a className={styles.navigationItem!} href={item.href} key={item.id}>
            {createElement(ProductIcon, { name: icons[item.id] })}
            <span>{catalog[item.labelKey]}</span>
          </a>
        ) : (
          <button
            className={styles.navigationItem!}
            key={item.id}
            onClick={onUnavailable}
            type="button"
          >
            {createElement(ProductIcon, { name: icons[item.id] })}
            <span>{catalog[item.labelKey]}</span>
          </button>
        ),
      )}
    </nav>
  );
}
