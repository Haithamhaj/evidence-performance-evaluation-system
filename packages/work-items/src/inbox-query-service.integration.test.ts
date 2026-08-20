import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@evaluation/database";

import { PrivateInboxQueryService } from "./inbox-query-service.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

afterAll(async () => client.$disconnect());

describe("PrivateInboxQueryService", () => {
  it("rejects inactive actors before querying private captures", async () => {
    const service = new PrivateInboxQueryService(client);

    await expect(
      service.list({
        actor: { userId: crypto.randomUUID(), active: false, roles: ["employee"] },
        input: { status: "open", limit: 50, cursor: null },
      }),
    ).rejects.toMatchObject({ code: "PRIVATE_INBOX_FORBIDDEN" });
  });
});
