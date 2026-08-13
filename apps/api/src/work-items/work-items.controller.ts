import {
  AssignWorkItemInputSchema,
  CreateWorkItemInputSchema,
  ListWorkItemsInputSchema,
  TransitionWorkItemInputSchema,
  UpdateWorkItemInputSchema,
} from "@evaluation/contracts";
import { WorkItemQueryService, WorkItemService } from "@evaluation/work-items";
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";

import { WorkItemsPolicyGuard } from "./work-items-policy.guard.js";

type Request = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

export class WorkItemsController {
  private readonly service: WorkItemService;
  private readonly query: WorkItemQueryService;

  constructor(service: WorkItemService, query: WorkItemQueryService) {
    this.service = service;
    this.query = query;
  }

  create(request: Request, body: unknown) {
    return this.service.create({
      actor: actor(request),
      correlationId: request.correlationId,
      input: CreateWorkItemInputSchema.parse(body),
    });
  }

  get(request: Request, workItemId: string) {
    return this.query.getAuthorizedWorkItem({
      actorId: request.principal.userId,
      workItemId: z.string().uuid().parse(workItemId),
    });
  }

  list(request: Request, query: unknown) {
    const parsed = ListWorkItemsInputSchema.parse(query);
    return this.query.listWorkspace({
      actor: actor(request),
      view: parsed.view,
      layout: parsed.layout,
      projectId: parsed.projectId,
      status: parsed.status,
      search: parsed.search,
      sort: parsed.sort,
      limit: parsed.limit,
      cursor: parsed.cursor,
    });
  }

  update(request: Request, workItemId: string, body: unknown) {
    return this.service.update({
      actor: actor(request),
      correlationId: request.correlationId,
      workItemId: z.string().uuid().parse(workItemId),
      input: UpdateWorkItemInputSchema.parse(body),
    });
  }

  transition(request: Request, workItemId: string, body: unknown) {
    return this.service.transition({
      actor: actor(request),
      correlationId: request.correlationId,
      workItemId: z.string().uuid().parse(workItemId),
      input: TransitionWorkItemInputSchema.parse(body),
    });
  }

  assign(request: Request, workItemId: string, body: unknown) {
    return this.service.assign({
      actor: actor(request),
      correlationId: request.correlationId,
      workItemId: z.string().uuid().parse(workItemId),
      input: AssignWorkItemInputSchema.parse(body),
    });
  }
}

function actor(request: Request) {
  return { userId: request.principal.userId, active: request.principal.active };
}

Controller("api/v1/work-items")(WorkItemsController);
UseGuards(WorkItemsPolicyGuard)(WorkItemsController);
Inject(WorkItemService)(WorkItemsController, undefined, 0);
Inject(WorkItemQueryService)(WorkItemsController, undefined, 1);

const create = Object.getOwnPropertyDescriptor(WorkItemsController.prototype, "create")!;
Req()(WorkItemsController.prototype, "create", 0);
Body()(WorkItemsController.prototype, "create", 1);
Post()(WorkItemsController.prototype, "create", create);

const list = Object.getOwnPropertyDescriptor(WorkItemsController.prototype, "list")!;
Req()(WorkItemsController.prototype, "list", 0);
Query()(WorkItemsController.prototype, "list", 1);
Get()(WorkItemsController.prototype, "list", list);

const get = Object.getOwnPropertyDescriptor(WorkItemsController.prototype, "get")!;
Req()(WorkItemsController.prototype, "get", 0);
Param("workItemId")(WorkItemsController.prototype, "get", 1);
Get(":workItemId")(WorkItemsController.prototype, "get", get);

const update = Object.getOwnPropertyDescriptor(WorkItemsController.prototype, "update")!;
Req()(WorkItemsController.prototype, "update", 0);
Param("workItemId")(WorkItemsController.prototype, "update", 1);
Body()(WorkItemsController.prototype, "update", 2);
Patch(":workItemId")(WorkItemsController.prototype, "update", update);

const transition = Object.getOwnPropertyDescriptor(WorkItemsController.prototype, "transition")!;
Req()(WorkItemsController.prototype, "transition", 0);
Param("workItemId")(WorkItemsController.prototype, "transition", 1);
Body()(WorkItemsController.prototype, "transition", 2);
Post(":workItemId/transitions")(WorkItemsController.prototype, "transition", transition);

const assign = Object.getOwnPropertyDescriptor(WorkItemsController.prototype, "assign")!;
Req()(WorkItemsController.prototype, "assign", 0);
Param("workItemId")(WorkItemsController.prototype, "assign", 1);
Body()(WorkItemsController.prototype, "assign", 2);
Patch(":workItemId/assignee")(WorkItemsController.prototype, "assign", assign);
