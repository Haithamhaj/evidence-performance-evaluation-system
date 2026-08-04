import { describe, expect, it } from "vitest";

import { ConnectedSourceItemSchema } from "./connected-work-context.js";

const sourceItem = {
  id: "00000000-0000-4000-8000-000000000201",
  employeeId: "00000000-0000-4000-8000-000000000202",
  provider: "GOOGLE_GMAIL",
  providerSourceId: "gmail-thread-42",
  occurredAt: "2026-07-27T08:30:00Z",
  title: "Project decision",
  summary: "The employee-approved private summary.",
  sourceUrl: "https://mail.google.com/mail/u/0/#inbox/thread-42",
  privacy: "PRIVATE",
  excluded: false,
} as const;

describe("connected work context contracts", () => {
  it("accepts the authorized employee-owned private runtime view", () => {
    expect(ConnectedSourceItemSchema.parse(sourceItem)).toEqual(sourceItem);
    expect(
      ConnectedSourceItemSchema.parse({
        ...sourceItem,
        provider: "GOOGLE_CALENDAR",
        summary: null,
        sourceUrl: null,
        excluded: true,
      }),
    ).toMatchObject({
      employeeId: sourceItem.employeeId,
      provider: "GOOGLE_CALENDAR",
      privacy: "PRIVATE",
      excluded: true,
    });
  });

  it("rejects non-private, ownerless, unsupported, and persistence-only views", () => {
    expect(() =>
      ConnectedSourceItemSchema.parse({ ...sourceItem, employeeId: undefined }),
    ).toThrow();
    expect(() =>
      ConnectedSourceItemSchema.parse({ ...sourceItem, provider: "GOOGLE_DRIVE" }),
    ).toThrow();
    expect(() => ConnectedSourceItemSchema.parse({ ...sourceItem, privacy: "SHARED" })).toThrow();
    expect(() =>
      ConnectedSourceItemSchema.parse({
        ...sourceItem,
        titleCiphertext: "ciphertext-not-for-runtime-view",
        titleKeyVersion: "context-key-v1",
      }),
    ).toThrow();
  });
});
