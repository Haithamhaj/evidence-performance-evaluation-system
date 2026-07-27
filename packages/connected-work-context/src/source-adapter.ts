type ConnectedSourceProvider = import("@evaluation/contracts").ConnectedSourceProvider;

export type ConnectedSourceExclusionKind =
  "GMAIL_LABEL" | "GMAIL_THREAD" | "CALENDAR" | "CALENDAR_EVENT_CATEGORY";

export type SourceExclusion = Readonly<{
  kind: ConnectedSourceExclusionKind;
  providerExclusionId: string;
}>;

export type NormalizedSourceItemInput = Readonly<{
  providerSourceId: string;
  occurredAt: string;
  title: string;
  summary: string | null;
  sourceUrl: string | null;
}>;

export type PullSourceInput = Readonly<{
  provider: ConnectedSourceProvider;
  credential: import("./credential-vault.js").OAuthCredential;
  syncCursor: string | null;
  pageCursor: string | null;
  exclusions: readonly SourceExclusion[];
}>;

export type SourceDeltaPage =
  | Readonly<{ kind: "cursor_expired" }>
  | Readonly<{
      kind: "page";
      items: readonly NormalizedSourceItemInput[];
      nextPageCursor: string | null;
      checkpointCursor: string;
      cursorExpiresAt: string | null;
    }>;

export interface ConnectedSourceAdapter {
  pull(input: PullSourceInput): Promise<SourceDeltaPage>;
}
