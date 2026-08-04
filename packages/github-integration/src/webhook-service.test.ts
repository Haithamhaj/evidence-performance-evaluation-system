import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { GitHubWebhookService, verifyGitHubSignature } from "./index.js";

const secret = "test-webhook-secret";
const rawBody = Buffer.from(
  JSON.stringify({
    action: "opened",
    installation: { id: 7 },
    repository: { id: 42, html_url: "https://github.com/leapai/atlas" },
    pull_request: {
      node_id: "PR_42",
      html_url: "https://github.com/leapai/atlas/pull/42",
      created_at: "2026-08-03T10:00:00.000Z",
      title: "Add webhook verification",
    },
  }),
);

function signature(body = rawBody) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

function createService() {
  const receipts: unknown[] = [];
  const service = new GitHubWebhookService({
    webhookSecret: secret,
    bindingReader: {
      findActive: async (installationId, repositoryId) =>
        installationId === "7" && repositoryId === "42"
          ? {
              id: "00000000-0000-4000-8000-000000000042",
              projectId: "00000000-0000-4000-8000-000000000099",
              installationRecordId: "00000000-0000-4000-8000-000000000007",
              installationId,
              repositoryId,
            }
          : null,
    },
    receipts: {
      receive: async (receipt) => {
        const duplicate = receipts.some(
          (candidate) => (candidate as { deliveryId: string }).deliveryId === receipt.deliveryId,
        );
        if (!duplicate) receipts.push(receipt);
        return { receipt: duplicate ? "duplicate" : "created" };
      },
    },
  });
  return { service, receipts };
}

describe("GitHub webhook verification", () => {
  it("rejects an invalid signature before any durable receipt", async () => {
    const { service, receipts } = createService();
    await expect(
      service.receive({
        rawBody,
        signature: "sha256=invalid",
        deliveryId: "delivery-invalid-signature",
        eventName: "pull_request",
      }),
    ).rejects.toMatchObject({ code: "GITHUB_WEBHOOK_SIGNATURE_INVALID" });
    expect(receipts).toEqual([]);
    expect(verifyGitHubSignature(rawBody, signature(), secret)).toBe(true);
  });

  it("acknowledges a supported delivery only after one durable normalized receipt", async () => {
    const { service, receipts } = createService();
    await expect(
      service.receive({
        rawBody,
        signature: signature(),
        deliveryId: "delivery-42",
        eventName: "pull_request",
      }),
    ).resolves.toEqual({ acknowledged: true, receipt: "created" });
    await expect(
      service.receive({
        rawBody,
        signature: signature(),
        deliveryId: "delivery-42",
        eventName: "pull_request",
      }),
    ).resolves.toEqual({ acknowledged: true, receipt: "duplicate" });
    expect(receipts).toEqual([
      expect.objectContaining({
        deliveryId: "delivery-42",
        installationId: "7",
        repositoryId: "42",
        sourceId: "PR_42",
        governedFacts: [{ kind: "pull_request", state: "open", title: "Add webhook verification" }],
      }),
    ]);
  });

  it("accepts standard unneeded GitHub fields while persisting only governed facts", async () => {
    const { service, receipts } = createService();
    const realisticBody = Buffer.from(
      JSON.stringify({
        action: "opened",
        sender: {
          login: "octocat",
          id: 1,
          avatar_url: "https://avatars.githubusercontent.com/u/1",
        },
        installation: { id: 7, account: { login: "leapai", type: "Organization" } },
        organization: { login: "leapai", id: 99 },
        repository: {
          id: 42,
          html_url: "https://github.com/leapai/atlas",
          full_name: "leapai/atlas",
          private: true,
          owner: { login: "leapai", id: 99 },
        },
        pull_request: {
          node_id: "PR_43",
          html_url: "https://github.com/leapai/atlas/pull/43",
          created_at: "2026-08-03T11:00:00.000Z",
          title: "Realistic GitHub event",
          user: { login: "octocat", id: 1 },
          labels: [{ name: "safe" }],
          head: { ref: "feature/webhook", sha: "abc123" },
          base: { ref: "main", sha: "def456" },
        },
      }),
    );
    await expect(
      service.receive({
        rawBody: realisticBody,
        signature: signature(realisticBody),
        deliveryId: "delivery-realistic",
        eventName: "pull_request",
      }),
    ).resolves.toEqual({ acknowledged: true, receipt: "created" });
    expect(receipts).toEqual([
      expect.objectContaining({
        governedFacts: [{ kind: "pull_request", state: "open", title: "Realistic GitHub event" }],
      }),
    ]);
  });

  it("rejects unsupported and wrongly bound events without writing a receipt", async () => {
    const { service, receipts } = createService();
    await expect(
      service.receive({
        rawBody,
        signature: signature(),
        deliveryId: "delivery-unsupported",
        eventName: "issues",
      }),
    ).rejects.toMatchObject({ code: "GITHUB_WEBHOOK_EVENT_UNSUPPORTED" });
    await expect(
      service.receive({
        rawBody: Buffer.from(rawBody.toString().replace('"id":7', '"id":8')),
        signature: signature(Buffer.from(rawBody.toString().replace('"id":7', '"id":8'))),
        deliveryId: "delivery-mismatch",
        eventName: "pull_request",
      }),
    ).rejects.toMatchObject({ code: "GITHUB_BINDING_MISMATCH" });
    expect(receipts).toEqual([]);
  });
});
