import {
  AppError,
  GovernedGitHubFactsSchema,
  type GovernedGitHubFacts,
} from "@evaluation/contracts";
import { z } from "zod";

import { verifyGitHubSignature } from "./signature-verifier.js";

export type GitHubBinding = Readonly<{
  id: string;
  projectId: string;
  installationRecordId: string;
  installationId: string;
  repositoryId: string;
}>;

export type NormalizedGitHubReceipt = Readonly<{
  bindingId: string;
  projectId: string;
  installationRecordId: string;
  installationId: string;
  repositoryId: string;
  deliveryId: string;
  eventType: string;
  sourceId: string;
  sourceUrl: string;
  occurredAt: string;
  governedFacts: GovernedGitHubFacts;
}>;

export interface GitHubBindingReader {
  findActive(installationId: string, repositoryId: string): Promise<GitHubBinding | null>;
}

export interface GitHubReceiptWriter {
  receive(
    receipt: NormalizedGitHubReceipt,
  ): Promise<Readonly<{ receipt: "created" | "duplicate" }>>;
}

const EnvelopeSchema = z.object({
  action: z.string().trim().min(1).max(100),
  installation: z.object({ id: z.union([z.string(), z.number()]) }),
  repository: z.object({ id: z.union([z.string(), z.number()]), html_url: z.url() }),
  pull_request: z
    .object({
      node_id: z.string().trim().min(1).max(500),
      html_url: z.url(),
      created_at: z.iso.datetime({ offset: true }),
      merged_at: z.iso.datetime({ offset: true }).nullable().optional(),
      closed_at: z.iso.datetime({ offset: true }).nullable().optional(),
      title: z.string().trim().min(1).max(300).optional(),
    })
    .optional(),
});

export class GitHubWebhookService {
  private readonly dependencies: Readonly<{
    webhookSecret: string;
    bindingReader: GitHubBindingReader;
    receipts: GitHubReceiptWriter;
  }>;

  constructor(
    dependencies: Readonly<{
      webhookSecret: string;
      bindingReader: GitHubBindingReader;
      receipts: GitHubReceiptWriter;
    }>,
  ) {
    this.dependencies = dependencies;
  }

  async receive(
    input: Readonly<{
      rawBody: Uint8Array;
      signature: string | undefined;
      deliveryId: string;
      eventName: string;
    }>,
  ): Promise<Readonly<{ acknowledged: true; receipt: "created" | "duplicate" }>> {
    if (!verifyGitHubSignature(input.rawBody, input.signature, this.dependencies.webhookSecret)) {
      throw new AppError(
        "GITHUB_WEBHOOK_SIGNATURE_INVALID",
        "errors.github.webhookSignatureInvalid",
        401,
      );
    }
    const receipt = await this.normalize(input);
    const outcome = await this.dependencies.receipts.receive(receipt);
    return { acknowledged: true, receipt: outcome.receipt };
  }

  private async normalize(
    input: Readonly<{ rawBody: Uint8Array; deliveryId: string; eventName: string }>,
  ) {
    if (input.eventName !== "pull_request") {
      throw new AppError(
        "GITHUB_WEBHOOK_EVENT_UNSUPPORTED",
        "errors.github.webhookEventUnsupported",
        202,
      );
    }
    let body: unknown;
    try {
      body = JSON.parse(Buffer.from(input.rawBody).toString("utf8"));
    } catch {
      throw new AppError(
        "GITHUB_WEBHOOK_PAYLOAD_INVALID",
        "errors.github.webhookPayloadInvalid",
        400,
      );
    }
    const parsed = EnvelopeSchema.safeParse(body);
    if (!parsed.success || parsed.data.pull_request === undefined) {
      throw new AppError(
        "GITHUB_WEBHOOK_PAYLOAD_INVALID",
        "errors.github.webhookPayloadInvalid",
        400,
      );
    }
    const installationId = String(parsed.data.installation.id);
    const repositoryId = String(parsed.data.repository.id);
    const binding = await this.dependencies.bindingReader.findActive(installationId, repositoryId);
    if (binding === null) {
      throw new AppError("GITHUB_BINDING_MISMATCH", "errors.github.bindingMismatch", 403);
    }
    const source = parsed.data.pull_request;
    const state =
      source.merged_at !== null && source.merged_at !== undefined
        ? "merged"
        : source.closed_at !== null && source.closed_at !== undefined
          ? "closed"
          : "open";
    const governedFacts = GovernedGitHubFactsSchema.parse([
      {
        kind: "pull_request",
        state,
        ...(source.title === undefined ? {} : { title: source.title }),
      },
    ]);
    return {
      bindingId: binding.id,
      projectId: binding.projectId,
      installationRecordId: binding.installationRecordId,
      installationId,
      repositoryId,
      deliveryId: z.string().trim().min(1).max(200).parse(input.deliveryId),
      eventType: input.eventName,
      sourceId: source.node_id,
      sourceUrl: source.html_url,
      occurredAt: source.merged_at ?? source.closed_at ?? source.created_at,
      governedFacts,
    } satisfies NormalizedGitHubReceipt;
  }
}
