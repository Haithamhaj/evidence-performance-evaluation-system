"use client";
/* eslint-disable no-unused-vars */
import type { Catalog } from "@evaluation/localization";
import { ProductIcon } from "@evaluation/ui";
import { useEffect, useState } from "react";

import type { WebExportHistoryItem } from "../../platform/operations-contracts";
import styles from "./report-center.module.css";

type Properties = Readonly<{
  catalog: Catalog;
  initialItems?: readonly WebExportHistoryItem[];
  locale: "ar" | "en";
  onOpen?: (item: WebExportHistoryItem) => Promise<{ href: string } | null>;
  onRevoke?: (item: WebExportHistoryItem, reason: string) => Promise<boolean>;
}>;

export function ReportCenter({
  catalog,
  initialItems,
  locale,
  onOpen = openArtifact,
  onRevoke = revokeArtifact,
}: Properties) {
  const [items, setItems] = useState<readonly WebExportHistoryItem[]>(initialItems ?? []);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (initialItems !== undefined) return;
    void loadHistory()
      .then(setItems)
      .catch(() => setNotice(catalog["reports.error"]));
  }, [catalog, initialItems]);

  async function open(item: WebExportHistoryItem) {
    setBusyId(item.id);
    try {
      const result = await onOpen(item);
      if (result === null) setNotice(catalog["reports.accessChanged"]);
      else if (result.href !== "") window.location.assign(result.href);
    } catch {
      setNotice(catalog["reports.error"]);
    } finally {
      setBusyId(null);
    }
  }

  async function revoke(item: WebExportHistoryItem) {
    const reason = reasons[item.id]?.trim() ?? "";
    if (reason.length === 0) {
      setNotice(catalog["reports.reasonRequired"]);
      return;
    }
    setBusyId(item.id);
    try {
      if (!(await onRevoke(item, reason))) throw new Error("revoke failed");
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, state: "REVOKED" } : entry)),
      );
      setNotice(catalog["reports.revoked"]);
    } catch {
      setNotice(catalog["reports.error"]);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={styles.center!} dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
      <header>
        <p>{catalog["reports.eyebrow"]}</p>
        <h1>{catalog["reports.title"]}</h1>
        <span>{catalog["reports.description"]}</span>
      </header>
      <p aria-live="polite" className={styles.notice!} role="status">
        {notice}
      </p>
      {items.length === 0 ? (
        <div className={styles.empty!}>
          <ProductIcon name="document" size="large" />
          <p>{catalog["reports.empty"]}</p>
        </div>
      ) : (
        <ol className={styles.list!}>
          {items.map((item) => {
            const ready = item.state === "READY" && item.artifactId !== null;
            return (
              <li className={styles.item!} key={item.id}>
                <span className={styles.icon!}>
                  <ProductIcon name="document" />
                </span>
                <div className={styles.copy!}>
                  <h2>{catalog[`reports.type.${item.reportType}`]}</h2>
                  <p>
                    {item.format} ·{" "}
                    {new Intl.DateTimeFormat(locale).format(new Date(item.createdAt))}
                  </p>
                  <strong data-state={item.state}>{catalog[`reports.state.${item.state}`]}</strong>
                </div>
                {ready ? (
                  <div className={styles.actions!}>
                    <button
                      disabled={busyId === item.id}
                      onClick={() => void open(item)}
                      type="button"
                    >
                      {catalog["reports.download"]}
                    </button>
                    <label>
                      <span>{catalog["reports.revocationReason"]}</span>
                      <input
                        aria-label={catalog["reports.revocationReason"]}
                        onChange={(event) =>
                          setReasons((current) => ({ ...current, [item.id]: event.target.value }))
                        }
                        value={reasons[item.id] ?? ""}
                      />
                    </label>
                    <button
                      className={styles.danger!}
                      disabled={busyId === item.id}
                      onClick={() => void revoke(item)}
                      type="button"
                    >
                      {catalog["reports.revoke"]}
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      <p className={styles.boundary!}>{catalog["reports.boundary"]}</p>
    </section>
  );
}

async function loadHistory() {
  const response = await fetch("/api/daily-work/reports", { cache: "no-store" });
  if (!response.ok) throw new Error("report history failed");
  const { WebExportHistorySchema } = await import("../../platform/operations-contracts");
  return WebExportHistorySchema.parse(await response.json());
}

async function openArtifact(item: WebExportHistoryItem) {
  if (item.artifactId === null) return null;
  const response = await fetch(`/api/daily-work/reports/artifacts/${item.artifactId}/open`, {
    body: "{}",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error("artifact open failed");
  const { WebArtifactOpenSchema } = await import("../../platform/operations-contracts");
  const result = WebArtifactOpenSchema.parse(await response.json());
  return result.allowed && /^https?:\/\//u.test(result.descriptor)
    ? { href: result.descriptor }
    : null;
}

async function revokeArtifact(item: WebExportHistoryItem, reason: string) {
  if (item.artifactId === null) return false;
  const response = await fetch(`/api/daily-work/reports/artifacts/${item.artifactId}/revoke`, {
    body: JSON.stringify({ reason }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return response.ok;
}
