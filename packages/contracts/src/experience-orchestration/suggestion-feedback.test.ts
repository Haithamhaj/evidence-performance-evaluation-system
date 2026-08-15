import { describe, expect, it } from "vitest";

import {
  SuggestionFeedbackInputSchema,
  SuggestionFeedbackReceiptSchema,
} from "./experience-orchestration.js";

describe("prepared suggestion feedback contracts", () => {
  it("accepts one content-free feedback category and rejects protected or arbitrary fields", () => {
    const input = {
      idempotencyKey: "10000000-0000-4000-8000-000000000001",
      category: "HELPFUL",
      surface: "work_prepared_item",
    } as const;

    expect(SuggestionFeedbackInputSchema.parse(input)).toEqual(input);
    expect(() =>
      SuggestionFeedbackInputSchema.parse({
        ...input,
        comment: "Private employee context",
      }),
    ).toThrow();
    expect(() =>
      SuggestionFeedbackInputSchema.parse({
        ...input,
        rating: 5,
      }),
    ).toThrow();
  });

  it("returns only the append-only feedback receipt", () => {
    expect(
      SuggestionFeedbackReceiptSchema.parse({
        id: "10000000-0000-4000-8000-000000000002",
        preparedItemId: "10000000-0000-4000-8000-000000000003",
        category: "WRONG_PROJECT",
        createdAt: "2026-08-15T09:00:00.000Z",
        replay: false,
      }),
    ).toEqual({
      id: "10000000-0000-4000-8000-000000000002",
      preparedItemId: "10000000-0000-4000-8000-000000000003",
      category: "WRONG_PROJECT",
      createdAt: "2026-08-15T09:00:00.000Z",
      replay: false,
    });
  });
});
