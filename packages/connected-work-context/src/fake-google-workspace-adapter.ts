type ConnectedSourceProvider = import("@evaluation/contracts").ConnectedSourceProvider;
type ConnectedSourceAdapterPort = import("./source-adapter.js").ConnectedSourceAdapter;
type FakeFixture = import("./source-adapter.js").NormalizedSourceItemInput &
  Readonly<{
    exclusionKeys?: readonly Readonly<{
      kind: import("./source-adapter.js").ConnectedSourceExclusionKind;
      providerExclusionId: string;
    }>[];
  }>;

type FakeAdapterConfiguration = Readonly<{
  fixtures: Readonly<Record<ConnectedSourceProvider, readonly FakeFixture[]>>;
  pageSize: number;
  expiredSyncCursors?: readonly string[];
}>;

const checkpointPrefix = "fake-google-workspace";

/**
 * Deterministic local adapter. It performs no HTTP or OAuth operations.
 */
export class FakeGoogleWorkspaceAdapter implements ConnectedSourceAdapterPort {
  private readonly fixtures: FakeAdapterConfiguration["fixtures"];
  private readonly pageSize: number;
  private readonly expiredSyncCursors: ReadonlySet<string>;

  constructor(configuration: FakeAdapterConfiguration) {
    if (!Number.isInteger(configuration.pageSize) || configuration.pageSize < 1) {
      throw new Error("Fake adapter pageSize must be a positive integer");
    }
    this.fixtures = configuration.fixtures;
    this.pageSize = configuration.pageSize;
    this.expiredSyncCursors = new Set(configuration.expiredSyncCursors ?? []);
  }

  async pull(
    input: import("./source-adapter.js").PullSourceInput,
  ): Promise<import("./source-adapter.js").SourceDeltaPage> {
    if (
      input.pageCursor === null &&
      input.syncCursor !== null &&
      this.expiredSyncCursors.has(input.syncCursor)
    ) {
      return { kind: "cursor_expired" };
    }

    const fixtures = this.fixtures[input.provider].filter((fixture) => !isExcluded(fixture, input));
    const syncOffset = parseSyncOffset(input.provider, input.syncCursor);
    const pageOffset = parsePageOffset(input.pageCursor);
    const start = syncOffset + pageOffset;
    const items = fixtures.slice(start, start + this.pageSize).map(stripFixtureMetadata);
    const nextOffset = start + items.length;
    const nextPageCursor =
      nextOffset < fixtures.length ? `fake-page:${nextOffset - syncOffset}` : null;

    return {
      kind: "page",
      items,
      nextPageCursor,
      checkpointCursor: `${checkpointPrefix}:${input.provider}:${fixtures.length}`,
      cursorExpiresAt: null,
    };
  }
}

function isExcluded(
  fixture: FakeFixture,
  input: import("./source-adapter.js").PullSourceInput,
): boolean {
  const keys = fixture.exclusionKeys ?? [];
  return input.exclusions.some((exclusion) =>
    keys.some(
      (key) =>
        key.kind === exclusion.kind && key.providerExclusionId === exclusion.providerExclusionId,
    ),
  );
}

function stripFixtureMetadata(
  fixture: FakeFixture,
): import("./source-adapter.js").NormalizedSourceItemInput {
  return {
    providerSourceId: fixture.providerSourceId,
    occurredAt: fixture.occurredAt,
    title: fixture.title,
    summary: fixture.summary,
    sourceUrl: fixture.sourceUrl,
  };
}

function parseSyncOffset(provider: ConnectedSourceProvider, cursor: string | null): number {
  if (cursor === null) return 0;
  const prefix = `${checkpointPrefix}:${provider}:`;
  if (!cursor.startsWith(prefix)) return 0;
  const offset = Number(cursor.slice(prefix.length));
  return Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
}

function parsePageOffset(cursor: string | null): number {
  if (cursor === null || !cursor.startsWith("fake-page:")) return 0;
  const offset = Number(cursor.slice("fake-page:".length));
  return Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
}
