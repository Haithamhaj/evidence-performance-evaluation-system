import { z } from "zod";

const HandleSchema = z.string().min(32).max(10_000);
const StoredContextTaskDraftSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(8_000),
    projectHandle: HandleSchema.or(z.literal("")),
  })
  .strict();

export type StoredContextTaskDraft = z.infer<typeof StoredContextTaskDraftSchema>;

type BrowserStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export function createContextReviewDraftStorage(storage: BrowserStorage) {
  return {
    load(draftHandle: string): StoredContextTaskDraft | null {
      const key = storageKey(draftHandle);
      const serialized = storage.getItem(key);
      if (serialized === null) return null;
      try {
        return StoredContextTaskDraftSchema.parse(JSON.parse(serialized));
      } catch {
        storage.removeItem(key);
        return null;
      }
    },
    save(draftHandle: string, draft: StoredContextTaskDraft): void {
      storage.setItem(
        storageKey(draftHandle),
        JSON.stringify(StoredContextTaskDraftSchema.parse(draft)),
      );
    },
    clear(draftHandle: string): void {
      storage.removeItem(storageKey(draftHandle));
    },
  };
}

function storageKey(draftHandle: string): string {
  return `context-review-draft:${HandleSchema.parse(draftHandle)}`;
}
