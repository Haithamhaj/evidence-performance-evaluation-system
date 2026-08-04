import { describe, expect, it } from "vitest";

import { CalendarRestAdapter } from "./calendar-rest-adapter.js";
import { GmailRestAdapter } from "./gmail-rest-adapter.js";
import { GOOGLE_WORKSPACE_READ_SCOPES, GoogleOAuthClient } from "./google-oauth-client.js";

const activeCredential: import("../credential-vault.js").OAuthCredential = {
  accessToken: "access-current",
  refreshToken: "refresh-current",
  expiresAt: "2026-07-20T12:00:00.000Z",
};

function liveOAuth(
  transport: import("./google-oauth-client.js").GoogleHttpTransport,
  overrides: Readonly<{
    sleep?: (milliseconds: number) => Promise<void>;
    now?: () => Date;
  }> = {},
) {
  return new GoogleOAuthClient({
    configuration: {
      externalConfigurationReady: true,
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "https://app.example.test/api/workspace/connected-work/google/callback",
    },
    transport,
    now: overrides.now ?? (() => new Date("2026-07-20T10:00:00.000Z")),
    ...(overrides.sleep === undefined ? {} : { sleep: overrides.sleep }),
  });
}

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("Google OAuth client", () => {
  it("keeps live operations at EXTERNAL_CONFIGURATION_REQUIRED when the production gate is closed", async () => {
    const client = new GoogleOAuthClient({
      configuration: { externalConfigurationReady: false },
      transport: async () => {
        throw new Error("transport must not run while gated");
      },
    });

    expect(() => client.createAuthorizationUrl({ state: "state-123" })).toThrowError(
      expect.objectContaining({ code: "EXTERNAL_CONFIGURATION_REQUIRED" }),
    );
    await expect(
      client.authorizedFetch(
        activeCredential,
        "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      ),
    ).rejects.toMatchObject({ code: "EXTERNAL_CONFIGURATION_REQUIRED" });
  });

  it("requests only the approved identity, Gmail metadata, and Calendar read scopes", () => {
    const client = liveOAuth(async () => jsonResponse({}));

    const url = new URL(client.createAuthorizationUrl({ state: "opaque-state" }));

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("state")).toBe("opaque-state");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.example.test/api/workspace/connected-work/google/callback",
    );
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("scope")?.split(" ").sort()).toEqual(
      [...GOOGLE_WORKSPACE_READ_SCOPES].sort(),
    );
  });

  it("exchanges an authorization code without returning provider payload fields", async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const client = liveOAuth(async (url, init) => {
      requests.push({ url, init });
      return jsonResponse({
        access_token: "access-exchanged",
        refresh_token: "refresh-exchanged",
        expires_in: 3600,
        scope: "ignored-provider-field",
        token_type: "Bearer",
      });
    });

    const credential = await client.exchangeAuthorizationCode("authorization-code");

    expect(credential).toEqual({
      accessToken: "access-exchanged",
      refreshToken: "refresh-exchanged",
      expiresAt: "2026-07-20T11:00:00.000Z",
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://oauth2.googleapis.com/token");
    expect(requests[0]?.init?.method).toBe("POST");
    expect(String(requests[0]?.init?.body)).toContain("grant_type=authorization_code");
  });

  it("refreshes once after an unauthorized API response and retries with the refreshed token", async () => {
    const authorizations: string[] = [];
    let call = 0;
    const client = liveOAuth(async (url, init) => {
      call += 1;
      if (url === "https://oauth2.googleapis.com/token") {
        return jsonResponse({ access_token: "access-refreshed", expires_in: 1800 });
      }
      authorizations.push(new Headers(init?.headers).get("authorization") ?? "");
      return call === 1 ? jsonResponse({ error: "unauthorized" }, 401) : jsonResponse({ ok: true });
    });

    const response = await client.authorizedFetch(
      activeCredential,
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    );

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(authorizations).toEqual(["Bearer access-current", "Bearer access-refreshed"]);
  });

  it("uses bounded Retry-After-aware retries for 429 and transient server errors", async () => {
    const waits: number[] = [];
    let attempts = 0;
    const client = liveOAuth(
      async () => {
        attempts += 1;
        if (attempts === 1) return jsonResponse({ error: "rate" }, 429, { "retry-after": "2" });
        if (attempts === 2) return jsonResponse({ error: "transient" }, 503);
        return jsonResponse({ ok: true });
      },
      { sleep: async (milliseconds) => void waits.push(milliseconds) },
    );

    const response = await client.authorizedFetch(
      activeCredential,
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    );

    expect(response.status).toBe(200);
    expect(attempts).toBe(3);
    expect(waits).toEqual([2_000, 500]);
  });

  it("revokes the refresh credential at Google's revocation endpoint", async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const client = liveOAuth(async (url, init) => {
      requests.push({ url, init });
      return new Response(null, { status: 200 });
    });

    await client.revoke(activeCredential);

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://oauth2.googleapis.com/revoke");
    expect(requests[0]?.init?.method).toBe("POST");
    expect(String(requests[0]?.init?.body)).toBe("token=refresh-current");
  });
});

describe("Gmail REST adapter", () => {
  it("bounds a local initial snapshot to 25 message candidates and filters metadata to the last 14 days", async () => {
    const requestedUrls: string[] = [];
    const adapter = new GmailRestAdapter({
      oauthClient: liveOAuth(async (url) => {
        requestedUrls.push(url);
        const parsed = new URL(url);
        if (parsed.pathname.endsWith("/messages")) {
          return jsonResponse({
            messages: Array.from({ length: 30 }, (_, index) => ({ id: `message-${index}` })),
            nextPageToken: "must-not-be-followed",
          });
        }
        if (parsed.pathname.endsWith("/profile")) return jsonResponse({ historyId: "history-25" });
        const id = parsed.pathname.split("/").at(-1)!;
        return jsonResponse({
          id,
          internalDate: String(
            Date.parse(
              id === "message-24" ? "2026-07-01T09:00:00.000Z" : "2026-08-03T09:00:00.000Z",
            ),
          ),
          payload: { headers: [{ name: "Subject", value: `Subject ${id}` }] },
        });
      }),
      initialSnapshot: { maximumMessages: 25, newerThanDays: 14 },
      now: () => new Date("2026-08-03T10:00:00.000Z"),
    });

    const page = await adapter.pull({
      provider: "GOOGLE_GMAIL",
      credential: activeCredential,
      syncCursor: null,
      pageCursor: null,
      exclusions: [],
    });

    expect(page).toMatchObject({
      kind: "page",
      nextPageCursor: null,
      checkpointCursor: "history-25",
    });
    if (page.kind !== "page") throw new Error("expected page");
    expect(page.items).toHaveLength(24);
    const listUrl = new URL(requestedUrls[0]!);
    expect(listUrl.searchParams.get("maxResults")).toBe("25");
    expect(listUrl.searchParams.get("q")).toBeNull();
    expect(requestedUrls.some((url) => new URL(url).searchParams.get("pageToken") !== null)).toBe(
      false,
    );
  });

  it("paginates metadata-only messages and never normalizes snippets, bodies, or attachments", async () => {
    const requestedUrls: string[] = [];
    const transport: import("./google-oauth-client.js").GoogleHttpTransport = async (url) => {
      requestedUrls.push(url);
      const parsed = new URL(url);
      if (parsed.pathname.endsWith("/messages") && parsed.searchParams.get("pageToken") === null) {
        return jsonResponse({
          messages: [{ id: "message-1", threadId: "thread-1" }],
          nextPageToken: "next-1",
        });
      }
      if (
        parsed.pathname.endsWith("/messages") &&
        parsed.searchParams.get("pageToken") === "next-1"
      ) {
        return jsonResponse({ messages: [{ id: "message-2", threadId: "thread-2" }] });
      }
      if (parsed.pathname.endsWith("/messages/message-1")) {
        return jsonResponse({
          id: "message-1",
          threadId: "thread-1",
          labelIds: ["INBOX"],
          internalDate: "1784538060000",
          snippet: "must not persist",
          payload: {
            headers: [{ name: "Subject", value: "First subject" }],
            body: { data: "must-not-be-read" },
            parts: [{ filename: "private.pdf" }],
          },
        });
      }
      if (parsed.pathname.endsWith("/messages/message-2")) {
        return jsonResponse({
          id: "message-2",
          threadId: "thread-2",
          labelIds: ["INBOX"],
          internalDate: "1784538120000",
          payload: { headers: [{ name: "Subject", value: "Second subject" }] },
        });
      }
      if (parsed.pathname.endsWith("/profile")) return jsonResponse({ historyId: "history-20" });
      throw new Error(`unexpected request: ${url}`);
    };
    const adapter = new GmailRestAdapter({ oauthClient: liveOAuth(transport), pageSize: 1 });

    const first = await adapter.pull({
      provider: "GOOGLE_GMAIL",
      credential: activeCredential,
      syncCursor: null,
      pageCursor: null,
      exclusions: [],
    });
    const second = await adapter.pull({
      provider: "GOOGLE_GMAIL",
      credential: activeCredential,
      syncCursor: null,
      pageCursor: "next-1",
      exclusions: [],
    });

    expect(first).toEqual({
      kind: "page",
      items: [
        {
          providerSourceId: "message-1",
          occurredAt: "2026-07-20T09:01:00.000Z",
          title: "First subject",
          summary: null,
          sourceUrl: "https://mail.google.com/mail/u/0/#all/message-1",
        },
      ],
      nextPageCursor: "next-1",
      checkpointCursor: "gmail-initial-pending",
      cursorExpiresAt: null,
    });
    expect(second).toEqual({
      kind: "page",
      items: [
        {
          providerSourceId: "message-2",
          occurredAt: "2026-07-20T09:02:00.000Z",
          title: "Second subject",
          summary: null,
          sourceUrl: "https://mail.google.com/mail/u/0/#all/message-2",
        },
      ],
      nextPageCursor: null,
      checkpointCursor: "history-20",
      cursorExpiresAt: null,
    });
    expect(requestedUrls.filter((url) => url.includes("/messages/message-"))).toSatisfy(
      (urls: string[]) =>
        urls.every((url) => new URL(url).searchParams.get("format") === "metadata"),
    );
  });

  it("returns cursor_expired for a Gmail history gap without returning provider error content", async () => {
    const adapter = new GmailRestAdapter({
      oauthClient: liveOAuth(async () =>
        jsonResponse({ error: { message: "history details" } }, 404),
      ),
    });

    await expect(
      adapter.pull({
        provider: "GOOGLE_GMAIL",
        credential: activeCredential,
        syncCursor: "old-history",
        pageCursor: null,
        exclusions: [],
      }),
    ).resolves.toEqual({ kind: "cursor_expired" });
  });
});

describe("Calendar REST adapter", () => {
  it("preserves the initial time boundary inside its opaque pagination cursor", async () => {
    const requestedUrls: string[] = [];
    let current = new Date("2026-07-20T10:00:00.000Z");
    const adapter = new CalendarRestAdapter({
      oauthClient: liveOAuth(async (url) => {
        requestedUrls.push(url);
        return requestedUrls.length === 1
          ? jsonResponse({ items: [], nextPageToken: "provider-page-2" })
          : jsonResponse({ items: [], nextSyncToken: "calendar-sync-initial" });
      }),
      now: () => current,
    });

    const first = await adapter.pull({
      provider: "GOOGLE_CALENDAR",
      credential: activeCredential,
      syncCursor: null,
      pageCursor: null,
      exclusions: [],
    });
    expect(first.kind).toBe("page");
    if (first.kind !== "page") throw new Error("expected page");
    current = new Date("2026-07-20T10:05:00.000Z");
    await adapter.pull({
      provider: "GOOGLE_CALENDAR",
      credential: activeCredential,
      syncCursor: null,
      pageCursor: first.nextPageCursor,
      exclusions: [],
    });

    expect(new URL(requestedUrls[0]!).searchParams.get("timeMin")).toBe("2026-07-20T10:00:00.000Z");
    expect(new URL(requestedUrls[1]!).searchParams.get("timeMin")).toBe("2026-07-20T10:00:00.000Z");
    expect(new URL(requestedUrls[1]!).searchParams.get("pageToken")).toBe("provider-page-2");
  });

  it("supports page tokens and incremental sync while normalizing only title, time, and source URL", async () => {
    const requestedUrls: string[] = [];
    const adapter = new CalendarRestAdapter({
      oauthClient: liveOAuth(async (url) => {
        requestedUrls.push(url);
        const parsed = new URL(url);
        if (parsed.searchParams.get("pageToken") === null) {
          return jsonResponse({
            items: [
              {
                id: "event-1",
                summary: "Project review",
                description: "must not persist",
                attendees: [{ email: "private@example.test" }],
                start: { dateTime: "2026-07-22T09:00:00+03:00" },
                htmlLink: "https://calendar.google.com/calendar/event?eid=event-1",
              },
            ],
            nextPageToken: "calendar-page-2",
          });
        }
        return jsonResponse({
          items: [
            {
              id: "event-2",
              summary: "Delivery meeting",
              start: { date: "2026-07-23" },
              htmlLink: "https://calendar.google.com/calendar/event?eid=event-2",
            },
          ],
          nextSyncToken: "calendar-sync-9",
        });
      }),
      pageSize: 1,
    });

    const first = await adapter.pull({
      provider: "GOOGLE_CALENDAR",
      credential: activeCredential,
      syncCursor: "calendar-sync-8",
      pageCursor: null,
      exclusions: [],
    });
    const second = await adapter.pull({
      provider: "GOOGLE_CALENDAR",
      credential: activeCredential,
      syncCursor: "calendar-sync-8",
      pageCursor: "calendar-page-2",
      exclusions: [],
    });

    expect(first).toEqual({
      kind: "page",
      items: [
        {
          providerSourceId: "event-1",
          occurredAt: "2026-07-22T06:00:00.000Z",
          title: "Project review",
          summary: null,
          sourceUrl: "https://calendar.google.com/calendar/event?eid=event-1",
        },
      ],
      nextPageCursor: "calendar-page-2",
      checkpointCursor: "calendar-sync-8",
      cursorExpiresAt: null,
    });
    expect(second).toEqual({
      kind: "page",
      items: [
        {
          providerSourceId: "event-2",
          occurredAt: "2026-07-23T00:00:00.000Z",
          title: "Delivery meeting",
          summary: null,
          sourceUrl: "https://calendar.google.com/calendar/event?eid=event-2",
        },
      ],
      nextPageCursor: null,
      checkpointCursor: "calendar-sync-9",
      cursorExpiresAt: null,
    });
    expect(new URL(requestedUrls[0]!).searchParams.get("syncToken")).toBe("calendar-sync-8");
    expect(new URL(requestedUrls[0]!).searchParams.get("showDeleted")).toBeNull();
    expect(new URL(requestedUrls[0]!).searchParams.get("fields")).toBe(
      "nextPageToken,nextSyncToken,items(id,summary,start,htmlLink,eventType)",
    );
    expect(new URL(requestedUrls[1]!).searchParams.get("pageToken")).toBe("calendar-page-2");
  });

  it("maps Calendar 410 incremental-sync expiry to cursor_expired", async () => {
    const adapter = new CalendarRestAdapter({
      oauthClient: liveOAuth(async () =>
        jsonResponse({ error: { message: "sync token gone" } }, 410),
      ),
    });

    await expect(
      adapter.pull({
        provider: "GOOGLE_CALENDAR",
        credential: activeCredential,
        syncCursor: "expired-calendar-token",
        pageCursor: null,
        exclusions: [],
      }),
    ).resolves.toEqual({ kind: "cursor_expired" });
  });
});
