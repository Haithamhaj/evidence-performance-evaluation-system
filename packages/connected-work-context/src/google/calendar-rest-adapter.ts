import { AppError } from "@evaluation/contracts";

type ConnectedSourceAdapterPort = import("../source-adapter.js").ConnectedSourceAdapter;
type PullSourceInput = import("../source-adapter.js").PullSourceInput;
type SourceDeltaPage = import("../source-adapter.js").SourceDeltaPage;
type GoogleOAuthClientPort = import("./google-oauth-client.js").GoogleOAuthClient;

type CalendarRestAdapterDependencies = Readonly<{
  oauthClient: GoogleOAuthClientPort;
  pageSize?: number;
  now?: () => Date;
}>;

type CalendarEvent = Readonly<{
  id: string;
  title: string;
  occurredAt: string;
  sourceUrl: string | null;
  eventType: string | null;
}>;

const calendarId = "primary";
const calendarApiBase = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
const initialCursorPrefix = "calendar-initial:";

/** Provider payloads are reduced to title, time, source URL, and opaque source ID here. */
export class CalendarRestAdapter implements ConnectedSourceAdapterPort {
  private readonly oauthClient: GoogleOAuthClientPort;
  private readonly pageSize: number;
  private readonly now: () => Date;

  constructor(dependencies: CalendarRestAdapterDependencies) {
    this.oauthClient = dependencies.oauthClient;
    this.pageSize = positivePageSize(dependencies.pageSize ?? 50);
    this.now = dependencies.now ?? (() => new Date());
  }

  async pull(input: PullSourceInput): Promise<SourceDeltaPage> {
    if (input.provider !== "GOOGLE_CALENDAR") throw providerMismatchError();
    const url = new URL(calendarApiBase);
    url.searchParams.set("maxResults", String(this.pageSize));
    url.searchParams.set("singleEvents", "true");
    let initialTimeMin: string | null = null;
    let providerPageCursor = input.pageCursor;
    if (input.syncCursor === null) {
      const initialPage = parseInitialPageCursor(input.pageCursor, validNow(this.now()));
      initialTimeMin = initialPage.timeMin;
      providerPageCursor = initialPage.providerPageCursor;
      url.searchParams.set("showDeleted", "false");
      url.searchParams.set("timeMin", initialPage.timeMin);
    } else {
      url.searchParams.set("syncToken", input.syncCursor);
    }
    if (providerPageCursor !== null) url.searchParams.set("pageToken", providerPageCursor);

    const response = await this.oauthClient.authorizedFetch(input.credential, url.toString());
    if (response.status === 410 && input.syncCursor !== null) return { kind: "cursor_expired" };
    if (!response.ok) throw providerError();
    const payload = await readObject(response);
    const providerNextPageCursor = optionalString(payload, "nextPageToken");
    const nextPageCursor =
      providerNextPageCursor === null
        ? null
        : initialTimeMin === null
          ? providerNextPageCursor
          : encodeInitialPageCursor(initialTimeMin, providerNextPageCursor);
    const checkpointCursor =
      nextPageCursor === null
        ? requiredString(payload, "nextSyncToken")
        : (input.syncCursor ?? "calendar-initial-pending");
    const events = readObjectArray(payload.items).map(parseEvent);
    return {
      kind: "page",
      items: events.filter((event) => !isExcluded(event, input)).map(normalizeEvent),
      nextPageCursor,
      checkpointCursor,
      cursorExpiresAt: null,
    };
  }
}

function parseInitialPageCursor(
  cursor: string | null,
  now: Date,
): Readonly<{ timeMin: string; providerPageCursor: string | null }> {
  if (cursor === null) return { timeMin: now.toISOString(), providerPageCursor: null };
  if (!cursor.startsWith(initialCursorPrefix)) throw providerError();
  const encoded = cursor.slice(initialCursorPrefix.length);
  const separator = encoded.indexOf("|");
  if (separator < 1 || separator === encoded.length - 1) throw providerError();
  try {
    const timeMin = decodeURIComponent(encoded.slice(0, separator));
    const providerPageCursor = decodeURIComponent(encoded.slice(separator + 1));
    const parsedTimeMin = new Date(timeMin);
    if (Number.isNaN(parsedTimeMin.getTime()) || providerPageCursor.trim().length === 0) {
      throw providerError();
    }
    return { timeMin: parsedTimeMin.toISOString(), providerPageCursor };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw providerError();
  }
}

function encodeInitialPageCursor(timeMin: string, providerPageCursor: string): string {
  return `${initialCursorPrefix}${encodeURIComponent(timeMin)}|${encodeURIComponent(providerPageCursor)}`;
}

function parseEvent(payload: Record<string, unknown>): CalendarEvent {
  const start = readRequiredObject(payload, "start");
  const rawStart = optionalString(start, "dateTime") ?? requiredString(start, "date");
  const occurredAt = new Date(rawStart);
  if (Number.isNaN(occurredAt.getTime())) throw providerError();
  return {
    id: requiredString(payload, "id"),
    title: optionalString(payload, "summary") ?? "",
    occurredAt: occurredAt.toISOString(),
    sourceUrl: optionalUrl(payload, "htmlLink"),
    eventType: optionalString(payload, "eventType"),
  };
}

function normalizeEvent(event: CalendarEvent) {
  return {
    providerSourceId: event.id,
    occurredAt: event.occurredAt,
    title: event.title,
    summary: null,
    sourceUrl: event.sourceUrl,
  } as const;
}

function isExcluded(event: CalendarEvent, input: PullSourceInput): boolean {
  return input.exclusions.some((exclusion) => {
    if (exclusion.kind === "CALENDAR") return exclusion.providerExclusionId === calendarId;
    if (exclusion.kind === "CALENDAR_EVENT_CATEGORY") {
      return event.eventType !== null && exclusion.providerExclusionId === event.eventType;
    }
    return false;
  });
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

function readRequiredObject(
  payload: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const value = payload[key];
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

function optionalUrl(payload: Record<string, unknown>, key: string): string | null {
  const value = optionalString(payload, key);
  if (value === null) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") throw providerError();
    return url.toString();
  } catch {
    throw providerError();
  }
}

function validNow(now: Date): Date {
  if (Number.isNaN(now.getTime())) throw providerError();
  return now;
}

function positivePageSize(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 2_500)
    throw new Error("Invalid Calendar page size");
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
    "GOOGLE_CALENDAR_PROVIDER_ERROR",
    "errors.connectedContext.googleCalendarProviderError",
    502,
  );
}
