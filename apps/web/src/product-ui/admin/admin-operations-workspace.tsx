"use client";
/* eslint-disable no-unused-vars */
import type { Catalog } from "@evaluation/localization";
import { ProductIcon } from "@evaluation/ui";
import { useEffect, useState } from "react";

import type { WebAdminHealth } from "../../platform/operations-contracts";
import styles from "./admin-operations-workspace.module.css";

export function AdminOperationsWorkspace({
  catalog,
  initialHealth,
  locale,
}: Readonly<{ catalog: Catalog; initialHealth?: WebAdminHealth; locale: "ar" | "en" }>) {
  const [health, setHealth] = useState<WebAdminHealth | null>(initialHealth ?? null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const response = await fetch("/api/daily-work/admin/health", { cache: "no-store" });
      if (!response.ok) throw new Error("health unavailable");
      const { WebAdminHealthSchema } = await import("../../platform/operations-contracts");
      setHealth(WebAdminHealthSchema.parse(await response.json()));
      setError("");
    } catch {
      setError(catalog["admin.health.unavailable"]);
    }
  }

  useEffect(() => {
    if (initialHealth === undefined) void refresh();
  }, [initialHealth]);

  return (
    <section className={styles.workspace!} dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
      <header>
        <p>{catalog["admin.eyebrow"]}</p>
        <h1>{catalog["operations.adminTitle"]}</h1>
        <span>{catalog["operations.adminDescription"]}</span>
      </header>
      <div className={styles.summary!}>
        <div>
          <span>{catalog["admin.health.overall"]}</span>
          <strong data-state={health?.state ?? "UNKNOWN"}>
            {health === null
              ? catalog["admin.health.checking"]
              : catalog[`admin.health.state.${health.state}`]}
          </strong>
        </div>
        <button onClick={() => void refresh()} type="button">
          {catalog["admin.health.refresh"]}
        </button>
      </div>
      <p aria-live="polite" className={styles.error!} role="status">
        {error}
      </p>
      <ol className={styles.dependencies!}>
        {(health?.dependencies ?? []).map((dependency) => (
          <li key={dependency.dependency}>
            <span className={styles.icon!}>
              <ProductIcon name={dependency.state === "HEALTHY" ? "check" : "help"} />
            </span>
            <div>
              <h2>{catalog[`admin.health.dependency.${dependency.dependency}`]}</h2>
              <p>{catalog[`admin.health.state.${dependency.state}`]}</p>
            </div>
            <strong>
              {dependency.nextActionKey === null
                ? catalog["admin.health.noAction"]
                : safeNextAction(catalog, dependency.nextActionKey)}
            </strong>
            <details>
              <summary>{catalog["admin.health.reference"]}</summary>
              <code>{dependency.correlationId}</code>
            </details>
          </li>
        ))}
      </ol>
      <section className={styles.boundary!}>
        <h2>{catalog["admin.capabilities.title"]}</h2>
        <p>{catalog["admin.capabilities.description"]}</p>
        <ul>
          <li>{catalog["admin.capabilities.aiRoutes"]}</li>
          <li>{catalog["admin.capabilities.integrations"]}</li>
          <li>{catalog["admin.capabilities.retention"]}</li>
        </ul>
        <strong>{catalog["connections.github.adminRequired"]}</strong>
      </section>
      <p className={styles.boundaryNote!}>{catalog["operations.adminBoundary"]}</p>
    </section>
  );
}

function safeNextAction(catalog: Catalog, key: string) {
  const known: Record<string, keyof Catalog> = {
    "admin.health.configureQueue": "admin.health.action.configureQueue",
    "admin.health.configureObjectStorage": "admin.health.action.configureObjectStorage",
    "admin.health.configureOidc": "admin.health.action.configureOidc",
    "admin.health.configureAiRoute": "admin.health.action.configureAiRoute",
    "admin.health.reconnectConnector": "admin.health.action.reconnectConnector",
    "admin.health.configureEmail": "admin.health.action.configureEmail",
    "admin.health.verifyBackup": "admin.health.action.verifyBackup",
    "admin.health.verifyWorker": "admin.health.action.verifyWorker",
    "admin.health.configureDatabase": "admin.health.action.configureDatabase",
    "admin.health.inspectDependency": "admin.health.action.inspectDependency",
  };
  return catalog[known[key] ?? "admin.health.action.inspectDependency"];
}
