"use client";
/* eslint-disable no-unused-vars */
import { ProductIcon } from "@evaluation/ui";
import type { Catalog } from "@evaluation/localization";
import { useEffect, useMemo, useState } from "react";

import type {
  WebNotificationItem,
  WebNotificationOpenResult,
} from "../../platform/notification-contracts";
import styles from "./notification-inbox.module.css";

type Properties = Readonly<{
  catalog: Catalog;
  initialItems?: readonly WebNotificationItem[];
  locale: "ar" | "en";
  onOpen?: (item: WebNotificationItem) => Promise<{ href: string } | null>;
  onResolve?: (item: WebNotificationItem) => Promise<boolean>;
}>;

export function NotificationInbox({
  catalog,
  initialItems,
  locale,
  onOpen = (item) => openNotification(item, locale),
  onResolve = resolveNotification,
}: Properties) {
  const [items, setItems] = useState<readonly WebNotificationItem[]>(initialItems ?? []);
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (initialItems !== undefined) return;
    void loadNotifications()
      .then(setItems)
      .catch(() => setNotice(catalog["notifications.error"]));
  }, [catalog, initialItems]);

  const groups = useMemo(() => groupNotifications(items), [items]);

  async function open(item: WebNotificationItem) {
    setBusyId(item.id);
    try {
      const result = await onOpen(item);
      if (result === null) {
        setNotice(catalog["notifications.accessChanged"]);
        return;
      }
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry,
        ),
      );
      if (result.href !== "") window.location.assign(result.href);
    } catch {
      setNotice(catalog["notifications.error"]);
    } finally {
      setBusyId(null);
    }
  }

  async function resolve(item: WebNotificationItem) {
    setBusyId(item.id);
    try {
      if (!(await onResolve(item))) throw new Error("resolve failed");
      setItems((current) => current.filter((entry) => entry.dedupeKey !== item.dedupeKey));
      setNotice(catalog["notifications.resolved"]);
    } catch {
      setNotice(catalog["notifications.error"]);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={styles.inbox!} dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
      <header>
        <div>
          <p>{catalog["notifications.eyebrow"]}</p>
          <h1>{catalog["notifications.title"]}</h1>
          <span>{catalog["notifications.description"]}</span>
        </div>
      </header>
      <p aria-live="polite" className={styles.notice!} role="status">
        {notice}
      </p>
      {groups.length === 0 ? (
        <div className={styles.empty!}>
          <ProductIcon name="check" size="large" />
          <p>{catalog["notifications.empty"]}</p>
        </div>
      ) : (
        <ol className={styles.list!}>
          {groups.map((group) => {
            const item = group.items[0]!;
            const unread = group.items.some((entry) => entry.readAt === null);
            return (
              <li className={styles.item!} data-unread={unread} key={group.key}>
                <div className={styles.icon!}>
                  <ProductIcon name={iconFor(item.category)} />
                </div>
                <div className={styles.copy!}>
                  <div className={styles.itemHeading!}>
                    <h2>{catalog[`notifications.category.${item.category}`]}</h2>
                    <span>
                      {unread ? catalog["notifications.unread"] : catalog["notifications.read"]}
                    </span>
                  </div>
                  <p>{catalog[`notifications.action.${item.actionKind}`]}</p>
                  {group.items.length > 1 ? (
                    <small>
                      {catalog["notifications.related"].replace(
                        "{count}",
                        String(group.items.length),
                      )}
                    </small>
                  ) : null}
                </div>
                <div className={styles.actions!}>
                  <button
                    disabled={busyId === item.id}
                    onClick={() => void open(item)}
                    type="button"
                  >
                    {catalog[`notifications.action.${item.actionKind}`]}
                  </button>
                  <button
                    className={styles.quiet!}
                    disabled={busyId === item.id}
                    onClick={() => void resolve(item)}
                    type="button"
                  >
                    {catalog["notifications.markResolved"]}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function groupNotifications(items: readonly WebNotificationItem[]) {
  const groups = new Map<string, WebNotificationItem[]>();
  for (const item of items.filter((entry) => entry.resolvedAt === null)) {
    const group = groups.get(item.dedupeKey) ?? [];
    group.push(item);
    groups.set(item.dedupeKey, group);
  }
  return [...groups].map(([key, entries]) => ({ key, items: entries }));
}

async function loadNotifications() {
  const response = await fetch("/api/daily-work/notifications", { cache: "no-store" });
  if (!response.ok) throw new Error("notification load failed");
  const { WebNotificationInboxSchema } = await import("../../platform/notification-contracts");
  return WebNotificationInboxSchema.parse(await response.json());
}

async function openNotification(item: WebNotificationItem, locale: "ar" | "en") {
  const response = await fetch(`/api/daily-work/notifications/${item.id}/open`, {
    body: "{}",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error("notification open failed");
  const { WebNotificationOpenResultSchema } = await import("../../platform/notification-contracts");
  const result: WebNotificationOpenResult = WebNotificationOpenResultSchema.parse(
    await response.json(),
  );
  return result.allowed ? { href: actionHref(result.action, locale) } : null;
}

async function resolveNotification(item: WebNotificationItem) {
  const response = await fetch(`/api/daily-work/notifications/${item.id}/resolve`, {
    body: "{}",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) return false;
  const { WebNotificationResolveResultSchema } =
    await import("../../platform/notification-contracts");
  return WebNotificationResolveResultSchema.parse(await response.json()).resolved;
}

function actionHref(
  action: Readonly<{ kind: WebNotificationItem["actionKind"]; resourceId: string }>,
  locale: "ar" | "en",
) {
  if (action.kind === "RECONNECT") return `/${locale}/settings/connections`;
  if (action.kind === "OPEN_CONTINUITY") return `/${locale}/continuity`;
  if (action.kind === "OPEN_EVALUATION") return `/${locale}/evaluations/${action.resourceId}`;
  if (action.kind === "OPEN_ADMIN_HEALTH") return `/${locale}/admin/operations`;
  return `/${locale}/my-work`;
}

function iconFor(
  category: WebNotificationItem["category"],
): import("@evaluation/ui").ProductIconName {
  if (category === "CONNECTOR_STATE") return "link";
  if (category === "EXPORT_READY") return "document";
  if (category === "SECURITY_ALERT" || category === "SYSTEM_HEALTH") return "help";
  return "calendar";
}
