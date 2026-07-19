export const UPDATE_DRAFT_STORAGE_VERSION = 1;

export type UpdateDraftEnvelope = Readonly<{
  projectId: string;
  workstreamId: string | null;
  workItemId: string | null;
  rawText: string;
  returnPath: string;
}>;

export function saveUpdateDraft(key: string, value: UpdateDraftEnvelope): void {
  sessionStorage.setItem(storageKey(key), JSON.stringify(value));
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
    typeof item.returnPath === "string"
  );
}
