import { Body, Controller, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { CONTEXT_INTELLIGENCE_WORKFLOW, parse, parseUuid } from "./context-analysis.controller.js";
import { ContextIntelligencePolicyGuard } from "./context-intelligence-policy.guard.js";

type Request = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

const PrepareTaskDraftSchema = z.object({ sourceItemId: z.string().uuid() }).strict();
const ConfirmedTaskContentSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(8_000),
    projectId: z.string().uuid(),
    workstreamId: z.string().uuid().nullable(),
    assigneeId: z.string().uuid(),
    dueAt: z.iso.datetime({ offset: true }).nullable(),
    acceptanceConditions: z.array(z.string().trim().min(1).max(500)).max(50),
  })
  .strict();
const ConfirmTaskDraftSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    reason: z.string().trim().min(1).max(1_000),
    draft: ConfirmedTaskContentSchema,
  })
  .strict();

export class TaskDraftsController {
  private readonly workflow: import("./context-analysis.controller.js").ContextIntelligenceWorkflow;

  constructor(workflow: import("./context-analysis.controller.js").ContextIntelligenceWorkflow) {
    this.workflow = workflow;
  }

  prepare(request: Request, body: unknown) {
    const input = parse(PrepareTaskDraftSchema, body);
    return this.workflow.prepareTaskDraft({
      actor: actor(request),
      sourceItemId: input.sourceItemId,
      correlationId: request.correlationId,
    });
  }

  confirm(request: Request, taskDraftId: string, body: unknown) {
    const input = parse(ConfirmTaskDraftSchema, body);
    return this.workflow.confirmTaskDraft({
      actor: actor(request),
      taskDraftId: parseUuid(taskDraftId),
      expectedRevision: input.expectedRevision,
      reason: input.reason,
      draft: input.draft,
      correlationId: request.correlationId,
    });
  }
}

Controller("api/v1/context/task-drafts")(TaskDraftsController);
UseGuards(ContextIntelligencePolicyGuard)(TaskDraftsController);
Inject(CONTEXT_INTELLIGENCE_WORKFLOW)(TaskDraftsController, undefined, 0);

const prepare = Object.getOwnPropertyDescriptor(TaskDraftsController.prototype, "prepare")!;
Req()(TaskDraftsController.prototype, "prepare", 0);
Body()(TaskDraftsController.prototype, "prepare", 1);
Post()(TaskDraftsController.prototype, "prepare", prepare);

const confirm = Object.getOwnPropertyDescriptor(TaskDraftsController.prototype, "confirm")!;
Req()(TaskDraftsController.prototype, "confirm", 0);
Param("id")(TaskDraftsController.prototype, "confirm", 1);
Body()(TaskDraftsController.prototype, "confirm", 2);
Post(":id/confirm")(TaskDraftsController.prototype, "confirm", confirm);

function actor(request: Request) {
  return { userId: request.principal.userId, active: request.principal.active };
}
