import { AppError } from "@evaluation/contracts";
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";

import { ConnectedWorkContextPolicyGuard } from "./connected-work-context-policy.guard.js";
import { CONNECTED_WORK_RUNTIME_CONFIGURATION } from "./connections.controller.js";

export const CONNECTED_WORK_QUERY_SERVICE = "CONNECTED_WORK_QUERY_SERVICE";
export const CONNECTED_WORK_CONNECTION_SERVICE = "CONNECTED_WORK_CONNECTION_SERVICE";

type Request = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

type ContextQuery = Pick<
  import("@evaluation/connected-work-context").ConnectedWorkContextQueryService,
  "review"
>;
type ContextConnection = Pick<
  import("@evaluation/connected-work-context").ConnectedWorkConnectionService,
  "linkProject" | "setItemExclusion" | "unlinkProject"
>;
const ProjectLinkInputSchema = z
  .object({
    projectId: z.string().uuid(),
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();
const UnlinkInputSchema = z
  .object({
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();

export class ContextItemsController {
  private readonly query: ContextQuery;
  private readonly connection: ContextConnection;
  private readonly configuration: import("./connections.controller.js").GoogleConnectionFlowConfiguration;

  constructor(
    query: ContextQuery,
    connection: ContextConnection,
    configuration: import("./connections.controller.js").GoogleConnectionFlowConfiguration,
  ) {
    this.query = query;
    this.connection = connection;
    this.configuration = configuration;
  }

  async list(request: Request) {
    const review = await this.query.review({ actor: actor(request) });
    return {
      mode: this.configuration.mode,
      synthetic: this.configuration.mode === "synthetic",
      connection: review.connection,
      items: review.items.map((item) => ({
        id: item.id,
        provider: item.provider,
        occurredAt: item.occurredAt,
        title: item.title,
        summary: item.summary,
        sourceUrl: item.sourceUrl,
        privacy: item.privacy,
        excluded: item.excluded,
        projectId: item.projectId,
      })),
    };
  }

  async setExclusion(request: Request, sourceItemId: string, body: unknown) {
    const id = parseUuid(sourceItemId);
    const input = parseInput(z.object({ excluded: z.boolean() }).strict(), body);
    const result = await this.connection.setItemExclusion({
      actor: actor(request),
      correlationId: request.correlationId,
      sourceItemId: id,
      excluded: input.excluded,
    });
    return { id, excluded: result.excluded };
  }

  async linkProject(request: Request, sourceItemId: string, body: unknown) {
    const id = parseUuid(sourceItemId);
    const input = parseInput(ProjectLinkInputSchema, body);
    await this.connection.linkProject({
      actor: actor(request),
      correlationId: request.correlationId,
      sourceItemId: id,
      projectId: input.projectId,
      reason: input.reason,
    });
    return { id, projectId: input.projectId, linked: true };
  }

  async unlinkProject(request: Request, sourceItemId: string, body: unknown) {
    const id = parseUuid(sourceItemId);
    const input = parseInput(UnlinkInputSchema, body);
    await this.connection.unlinkProject({
      actor: actor(request),
      correlationId: request.correlationId,
      sourceItemId: id,
      reason: input.reason,
    });
    return { id, linked: false };
  }
}

function actor(request: Request) {
  return { userId: request.principal.userId, active: request.principal.active };
}

Controller("api/v1/connected-work/items")(ContextItemsController);
UseGuards(ConnectedWorkContextPolicyGuard)(ContextItemsController);
Inject(CONNECTED_WORK_QUERY_SERVICE)(ContextItemsController, undefined, 0);
Inject(CONNECTED_WORK_CONNECTION_SERVICE)(ContextItemsController, undefined, 1);
Inject(CONNECTED_WORK_RUNTIME_CONFIGURATION)(ContextItemsController, undefined, 2);

const list = Object.getOwnPropertyDescriptor(ContextItemsController.prototype, "list")!;
Req()(ContextItemsController.prototype, "list", 0);
Get()(ContextItemsController.prototype, "list", list);

const setExclusion = Object.getOwnPropertyDescriptor(
  ContextItemsController.prototype,
  "setExclusion",
)!;
Req()(ContextItemsController.prototype, "setExclusion", 0);
Param("id")(ContextItemsController.prototype, "setExclusion", 1);
Body()(ContextItemsController.prototype, "setExclusion", 2);
Patch(":id/exclusion")(ContextItemsController.prototype, "setExclusion", setExclusion);

const linkProject = Object.getOwnPropertyDescriptor(
  ContextItemsController.prototype,
  "linkProject",
)!;
Req()(ContextItemsController.prototype, "linkProject", 0);
Param("id")(ContextItemsController.prototype, "linkProject", 1);
Body()(ContextItemsController.prototype, "linkProject", 2);
Put(":id/project-link")(ContextItemsController.prototype, "linkProject", linkProject);

const unlinkProject = Object.getOwnPropertyDescriptor(
  ContextItemsController.prototype,
  "unlinkProject",
)!;
Req()(ContextItemsController.prototype, "unlinkProject", 0);
Param("id")(ContextItemsController.prototype, "unlinkProject", 1);
Body()(ContextItemsController.prototype, "unlinkProject", 2);
Delete(":id/project-link")(ContextItemsController.prototype, "unlinkProject", unlinkProject);

function parseUuid(value: unknown): string {
  return parseInput(z.string().uuid(), value);
}

function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(
      "CONNECTED_CONTEXT_INPUT_INVALID",
      "errors.connectedContext.inputInvalid",
      400,
    );
  }
  return result.data;
}
