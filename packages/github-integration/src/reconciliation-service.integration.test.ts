import { describe, expect, it } from "vitest";

import { GitHubReconciliationService } from "./index.js";

const binding = {
  id: "00000000-0000-4000-8000-000000000042",
  projectId: "00000000-0000-4000-8000-000000000099",
  installationRecordId: "00000000-0000-4000-8000-000000000007",
  installationId: "7",
  repositoryId: "42",
};

describe("GitHub reconciliation", () => {
  it("recovers missed normalized events and advances its cursor only after durable receipts", async () => {
    const received: unknown[] = [];
    const saved: unknown[] = [];
    const service = new GitHubReconciliationService({
      bindings: { listActive: async () => [binding] },
      cursors: {
        find: async () => "cursor-before",
        save: async (cursor) => void saved.push(cursor),
      },
      client: {
        listEvents: async () => ({
          kind: "success",
          nextCursor: "cursor-after",
          events: [
            {
              deliveryId: "recovery:PR_43",
              eventType: "pull_request",
              sourceId: "PR_43",
              sourceUrl: "https://github.com/leapai/atlas/pull/43",
              occurredAt: "2026-08-03T11:00:00.000Z",
              governedFacts: [{ kind: "pull_request", state: "merged", title: "Recovered PR" }],
            },
          ],
        }),
      },
      receipts: {
        receive: async (event) => {
          received.push(event);
          return { receipt: "created" as const };
        },
      },
    });
    await expect(service.reconcile()).resolves.toEqual({
      recovered: 1,
      rateLimited: 0,
      deleted: 0,
    });
    expect(received).toHaveLength(1);
    expect(saved).toEqual([
      expect.objectContaining({ bindingId: binding.id, cursor: "cursor-after" }),
    ]);
  });

  it.each([
    [
      "deleted repository",
      { kind: "deleted_repository" as const },
      { recovered: 0, rateLimited: 0, deleted: 1 },
    ],
    ["rate limit", { kind: "rate_limited" as const }, { recovered: 0, rateLimited: 1, deleted: 0 }],
  ])("keeps the cursor unchanged for %s", async (_name, providerResult, expected) => {
    const saved: unknown[] = [];
    const service = new GitHubReconciliationService({
      bindings: { listActive: async () => [binding] },
      cursors: {
        find: async () => "cursor-before",
        save: async (cursor) => void saved.push(cursor),
      },
      client: { listEvents: async () => providerResult },
      receipts: { receive: async () => ({ receipt: "created" as const }) },
    });
    await expect(service.reconcile()).resolves.toEqual(expected);
    expect(saved).toEqual([]);
  });
});
