import { AppError } from "@evaluation/contracts";
import { GitHubWebhookService } from "@evaluation/github-integration";
import { Controller, HttpCode, Inject, Post, Req } from "@nestjs/common";

type WebhookRequest = Readonly<{
  rawBody?: Uint8Array;
  headers: Readonly<Record<string, string | string[] | undefined>>;
}>;

export class GitHubWebhookController {
  private readonly webhooks: GitHubWebhookService;

  constructor(webhooks: GitHubWebhookService) {
    this.webhooks = webhooks;
  }

  receive(request: WebhookRequest) {
    if (request.rawBody === undefined) {
      throw new AppError(
        "GITHUB_WEBHOOK_BODY_UNAVAILABLE",
        "errors.github.webhookBodyUnavailable",
        503,
      );
    }
    return this.webhooks.receive({
      rawBody: request.rawBody,
      signature: header(request, "x-hub-signature-256"),
      deliveryId: requiredHeader(request, "x-github-delivery"),
      eventName: requiredHeader(request, "x-github-event"),
    });
  }
}

function header(request: WebhookRequest, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function requiredHeader(request: WebhookRequest, name: string): string {
  const value = header(request, name);
  if (value === undefined || value.trim().length === 0) {
    throw new AppError("GITHUB_WEBHOOK_HEADER_INVALID", "errors.github.webhookHeaderInvalid", 400);
  }
  return value;
}

Controller("api/v1/github")(GitHubWebhookController);
Inject(GitHubWebhookService)(GitHubWebhookController, undefined, 0);
const receive = Object.getOwnPropertyDescriptor(GitHubWebhookController.prototype, "receive")!;
Req()(GitHubWebhookController.prototype, "receive", 0);
HttpCode(202)(GitHubWebhookController.prototype, "receive", receive);
Post("webhook")(GitHubWebhookController.prototype, "receive", receive);
