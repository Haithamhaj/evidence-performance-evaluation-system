"use client";

import { useState } from "react";

import { AppShell } from "../components/app-shell";
import type { Locale } from "../domain/types";
import { copy, type CatalogKey } from "../i18n/catalog";
import { PrototypeProvider, usePrototype } from "./prototype-store";

type PrototypeAppProperties = {
  readonly initialLocale: Locale;
  readonly initialPath: string;
};

const screenKeys: Record<string, CatalogKey> = {
  "": "screens.myWork.title",
  inbox: "screens.inbox.title",
  projects: "screens.projects.title",
  evidence: "screens.evidence.title",
  readiness: "screens.readiness.title",
  manager: "screens.manager.title",
};

function PrototypeContent() {
  const { locale, path } = usePrototype();
  const [notice, setNotice] = useState<string | null>(null);
  const section = path.split("/")[0] ?? "";
  const titleKey = screenKeys[section] ?? "screens.myWork.title";
  const subtitleKey = titleKey.replace(".title", ".subtitle") as CatalogKey;

  const showSimulationNotice = (kind: "add" | "update") => {
    setNotice(
      locale === "ar"
        ? kind === "add"
          ? "ستفتح الإضافة السريعة هنا ضمن التدفق الكامل."
          : "سيفتح تحديث النص أو الصوت هنا ضمن التدفق الكامل."
        : kind === "add"
          ? "Quick Add will open here in the complete flow."
          : "Text or voice update will open here in the complete flow.",
    );
  };

  return (
    <AppShell
      onQuickAdd={() => showSimulationNotice("add")}
      onQuickUpdate={() => showSimulationNotice("update")}
    >
      <div className="pageHeader">
        <div>
          <p className="eyebrow">{copy(locale, "prototype.synthetic")}</p>
          <h1>{copy(locale, titleKey)}</h1>
          <p>{copy(locale, subtitleKey)}</p>
        </div>
      </div>
      {notice ? (
        <div className="inlineNotice" role="status">
          {notice}
        </div>
      ) : null}
      <section className="surface placeholderSurface">
        <span className="largeGlyph" aria-hidden="true">
          ◌
        </span>
        <p>
          {locale === "ar"
            ? "يجري الآن تركيب محتوى الشاشة التفاعلي."
            : "The interactive screen content is being assembled."}
        </p>
      </section>
    </AppShell>
  );
}

export function PrototypeApp({ initialLocale, initialPath }: PrototypeAppProperties) {
  return (
    <PrototypeProvider initialLocale={initialLocale} initialPath={initialPath}>
      <PrototypeContent />
    </PrototypeProvider>
  );
}
