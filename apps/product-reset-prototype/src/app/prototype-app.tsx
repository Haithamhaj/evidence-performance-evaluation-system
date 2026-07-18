"use client";

import { useState } from "react";

import { AppShell } from "../components/app-shell";
import type { Locale } from "../domain/types";
import { PrototypeProvider, usePrototype } from "./prototype-store";
import {
  InboxScreen,
  MyWorkScreen,
  ProjectDetailScreen,
  ProjectsScreen,
  WorkItemPanel,
  WorkstreamScreen,
} from "../components/work-screens";

type PrototypeAppProperties = {
  readonly initialLocale: Locale;
  readonly initialPath: string;
};

function PrototypeContent() {
  const { locale, path } = usePrototype();
  const [notice, setNotice] = useState<string | null>(null);
  const parts = path.split("/").filter(Boolean);

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

  let screen: React.ReactNode = <MyWorkScreen />;
  if (parts[0] === "inbox") screen = <InboxScreen />;
  if (parts[0] === "projects" && parts.length === 1) screen = <ProjectsScreen />;
  if (parts[0] === "projects" && parts[1] && parts.length === 2) {
    screen = <ProjectDetailScreen projectId={parts[1]} />;
  }
  if (parts[0] === "projects" && parts[2] === "workstreams" && parts[3]) {
    screen = <WorkstreamScreen workstreamId={parts[3]} />;
  }

  return (
    <AppShell
      onQuickAdd={() => showSimulationNotice("add")}
      onQuickUpdate={() => showSimulationNotice("update")}
    >
      {notice ? (
        <div className="inlineNotice" role="status">
          {notice}
        </div>
      ) : null}
      {screen}
      <WorkItemPanel />
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
