import { createDatabaseClient } from "@evaluation/database";
import { afterAll, describe, expect, it } from "vitest";

import { createPrivateContextProtector, type PrivateContextProtector } from "./credential-vault.js";
import { ResearchSourceIntakeReader } from "./research-source-intake-reader.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const protector = createPrivateContextProtector({ mode: "development" });
const at = new Date("2026-08-05T09:00:00.000Z");

afterAll(async () => client.$disconnect());

async function seedPrivateSource(input?: { excluded?: boolean; active?: boolean }) {
  const suffix = crypto.randomUUID();
  const owner = await client.user.create({
    data: {
      email: `research-source-owner-${suffix}@example.invalid`,
      displayName: "Source owner",
      active: input?.active ?? true,
    },
  });
  const other = await client.user.create({
    data: {
      email: `research-source-other-${suffix}@example.invalid`,
      displayName: "Other employee",
    },
  });
  const account = await client.connectedWorkAccount.create({
    data: {
      employeeId: owner.id,
      credentialRef: `research-source://${crypto.randomUUID()}`,
      connectedAt: at,
    },
  });
  const [title, summary] = await Promise.all([
    protector.seal("Private paper review"),
    protector.seal("Compare the method with our Project constraints."),
  ]);
  const item = await client.connectedSourceItem.create({
    data: {
      connectedWorkAccountId: account.id,
      employeeId: owner.id,
      provider: "GOOGLE_GMAIL",
      providerSourceId: `paper-${suffix}`,
      occurredAt: at,
      titleCiphertext: title.ciphertext,
      titleKeyVersion: title.keyVersion,
      summaryCiphertext: summary.ciphertext,
      summaryKeyVersion: summary.keyVersion,
      sourceUrl: "https://papers.example.invalid/method",
      excluded: input?.excluded ?? false,
    },
  });
  return { owner, other, item };
}

describe("ResearchSourceIntakeReader", () => {
  it("returns the private URL, title, and summary only to the owning active employee", async () => {
    const fixture = await seedPrivateSource();
    const reader = new ResearchSourceIntakeReader(client, protector);

    await expect(
      reader.readPrivateSourceIntake({
        actor: { userId: fixture.owner.id, active: true },
        sourceItemId: fixture.item.id,
      }),
    ).resolves.toEqual({
      sourceItemId: fixture.item.id,
      provider: "GOOGLE_GMAIL",
      occurredAt: at.toISOString(),
      title: "Private paper review",
      summary: "Compare the method with our Project constraints.",
      sourceUrl: "https://papers.example.invalid/method",
      sourceReference: `connected-source-item:${fixture.item.id}`,
    });

    await expect(
      reader.readPrivateSourceIntake({
        actor: { userId: fixture.other.id, active: true },
        sourceItemId: fixture.item.id,
      }),
    ).rejects.toMatchObject({ code: "CONNECTED_CONTEXT_FORBIDDEN" });
  });

  it.each([
    ["excluded", { excluded: true }],
    ["owned by an inactive user", { active: false }],
  ])("does not expose an %s private item", async (_label, options) => {
    const fixture = await seedPrivateSource(options);
    const reader = new ResearchSourceIntakeReader(client, protector as PrivateContextProtector);

    await expect(
      reader.readPrivateSourceIntake({
        actor: { userId: fixture.owner.id, active: true },
        sourceItemId: fixture.item.id,
      }),
    ).rejects.toMatchObject({ code: "CONNECTED_CONTEXT_FORBIDDEN" });
  });
});
