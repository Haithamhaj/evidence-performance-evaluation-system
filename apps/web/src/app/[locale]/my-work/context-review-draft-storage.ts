import { z } from "zod";

const UuidSchema = z.string().uuid();
const StoredContextTaskDraftSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(8_000),
    projectId: UuidSchema.or(z.literal("")),
    assigneeId: UuidSchema.or(z.literal("")),
  })
  .strict();

export type StoredContextTaskDraft = z.infer<typeof StoredContextTaskDraftSchema>;

type BrowserStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export function createContextReviewDraftStorage(storage: BrowserStorage) {
  return {
    load(draftId: string): StoredContextTaskDraft | null {
      const key = storageKey(draftId);
      const serialized = storage.getItem(key);
      if (serialized === null) return null;
      try {
        return StoredContextTaskDraftSchema.parse(JSON.parse(serialized));
      } catch {
        storage.removeItem(key);
        return null;
      }
    },
    save(draftId: string, draft: StoredContextTaskDraft): void {
      storage.setItem(
        storageKey(draftId),
        JSON.stringify(StoredContextTaskDraftSchema.parse(draft)),
      );
    },
    clear(draftId: string): void {
      storage.removeItem(storageKey(draftId));
    },
  };
}

function storageKey(draftId: string): string {
  return `context-review-draft:${UuidSchema.parse(draftId)}`;
}
