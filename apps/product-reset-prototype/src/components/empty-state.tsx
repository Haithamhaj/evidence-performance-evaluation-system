"use client";

import { usePrototype } from "../app/prototype-store";
import { copy } from "../i18n/catalog";

export function EmptyState() {
  const { locale } = usePrototype();
  return <p className="emptyState">{copy(locale, "empty.noItems")}</p>;
}
