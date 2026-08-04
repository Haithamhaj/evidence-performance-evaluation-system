"use client";

import type { Health, Priority, WorkItemStatus } from "../domain/types";
import { usePrototype } from "../app/prototype-store";
import { copy, type CatalogKey } from "../i18n/catalog";

type StatusBadgeProperties = {
  readonly kind: "health" | "priority" | "status";
  readonly value: Health | Priority | WorkItemStatus;
};

export function StatusBadge({ kind, value }: StatusBadgeProperties) {
  const { locale } = usePrototype();
  return (
    <span className={`badge badge-${value}`}>{copy(locale, `${kind}.${value}` as CatalogKey)}</span>
  );
}
