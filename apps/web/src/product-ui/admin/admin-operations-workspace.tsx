"use client";
/* eslint-disable no-unused-vars */
import type { Catalog } from "@evaluation/localization";
import { ProductIcon } from "@evaluation/ui";
import { useEffect, useState } from "react";

import type { WebAdminCapability, WebAdminHealth } from "../../platform/operations-contracts";
import styles from "./admin-operations-workspace.module.css";

export function AdminOperationsWorkspace({
  catalog,
  initialCapabilities,
  initialHealth,
  locale,
}: Readonly<{
  catalog: Catalog;
  initialCapabilities?: readonly WebAdminCapability[];
  initialHealth?: WebAdminHealth;
  locale: "ar" | "en";
}>) {
  const [health, setHealth] = useState<WebAdminHealth | null>(initialHealth ?? null);
  const [capabilities, setCapabilities] = useState<readonly WebAdminCapability[]>(
    initialCapabilities ?? [],
  );
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const [healthResponse, capabilitiesResponse] = await Promise.all([
        fetch("/api/daily-work/admin/health", { cache: "no-store" }),
        fetch("/api/daily-work/admin/capabilities", { cache: "no-store" }),
      ]);
      if (!healthResponse.ok || !capabilitiesResponse.ok) throw new Error("admin unavailable");
      const { WebAdminCapabilitiesSchema, WebAdminHealthSchema } =
        await import("../../platform/operations-contracts");
      setHealth(WebAdminHealthSchema.parse(await healthResponse.json()));
      setCapabilities(WebAdminCapabilitiesSchema.parse(await capabilitiesResponse.json()));
      setError("");
    } catch {
      setError(catalog["admin.health.unavailable"]);
    }
  }

  useEffect(() => {
    if (initialHealth === undefined || initialCapabilities === undefined) void refresh();
  }, [initialCapabilities, initialHealth]);

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
        <ul className={styles.capabilityList!}>
          {capabilities.map((capability) => (
            <li key={capability.capability}>
              <span>{catalog[CAPABILITY_LABELS[capability.capability]]}</span>
              <strong data-available={capability.available}>
                {capability.available
                  ? catalog["admin.capabilities.available"]
                  : catalog["admin.capabilities.unavailable"]}
              </strong>
            </li>
          ))}
        </ul>
        <strong>{catalog["connections.github.adminRequired"]}</strong>
      </section>
      <p className={styles.boundaryNote!}>{catalog["operations.adminBoundary"]}</p>
    </section>
  );
}

const CAPABILITY_LABELS: Readonly<Record<WebAdminCapability["capability"], keyof Catalog>> = {
  USERS_MANAGE: "admin.capability.USERS_MANAGE",
  TECHNICAL_ROLES_MANAGE: "admin.capability.TECHNICAL_ROLES_MANAGE",
  ORGANIZATION_CONFIG_MANAGE: "admin.capability.ORGANIZATION_CONFIG_MANAGE",
  ORGANIZATION_TEMPLATES_MANAGE: "admin.capability.ORGANIZATION_TEMPLATES_MANAGE",
  LOCALIZATION_VERSIONS_MANAGE: "admin.capability.LOCALIZATION_VERSIONS_MANAGE",
  INTEGRATIONS_MANAGE: "admin.capability.INTEGRATIONS_MANAGE",
  AI_ROUTES_MANAGE: "admin.capability.AI_ROUTES_MANAGE",
  NOTIFICATION_CONFIG_MANAGE: "admin.capability.NOTIFICATION_CONFIG_MANAGE",
  RETENTION_POLICIES_MANAGE: "admin.capability.RETENTION_POLICIES_MANAGE",
  AUDIT_QUERY: "admin.capability.AUDIT_QUERY",
  EXPORT_OPERATIONS_MANAGE: "admin.capability.EXPORT_OPERATIONS_MANAGE",
  SYSTEM_HEALTH_READ: "admin.capability.SYSTEM_HEALTH_READ",
};

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
