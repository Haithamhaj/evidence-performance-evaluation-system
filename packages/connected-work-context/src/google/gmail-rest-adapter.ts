import { AppError } from "@evaluation/contracts";

type ConnectedSourceAdapterPort = import("../source-adapter.js").ConnectedSourceAdapter;
type PullSourceInput = import("../source-adapter.js").PullSourceInput;
type SourceDeltaPage = import("../source-adapter.js").SourceDeltaPage;
type GoogleOAuthClientPort = import("./google-oauth-client.js").GoogleOAuthClient;

type GmailRestAdapterDependencies = Readonly<{
  oauthClient: GoogleOAuthClientPort;
  pageSize?: number;
  initialSnapshot?: Readonly<{ maximumMessages: number; newerThanDays: number }>;
  now?: () => Date;
}>;

type GmailMessage = Readonly<{
  id: string;
  threadId: string | null;
  labelIds: readonly string[];
  internalDate: string;
  subject: string;
}>;

const gmailApiBase = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Provider payloads are reduced to metadata-only normalized source items here. */
export class GmailRestAdapter implements ConnectedSourceAdapterPort {
  private readonly oauthClient: GoogleOAuthClientPort;
  private readonly pageSize: number;
  private readonly initialSnapshot:
    Readonly<{ maximumMessages: number; newerThanDays: number }> | undefined;
  private readonly now: () => Date;

  constructor(dependencies: GmailRestAdapterDependencies) {
    this.oauthClient = dependencies.oauthClient;
    this.pageSize = positivePageSize(dependencies.pageSize ?? 50);
    this.initialSnapshot = dependencies.initialSnapshot;
    this.now = dependencies.now ?? (() => new Date());
    if (this.initialSnapshot !== undefined) {
      positivePageSize(this.initialSnapshot.maximumMessages);
      if (
        !Number.isSafeInteger(this.initialSnapshot.newerThanDays) ||
        this.initialSnapshot.newerThanDays < 1 ||
        this.initialSnapshot.newerThanDays > 365
      ) {
        throw new Error("Invalid Gmail initial snapshot range");
      }
    }
  }

  async pull(input: PullSourceInput): Promise<SourceDeltaPage> {
    if (input.provider !== "GOOGLE_GMAIL") throw providerMismatchError();
    return input.syncCursor === null ? this.pullInitial(input) : this.pullHistory(input);
  }

  private async pullInitial(input: PullSourceInput): Promise<SourceDeltaPage> {
    const url = new URL(`${gmailApiBase}/messages`);
    url.searchParams.set(
      "maxResults",
      String(this.initialSnapshot?.maximumMessages ?? this.pageSize),
    );
    url.searchParams.set("includeSpamTrash", "false");
    if (this.initialSnapshot !== undefined) {
      if (input.pageCursor !== null) throw providerError();
    } else if (input.pageCursor !== null) url.searchParams.set("pageToken", input.pageCursor);
    const response = await this.oauthClient.authorizedFetch(input.credential, url.toString());
    if (!response.ok) throw providerError();
    const payload = await readObject(response);
    const messageReferences = readMessageReferences(payload.messages).slice(
      0,
      this.initialSnapshot?.maximumMessages,
    );
    const messages = await this.loadMessages(
      input,
      messageReferences.map((message) => message.id),
    );
    const recentMessages =
      this.initialSnapshot === undefined
        ? messages
        : messages.filter((message) =>
            isWithinRecentDays(message, this.initialSnapshot!.newerThanDays, this.now()),
          );
    const nextPageCursor =
      this.initialSnapshot === undefined ? optionalString(payload, "nextPageToken") : null;
    const checkpointCursor =
      nextPageCursor === null ? await this.loadCurrentHistoryId(input) : "gmail-initial-pending";
    return {
      kind: "page",
      items: recentMessages.filter((message) => !isExcluded(message, input)).map(normalizeMessage),
      nextPageCursor,
      checkpointCursor,
      cursorExpiresAt: null,
    };
  }

  private async pullHistory(input: PullSourceInput): Promise<SourceDeltaPage> {
    const url = new URL(`${gmailApiBase}/history`);
    url.searchParams.set("startHistoryId", input.syncCursor!);
    url.searchParams.set("historyTypes", "messageAdded");
    url.searchParams.set("maxResults", String(this.pageSize));
    if (input.pageCursor !== null) url.searchParams.set("pageToken", input.pageCursor);
    const response = await this.oauthClient.authorizedFetch(input.credential, url.toString());
    if (response.status === 404) return { kind: "cursor_expired" };
    if (!response.ok) throw providerError();
    const payload = await readObject(response);
    const messageIds = readHistoryMessageIds(payload.history);
    const messages = await this.loadMessages(input, messageIds);
    return {
      kind: "page",
      items: messages.filter((message) => !isExcluded(message, input)).map(normalizeMessage),
      nextPageCursor: optionalString(payload, "nextPageToken"),
      checkpointCursor: requiredString(payload, "historyId"),
      cursorExpiresAt: null,
    };
  }

  private async loadMessages(
    input: PullSourceInput,
    ids: readonly string[],
  ): Promise<GmailMessage[]> {
    return Promise.all(
      [...new Set(ids)].map(async (id) => {
        const url = new URL(`${gmailApiBase}/messages/${encodeURIComponent(id)}`);
        url.searchParams.set("format", "metadata");
        url.searchParams.append("metadataHeaders", "Subject");
        const response = await this.oauthClient.authorizedFetch(input.credential, url.toString());
        if (!response.ok) throw providerError();
        return parseMessage(await readObject(response));
      }),
    );
  }

  private async loadCurrentHistoryId(input: PullSourceInput): Promise<string> {
    const response = await this.oauthClient.authorizedFetch(
      input.credential,
      `${gmailApiBase}/profile`,
    );
    if (!response.ok) throw providerError();
    return requiredString(await readObject(response), "historyId");
  }
}

function isWithinRecentDays(message: GmailMessage, days: number, now: Date): boolean {
  const occurredAt = Number(message.internalDate);
  if (!Number.isFinite(occurredAt) || Number.isNaN(now.getTime())) throw providerError();
  return occurredAt >= now.getTime() - days * 24 * 60 * 60 * 1_000 && occurredAt <= now.getTime();
}

function parseMessage(payload: Record<string, unknown>): GmailMessage {
  const headers = readObjectArray(readOptionalObject(payload, "payload")?.headers);
  const subjectHeader = headers.find(
    (header) => typeof header.name === "string" && header.name.toLowerCase() === "subject",
  );
  const labels = Array.isArray(payload.labelIds)
    ? payload.labelIds.filter((value): value is string => typeof value === "string")
    : [];
  return {
    id: requiredString(payload, "id"),
    threadId: optionalString(payload, "threadId"),
    labelIds: labels,
    internalDate: requiredString(payload, "internalDate"),
    subject: typeof subjectHeader?.value === "string" ? subjectHeader.value : "",
  };
}

function normalizeMessage(message: GmailMessage) {
  const occurredAt = new Date(Number(message.internalDate));
  if (Number.isNaN(occurredAt.getTime())) throw providerError();
  return {
    providerSourceId: message.id,
    occurredAt: occurredAt.toISOString(),
    title: message.subject,
    summary: null,
    sourceUrl: `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(message.id)}`,
  } as const;
}

function isExcluded(message: GmailMessage, input: PullSourceInput): boolean {
  return input.exclusions.some((exclusion) => {
    if (exclusion.kind === "GMAIL_THREAD") {
      return message.threadId !== null && exclusion.providerExclusionId === message.threadId;
    }
    if (exclusion.kind === "GMAIL_LABEL")
      return message.labelIds.includes(exclusion.providerExclusionId);
    return false;
  });
}

function readMessageReferences(value: unknown): Array<{ id: string }> {
  return readObjectArray(value).map((entry) => ({ id: requiredString(entry, "id") }));
}

function readHistoryMessageIds(value: unknown): string[] {
  const ids = new Set<string>();
  for (const history of readObjectArray(value)) {
    for (const added of readObjectArray(history.messagesAdded)) {
      const message = readOptionalObject(added, "message");
      if (message !== null) ids.add(requiredString(message, "id"));
    }
  }
  return [...ids];
}

async function readObject(response: Response): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw providerError();
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw providerError();
  return value as Record<string, unknown>;
}

function readObjectArray(value: unknown): Record<string, unknown>[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw providerError();
  return value.map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) throw providerError();
    return item as Record<string, unknown>;
  });
}

function readOptionalObject(
  payload: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const value = payload[key];
  if (value === undefined) return null;
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw providerError();
  return value as Record<string, unknown>;
}

function requiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value.trim().length === 0) throw providerError();
  return value;
}

function optionalString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  if (value === undefined) return null;
  if (typeof value !== "string" || value.trim().length === 0) throw providerError();
  return value;
}

function positivePageSize(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 500)
    throw new Error("Invalid Gmail page size");
  return value;
}

function providerMismatchError(): AppError {
  return new AppError(
    "CONNECTED_CONTEXT_PROVIDER_MISMATCH",
    "errors.connectedContext.providerMismatch",
    400,
  );
}

function providerError(): AppError {
  return new AppError(
    "GOOGLE_GMAIL_PROVIDER_ERROR",
    "errors.connectedContext.googleGmailProviderError",
    502,
  );
}
