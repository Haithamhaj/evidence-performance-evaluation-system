"use client";

import * as ui from "@evaluation/ui";
import { createElement, useCallback, useEffect, useRef, useState } from "react";

import type { WhatChangedProjection } from "../../platform/experience-events-contracts";

type SessionState = "active" | "unauthorized" | "unavailable";
type StreamState =
  "idle" | "connecting" | "ready" | "reconnecting" | "replaying" | "offline" | "unauthorized";

export type ExperienceStreamHandlers = Readonly<{
  onReady: () => void;
  onChange: (cursor: string) => Promise<void>;
  onError: () => Promise<void>;
}>;

type StreamConnection = Readonly<{ close: () => void }>;
type StreamConnector = (
  input: Readonly<{
    afterCursor: string | null;
    handlers: ExperienceStreamHandlers;
  }>,
) => StreamConnection;

export function WhatChangedDialog({
  catalog,
  connectStream = connectExperienceStream,
  fetchProjection = fetchWhatChanged,
  probeSession = probeExperienceSession,
  streamEnabled = false,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  connectStream?: StreamConnector;
  fetchProjection?: (afterCursor?: string | null) => Promise<WhatChangedProjection>;
  probeSession?: () => Promise<SessionState>;
  streamEnabled?: boolean;
}>) {
  const [projection, setProjection] = useState<WhatChangedProjection | null>(null);
  const [failed, setFailed] = useState(false);
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const reducedMotion = useReducedMotion();
  const cursorRef = useRef<string | null>(null);
  const connectionRef = useRef<StreamConnection | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openStreamRef = useRef<() => void>(() => undefined);

  const applyProjection = useCallback((incoming: WhatChangedProjection) => {
    setProjection((current) => mergeProjection(current, incoming));
    cursorRef.current = greatestCursor(cursorRef.current, incoming.nextCursor);
  }, []);

  const refresh = useCallback(
    async (afterCursor: string | null) => {
      const incoming = await fetchProjection(afterCursor);
      applyProjection(incoming);
    },
    [applyProjection, fetchProjection],
  );

  const recover = useCallback(async () => {
    connectionRef.current?.close();
    connectionRef.current = null;
    const session = await probeSession().catch(() => "unavailable" as const);
    if (session === "unauthorized") {
      setStreamState("unauthorized");
      return;
    }
    if (session === "unavailable") {
      setStreamState("reconnecting");
      if (reconnectTimerRef.current !== null) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => void recover(), 1_500);
      return;
    }
    setStreamState("replaying");
    try {
      await refresh(cursorRef.current);
      openStreamRef.current();
    } catch {
      setStreamState("reconnecting");
    }
  }, [probeSession, refresh]);

  const openStream = useCallback(() => {
    if (!streamEnabled) return;
    connectionRef.current?.close();
    setStreamState("connecting");
    connectionRef.current = connectStream({
      afterCursor: cursorRef.current,
      handlers: {
        onReady: () => setStreamState("ready"),
        onChange: async (eventCursor) => {
          if (cursorRef.current !== null && BigInt(eventCursor) <= BigInt(cursorRef.current)) {
            return;
          }
          setStreamState("replaying");
          try {
            await refresh(cursorRef.current);
            setStreamState("ready");
          } catch {
            setStreamState("reconnecting");
          }
        },
        onError: async () => {
          setStreamState("reconnecting");
          await recover();
        },
      },
    });
  }, [connectStream, recover, refresh, streamEnabled]);
  openStreamRef.current = openStream;

  const load = () => {
    setFailed(false);
    void refresh(null).then(openStream, () => setFailed(true));
  };

  useEffect(() => {
    const offline = () => {
      connectionRef.current?.close();
      connectionRef.current = null;
      setStreamState("offline");
    };
    const online = () => {
      if (streamEnabled) void recover();
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      connectionRef.current?.close();
      if (reconnectTimerRef.current !== null) clearTimeout(reconnectTimerRef.current);
    };
  }, [recover, streamEnabled]);

  const statusKey = streamStatusKey(streamState);
  return createElement(ui.FocusedDialog, {
    closeLabel: catalog["actions.close"],
    title: catalog["shell.global.whatChanged"],
    trigger: createElement(ui.ActionButton, {
      children: catalog["shell.global.whatChanged"],
      onPress: load,
      variant: "secondary",
    }),
    children: (
      <>
        {failed ? <p role="alert">{catalog["whatChanged.recovery"]}</p> : null}
        {!failed && projection === null ? <p>{catalog["whatChanged.loading"]}</p> : null}
        {statusKey === null ? null : (
          <p aria-live="polite" role="status">
            {catalog[statusKey]}
          </p>
        )}
        {streamState === "unauthorized" ? (
          <a href="/api/auth/login">{catalog["whatChanged.signIn"]}</a>
        ) : null}
        {streamEnabled && reducedMotion ? <p>{catalog["whatChanged.reducedMotion"]}</p> : null}
        {projection?.items.length === 0 ? <p>{catalog["whatChanged.empty"]}</p> : null}
        {projection?.items.map((item) => (
          <article key={item.receiptId}>
            <strong>
              {
                catalog[
                  `whatChanged.type.${item.type}` as "whatChanged.type.user.capture_submitted"
                ]
              }
            </strong>
            <p>{catalog["whatChanged.source.work"]}</p>
          </article>
        ))}
        {projection !== null || failed ? (
          <button onClick={() => void refresh(cursorRef.current)} type="button">
            {catalog["whatChanged.refresh"]}
          </button>
        ) : null}
      </>
    ),
  });
}

function streamStatusKey(
  state: StreamState,
):
  | "whatChanged.connecting"
  | "whatChanged.reconnecting"
  | "whatChanged.replaying"
  | "whatChanged.offline"
  | "whatChanged.unauthorized"
  | null {
  if (state === "connecting") return "whatChanged.connecting";
  if (state === "reconnecting") return "whatChanged.reconnecting";
  if (state === "replaying") return "whatChanged.replaying";
  if (state === "offline") return "whatChanged.offline";
  if (state === "unauthorized") return "whatChanged.unauthorized";
  return null;
}

function mergeProjection(
  current: WhatChangedProjection | null,
  incoming: WhatChangedProjection,
): WhatChangedProjection {
  if (current === null) return incoming;
  const byReceipt = new Map(
    [...current.items, ...incoming.items].map((item) => [item.receiptId, item] as const),
  );
  return {
    items: [...byReceipt.values()].sort((left, right) =>
      BigInt(left.cursor) < BigInt(right.cursor)
        ? -1
        : BigInt(left.cursor) > BigInt(right.cursor)
          ? 1
          : 0,
    ),
    nextCursor: greatestCursor(current.nextCursor, incoming.nextCursor),
  };
}

function greatestCursor(left: string | null, right: string | null): string | null {
  if (left === null) return right;
  if (right === null) return left;
  return BigInt(left) >= BigInt(right) ? left : right;
}

async function fetchWhatChanged(afterCursor: string | null = null): Promise<WhatChangedProjection> {
  const query = afterCursor === null ? "" : `?afterCursor=${encodeURIComponent(afterCursor)}`;
  const response = await fetch(`/api/daily-work/experience/what-changed${query}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("what changed unavailable");
  const { WhatChangedProjectionSchema } =
    await import("../../platform/experience-events-contracts");
  return WhatChangedProjectionSchema.parse(await response.json());
}

async function probeExperienceSession(): Promise<SessionState> {
  const response = await fetch("/api/daily-work/experience/session", { cache: "no-store" });
  if (response.ok) return "active";
  if (response.status === 401 || response.status === 403) return "unauthorized";
  return "unavailable";
}

function connectExperienceStream(
  input: Readonly<{
    afterCursor: string | null;
    handlers: ExperienceStreamHandlers;
  }>,
): StreamConnection {
  const query =
    input.afterCursor === null ? "" : `?afterCursor=${encodeURIComponent(input.afterCursor)}`;
  const source = new EventSource(`/api/experience-stream${query}`);
  source.addEventListener("open", input.handlers.onReady);
  source.addEventListener("experience.changed", (event) => {
    const cursor = (event as MessageEvent).lastEventId;
    if (/^[1-9]\d*$/u.test(cursor)) void input.handlers.onChange(cursor);
  });
  source.addEventListener("error", () => void input.handlers.onError());
  return { close: () => source.close() };
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(media.matches);
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return reduced;
}
