import { describe, expect, it } from "vitest";

import { PreparedExperienceFeedbackService } from "./prepared-experience-feedback.service.js";

const actorId = "20000000-0000-4000-8000-000000000001";
const preparedItemId = "20000000-0000-4000-8000-000000000002";
const idempotencyKey = "20000000-0000-4000-8000-000000000003";

describe("PreparedExperienceFeedbackService", () => {
  it("records owner-only content-free feedback and replays the same idempotent receipt", async () => {
    const rows = new Map<string, Record<string, unknown>>();
    const database = {
      experiencePreparedItem: {
        findUnique: async () => ({
          id: preparedItemId,
          employeeId: actorId,
          outputReference: `experience-prepared:${preparedItemId}`,
          correlationId: "20000000-0000-4000-8000-000000000004",
        }),
      },
      experienceSuggestionFeedback: {
        findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
          rows.get(where.idempotencyKey) ?? null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const row = { ...data, createdAt: new Date("2026-08-15T09:00:00.000Z") };
          rows.set(String(data.idempotencyKey), row);
          return row;
        },
      },
    };
    const service = new PreparedExperienceFeedbackService(
      database as never,
      () => new Date("2026-08-15T09:00:00.000Z"),
    );
    const input = {
      actor: { userId: actorId, active: true },
      preparedItemId,
      input: { idempotencyKey, category: "HELPFUL", surface: "work_prepared_item" },
    } as const;

    await expect(service.record(input)).resolves.toMatchObject({
      preparedItemId,
      category: "HELPFUL",
      replay: false,
    });
    await expect(service.record(input)).resolves.toMatchObject({
      preparedItemId,
      category: "HELPFUL",
      replay: true,
    });
    expect(JSON.stringify([...rows.values()])).not.toMatch(/why|draft|sourceReferences|rating/iu);
  });

  it("does not reveal or accept another employee's prepared item", async () => {
    const service = new PreparedExperienceFeedbackService({
      experiencePreparedItem: {
        findUnique: async () => ({ id: preparedItemId, employeeId: crypto.randomUUID() }),
      },
    } as never);

    await expect(
      service.record({
        actor: { userId: actorId, active: true },
        preparedItemId,
        input: { idempotencyKey, category: "BAD_DRAFT", surface: "work_prepared_item" },
      }),
    ).rejects.toMatchObject({ code: "EXPERIENCE_PREPARED_NOT_FOUND", status: 404 });
  });
});
