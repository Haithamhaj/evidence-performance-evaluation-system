import { describe, expect, it } from "vitest";

import { PrismaGitHubStore } from "./github-integration.module.js";

const receipt = {
  bindingId: "00000000-0000-4000-8000-000000000042",
  projectId: "00000000-0000-4000-8000-000000000099",
  installationRecordId: "00000000-0000-4000-8000-000000000007",
  installationId: "7",
  repositoryId: "42",
  deliveryId: "delivery-42",
  eventType: "pull_request",
  sourceId: "PR_42",
  sourceUrl: "https://github.com/leapai/atlas/pull/42",
  occurredAt: "2026-08-03T10:00:00.000Z",
  governedFacts: [{ kind: "pull_request" as const, state: "open" as const }],
};

function prismaFailure(code: string, target?: readonly string[]) {
  return Object.assign(new Error(code), {
    code,
    ...(target === undefined ? {} : { meta: { target } }),
  });
}

describe("Prisma GitHub receipt store", () => {
  it("does not turn an audit unique conflict into an acknowledged duplicate delivery", async () => {
    const store = new PrismaGitHubStore(
      {
        $transaction: async (operation: (transaction: unknown) => Promise<unknown>) =>
          operation({
            gitHubSourceEvent: {
              create: async () => ({ id: "00000000-0000-4000-8000-000000000123" }),
            },
          }),
      } as never,
      {
        append: async () => {
          throw prismaFailure("P2002", ["AuditEvent_unique"]);
        },
      } as never,
    );

    const result = await store.receive(receipt).catch((error: unknown) => error);
    expect(result).toMatchObject({ code: "P2002" });
  });

  it("returns duplicate only after confirming the delivery receipt exists", async () => {
    const store = new PrismaGitHubStore({
      $transaction: async (operation: (transaction: unknown) => Promise<unknown>) =>
        operation({
          gitHubSourceEvent: {
            create: async () => {
              throw prismaFailure("P2002", ["deliveryId"]);
            },
          },
        }),
      gitHubSourceEvent: {
        findUnique: async () => ({ id: "00000000-0000-4000-8000-000000000123" }),
      },
    } as never);

    await expect(store.receive(receipt)).resolves.toEqual({ receipt: "duplicate" });
  });
});
