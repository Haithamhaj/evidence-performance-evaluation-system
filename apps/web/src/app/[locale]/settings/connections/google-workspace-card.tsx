"use client";

import type { Catalog, Locale } from "@evaluation/localization";
import { useEffect, useState } from "react";

import {
  completeGoogleConnection,
  disconnectGoogleConnection,
  listConnectedWorkContext,
  startGoogleConnection,
} from "../../../../platform/connected-work-context-api";

type Status = "connected" | "connecting" | "disconnected" | "error";
type CardProperties = Readonly<{ catalog: Catalog; locale: Locale }>;
type CardViewProperties = Readonly<{
  catalog: Catalog;
  onConnect?: () => void;
  onDisconnect?: () => void;
  lastSuccessfulSyncAt?: string;
  stale?: boolean;
  status: Status;
}>;

export function GoogleWorkspaceCard({ catalog, locale }: CardProperties) {
  const [status, setStatus] = useState<Status>("disconnected");
  const [stale, setStale] = useState(false);
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState<string | null>(null);

  async function refreshStatus() {
    try {
      const context = await listConnectedWorkContext();
      setStatus(context.connection.status);
      setLastSuccessfulSyncAt(context.connection.lastSuccessfulSyncAt);
      setStale(false);
    } catch {
      setStale(true);
    }
  }

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function connect() {
    setStatus("connecting");
    try {
      const redirectUri = localizedConnectionReturnUri(window.location.origin, locale);
      const result = await startGoogleConnection(redirectUri);
      if (result.synthetic) {
        const callback = new URL(result.authorizationUrl);
        await completeGoogleConnection({
          nonce: callback.searchParams.get("nonce") ?? "",
          redirectUri,
          state: callback.searchParams.get("state") ?? "",
        });
        await refreshStatus();
        return;
      }
      window.location.assign(result.authorizationUrl);
    } catch {
      setStatus("error");
      setStale(true);
    }
  }

  async function disconnect() {
    setStatus("connecting");
    try {
      await disconnectGoogleConnection();
      setStatus("disconnected");
      setStale(false);
      setLastSuccessfulSyncAt(null);
    } catch {
      setStatus("error");
      setStale(true);
    }
  }

  return (
    <GoogleWorkspaceCardView
      catalog={catalog}
      onConnect={() => void connect()}
      onDisconnect={() => void disconnect()}
      {...(lastSuccessfulSyncAt === null ? {} : { lastSuccessfulSyncAt })}
      stale={stale}
      status={status}
    />
  );
}

export function localizedConnectionReturnUri(origin: string, locale: Locale): string {
  return new URL(`/${locale}/settings/connections`, origin).toString().replace(/\/$/u, "");
}

export function GoogleWorkspaceCardView({
  catalog,
  onConnect,
  onDisconnect,
  lastSuccessfulSyncAt,
  stale = false,
  status,
}: CardViewProperties) {
  const connected = status === "connected";
  return (
    <section className="panel connectionCard" aria-labelledby="google-workspace-heading">
      <p className="eyebrow">{catalog["connections.title"]}</p>
      <h2 id="google-workspace-heading">{catalog["connections.google.title"]}</h2>
      <p>{catalog["connections.google.intro"]}</p>
      <p className="boundaryNote">{catalog["connections.google.ownerOnly"]}</p>
      <dl className="connectionStatus">
        <div>
          <dt>{catalog["connections.google.status"]}</dt>
          <dd>
            {connected
              ? catalog["connections.google.connected"]
              : catalog["connections.google.disconnected"]}
          </dd>
        </div>
        {connected && lastSuccessfulSyncAt !== undefined ? (
          <div>
            <dt>{catalog["connections.google.sync"]}</dt>
            <dd>
              <time dateTime={lastSuccessfulSyncAt}>
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(lastSuccessfulSyncAt))}
              </time>
            </dd>
          </div>
        ) : null}
      </dl>
      {stale ? (
        <p className="formError" role="alert">
          {status === "error"
            ? catalog["connections.google.error"]
            : catalog["connections.google.stale"]}
        </p>
      ) : null}
      <div className="formActions">
        {connected ? (
          <>
            <button className="secondaryAction" onClick={onDisconnect} type="button">
              {catalog["connections.google.disconnect"]}
            </button>
            <p className="formHint">{catalog["connections.google.disconnectNote"]}</p>
          </>
        ) : (
          <button
            className="primaryAction"
            disabled={status === "connecting"}
            onClick={onConnect}
            type="button"
          >
            {catalog["connections.google.connect"]}
          </button>
        )}
        {stale ? (
          <button className="quietButton" onClick={onConnect} type="button">
            {catalog["actions.retry"]}
          </button>
        ) : null}
      </div>
    </section>
  );
}
