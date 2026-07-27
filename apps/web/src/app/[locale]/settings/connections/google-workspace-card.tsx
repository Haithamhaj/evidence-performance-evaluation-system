"use client";

import type { Catalog } from "@evaluation/localization";
import { useState } from "react";

import {
  completeGoogleConnection,
  disconnectGoogleConnection,
  startGoogleConnection,
} from "../../../../platform/connected-work-context-api";

type Status = "connected" | "connecting" | "disconnected" | "error";
type CardProperties = Readonly<{ catalog: Catalog }>;
type CardViewProperties = Readonly<{
  catalog: Catalog;
  onConnect?: () => void;
  onDisconnect?: () => void;
  stale?: boolean;
  status: Status;
}>;

export function GoogleWorkspaceCard({ catalog }: CardProperties) {
  const [status, setStatus] = useState<Status>("disconnected");
  const [stale, setStale] = useState(false);

  async function connect() {
    setStatus("connecting");
    try {
      const redirectUri = `${window.location.origin}/settings/connections`;
      const result = await startGoogleConnection(redirectUri);
      if (result.synthetic) {
        const callback = new URL(result.authorizationUrl);
        await completeGoogleConnection({
          nonce: callback.searchParams.get("nonce") ?? "",
          redirectUri,
          state: callback.searchParams.get("state") ?? "",
        });
        setStatus("connected");
        setStale(false);
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
      stale={stale}
      status={status}
    />
  );
}

export function GoogleWorkspaceCardView({
  catalog,
  onConnect,
  onDisconnect,
  stale = false,
  status,
}: CardViewProperties) {
  const connected = status === "connected";
  return (
    <section className="panel connectionCard" aria-labelledby="google-workspace-heading">
      <p className="eyebrow">{catalog["connections.title"]}</p>
      <h1 id="google-workspace-heading">{catalog["connections.google.title"]}</h1>
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
        {connected ? (
          <div>
            <dt>{catalog["connections.google.sync"]}</dt>
            <dd>
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date())}
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
          <button className="secondaryAction" onClick={onDisconnect} type="button">
            {catalog["connections.google.disconnect"]}
          </button>
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
