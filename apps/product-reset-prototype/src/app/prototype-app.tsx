"use client";

import { useState } from "react";

import { AppShell } from "../components/app-shell";
import {
  EvidenceScreen,
  ManagerScreen,
  QuickAddDialog,
  QuickUpdateDialog,
  ReadinessScreen,
} from "../components/experience-screens";
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
  const { path } = usePrototype();
  const [dialog, setDialog] = useState<"add" | "update" | null>(null);
  const parts = path.split("/").filter(Boolean);

  let screen: React.ReactNode = <MyWorkScreen />;
  if (parts[0] === "inbox") screen = <InboxScreen />;
  if (parts[0] === "projects" && parts.length === 1) screen = <ProjectsScreen />;
  if (parts[0] === "projects" && parts[1] && parts.length === 2) {
    screen = <ProjectDetailScreen projectId={parts[1]} />;
  }
  if (parts[0] === "projects" && parts[2] === "workstreams" && parts[3]) {
    screen = <WorkstreamScreen workstreamId={parts[3]} />;
  }
  if (parts[0] === "evidence") screen = <EvidenceScreen />;
  if (parts[0] === "readiness") screen = <ReadinessScreen />;
  if (parts[0] === "manager") screen = <ManagerScreen />;

  return (
    <AppShell
      onQuickAdd={() => setDialog("add")}
      onQuickUpdate={() => setDialog("update")}
    >
      {screen}
      <WorkItemPanel />
      {dialog === "add" ? <QuickAddDialog onClose={() => setDialog(null)} /> : null}
      {dialog === "update" ? <QuickUpdateDialog onClose={() => setDialog(null)} /> : null}
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
