export const UPDATE_DRAFT_STORAGE_VERSION = 2;

export type StoredUpdateSource = Readonly<{
  kind: string;
  uploadedSourceId?: string;
  voiceSessionId?: string;
  url?: string;
}>;

export type UpdateDraftEnvelope = Readonly<{
  projectId: string;
  workstreamId: string | null;
  workItemId: string | null;
  rawText: string;
  sources?: readonly StoredUpdateSource[];
  returnPath: string;
}>;

export function saveUpdateDraft(key: string, value: UpdateDraftEnvelope): void {
  sessionStorage.setItem(
    storageKey(key),
    JSON.stringify({
      ...value,
      ...(value.sources === undefined
        ? {}
        : { sources: value.sources.map((source) => storedSource(source)) }),
    }),
  );
}

export function loadUpdateDraft(key: string): UpdateDraftEnvelope | null {
  const stored = sessionStorage.getItem(storageKey(key));
  if (stored === null) return null;
  try {
    const value: unknown = JSON.parse(stored);
    return isEnvelope(value) ? value : null;
  } catch {
    return null;
  }
}

export function removeUpdateDraft(key: string): void {
  sessionStorage.removeItem(storageKey(key));
}

function storageKey(key: string): string {
  return `daily-update:v${UPDATE_DRAFT_STORAGE_VERSION}:${key}`;
}

function isEnvelope(value: unknown): value is UpdateDraftEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.projectId === "string" &&
    (typeof item.workstreamId === "string" || item.workstreamId === null) &&
    (typeof item.workItemId === "string" || item.workItemId === null) &&
    typeof item.rawText === "string" &&
    (item.sources === undefined ||
      (Array.isArray(item.sources) && item.sources.every((source) => isStoredSource(source)))) &&
    typeof item.returnPath === "string"
  );
}

function storedSource(source: StoredUpdateSource): StoredUpdateSource {
  if (source.url === undefined) {
    if (source.uploadedSourceId !== undefined) {
      return { kind: source.kind, uploadedSourceId: source.uploadedSourceId };
    }
    if (source.voiceSessionId !== undefined) {
      return { kind: source.kind, voiceSessionId: source.voiceSessionId };
    }
    return { kind: source.kind };
  }
  try {
    const parsed = new URL(source.url);
    return { kind: source.kind, url: `${parsed.origin}${parsed.pathname}` };
  } catch {
    return { kind: source.kind };
  }
}

function isStoredSource(value: unknown): value is StoredUpdateSource {
  if (typeof value !== "object" || value === null) return false;
  const source = value as Record<string, unknown>;
  return (
    typeof source.kind === "string" &&
    (source.uploadedSourceId === undefined || typeof source.uploadedSourceId === "string") &&
    (source.voiceSessionId === undefined || typeof source.voiceSessionId === "string") &&
    (source.url === undefined || typeof source.url === "string") &&
    Object.keys(source).every((key) => ["kind", "uploadedSourceId", "voiceSessionId", "url"].includes(key))
  );
}
