"use client";

import { ProductIcon } from "@evaluation/ui";
import { createElement } from "react";

import styles from "./stable-shell.module.css";

const icons: Readonly<
  Record<import("./shell-model").ShellGlobalEntryId, import("@evaluation/ui").ProductIconName>
> = {
  capture: "plus",
  chat: "sparkles",
  search: "search",
  "what-changed": "check",
};

export function GlobalActions({
  catalog,
  entries,
  onUnavailable,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  entries: readonly import("./shell-model").ShellGlobalEntry[];
  onUnavailable: () => void;
}>) {
  return (
    <div className={styles.globalActions!}>
      {entries
        .filter(({ visible }) => visible)
        .map((entry) => (
          <button
            className={entry.id === "search" ? styles.searchAction! : styles.globalAction!}
            key={entry.id}
            onClick={onUnavailable}
            type="button"
          >
            {createElement(ProductIcon, { name: icons[entry.id] })}
            <span>{catalog[entry.labelKey]}</span>
          </button>
        ))}
    </div>
  );
}
