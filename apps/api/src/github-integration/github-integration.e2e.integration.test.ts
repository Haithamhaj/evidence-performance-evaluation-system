import { createHmac } from "node:crypto";

import { GitHubWebhookService } from "@evaluation/github-integration";
import { Module } from "@nestjs/common";
import { MODULE_METADATA } from "@nestjs/common/constants.js";
import { NestFactory } from "@nestjs/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../app.module.js";
import { AppErrorFilter } from "../platform/error.filter.js";
import { GitHubIntegrationModule } from "./github-integration.module.js";
import { GitHubWebhookController } from "./github-webhook.controller.js";

const secret = "api-test-webhook-secret";
const rawBody = Buffer.from(
  JSON.stringify({
    action: "opened",
    installation: { id: 7 },
    repository: { id: 42, html_url: "https://github.com/leapai/atlas" },
    pull_request: {
      node_id: "PR_42",
      html_url: "https://github.com/leapai/atlas/pull/42",
      created_at: "2026-08-03T10:00:00.000Z",
      title: "API receipt",
    },
  }),
);
const signature = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
const receipts: unknown[] = [];

const service = new GitHubWebhookService({
  webhookSecret: secret,
  bindingReader: {
    findActive: async () => ({
      id: "00000000-0000-4000-8000-000000000042",
      projectId: "00000000-0000-4000-8000-000000000099",
      installationRecordId: "00000000-0000-4000-8000-000000000007",
      installationId: "7",
      repositoryId: "42",
    }),
  },
  receipts: {
    receive: async (receipt) => {
      const duplicate = receipts.some(
        (candidate) => (candidate as { deliveryId: string }).deliveryId === receipt.deliveryId,
      );
      if (!duplicate) receipts.push(receipt);
      return { receipt: duplicate ? ("duplicate" as const) : ("created" as const) };
    },
  },
});

class TestGithubWebhookModule {}
Module({
  controllers: [GitHubWebhookController],
  providers: [{ provide: GitHubWebhookService, useValue: service }],
})(TestGithubWebhookModule);

let app: import("@nestjs/common").INestApplication | undefined;
let baseUrl = "";

beforeAll(async () => {
  app = await NestFactory.create(TestGithubWebhookModule, { bodyParser: false, logger: false });
  app.useGlobalFilters(new AppErrorFilter());
  app.use(
    (
      request: import("node:http").IncomingMessage & { rawBody?: Buffer; correlationId?: string },
      _response: unknown,
      next: () => void,
    ) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        request.rawBody = Buffer.concat(chunks);
        const suppliedCorrelationId = request.headers["x-correlation-id"];
        request.correlationId =
          (Array.isArray(suppliedCorrelationId)
            ? suppliedCorrelationId[0]
            : suppliedCorrelationId) ?? crypto.randomUUID();
        next();
      });
    },
  );
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as import("node:net").AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => app?.close());

describe("GitHub webhook HTTP boundary", () => {
  it("is registered in the application with the externally gated integration module", () => {
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule)).toContain(
      GitHubIntegrationModule,
    );
  });

  it("does not acknowledge an unsigned delivery", async () => {
    const response = await fetch(`${baseUrl}/api/v1/github/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "pull_request",
        "x-github-delivery": "api-invalid",
        "x-correlation-id": crypto.randomUUID(),
      },
      body: rawBody,
    });
    expect(response.status).toBe(401);
    expect(receipts).toEqual([]);
  });

  it("returns accepted only after the raw signed delivery is received durably", async () => {
    const response = await fetch(`${baseUrl}/api/v1/github/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "pull_request",
        "x-github-delivery": "api-42",
        "x-hub-signature-256": signature,
        "x-correlation-id": crypto.randomUUID(),
      },
      body: rawBody,
    });
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ acknowledged: true, receipt: "created" });
    expect(receipts).toHaveLength(1);
  });
});
