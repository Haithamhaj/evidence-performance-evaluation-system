import { AppError, ProgressContractAiDraftOutputSchema } from "@evaluation/contracts";
import { ProgressContractDraftService } from "@evaluation/projects";
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  SetMetadata,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";

import { PROJECT_POLICY_ACTION, ProjectPolicyGuard } from "./project-policy-loaders.js";
import { ProjectsAuthenticationGuard } from "./projects-authentication.guard.js";

type ProjectRequest = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

const UuidSchema = z.string().uuid();
const CreateBodySchema = z
  .object({
    idempotencyKey: z.string().trim().min(1).max(200),
    documentVersionId: UuidSchema,
    sourceChecksum: z.string().regex(/^[a-f0-9]{64}$/u),
    locale: z.enum(["ar", "en"]),
    timezone: z.string().trim().min(1).max(100),
    effectiveAt: z.iso.datetime({ offset: true }),
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();
const PublicComponentSchema = z
  .object({
    position: z.number().int().positive().max(12),
    kind: z.enum(["milestone", "deliverable", "operational_kpi"]),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(2_000),
    weight: z.number().nonnegative().max(100).nullable(),
    baseline: z.number().finite().nullable(),
    target: z.number().finite().nullable(),
    unit: z.string().trim().min(1).max(80).nullable(),
    direction: z.enum(["increase", "decrease", "maintain"]).nullable(),
    acceptanceConditions: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
    requiredEvidence: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
    confirmationMode: z.enum(["deterministic", "human_confirmed"]),
  })
  .strict();
const PublicContentSchema = z
  .object({
    components: z.array(PublicComponentSchema).min(1).max(12),
    ambiguities: z.array(z.string().trim().min(1).max(500)).max(12),
    clarificationQuestions: z.array(z.string().trim().min(1).max(500)).max(12),
  })
  .strict()
  .superRefine((value, context) => {
    const positions = value.components.map(({ position }) => position);
    if (
      new Set(positions).size !== positions.length ||
      positions.some((position, index) => position !== index + 1)
    ) {
      context.addIssue({
        code: "custom",
        path: ["components"],
        message: "Component positions must be unique and sequential",
      });
    }
  });
const RevisionBodySchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    content: PublicContentSchema,
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();
const ApplyBodySchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    selectedRevision: z.number().int().positive(),
    calculationKind: z.enum(["weighted", "stage_gate"]),
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();
const RejectBodySchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();

export class ProgressContractDraftsController {
  private readonly service: ProgressContractDraftService;

  constructor(service: ProgressContractDraftService) {
    this.service = service;
  }

  async create(request: ProjectRequest, projectId: string, body: unknown) {
    const parsed = parseInput(CreateBodySchema, body);
    const receipt = await this.service.requestDraft({
      actor: actor(request),
      correlationId: request.correlationId,
      projectId: parseId(projectId),
      ...parsed,
    });
    return toPublicReceipt(receipt);
  }

  async get(request: ProjectRequest, projectId: string, requestId: string) {
    const receipt = await this.service.getDraft({
      actor: actor(request),
      correlationId: request.correlationId,
      projectId: parseId(projectId),
      requestId: parseId(requestId),
    });
    return toPublicReceipt(receipt);
  }

  async revise(request: ProjectRequest, projectId: string, requestId: string, body: unknown) {
    const ids = { projectId: parseId(projectId), requestId: parseId(requestId) };
    const parsed = parseInput(RevisionBodySchema, body);
    const current = await this.service.getDraft({
      actor: actor(request),
      correlationId: request.correlationId,
      ...ids,
    });
    if (current.content === null || current.revision !== parsed.expectedRevision) {
      throw new AppError(
        "PROGRESS_CONTRACT_AI_DRAFT_REVISION_CONFLICT",
        "errors.progressContractDraft.revisionConflict",
        409,
      );
    }
    const content = mergePublicRevision(current.content, parsed.content);
    return toPublicReceipt(
      await this.service.reviseDraft({
        actor: actor(request),
        correlationId: request.correlationId,
        requestId: ids.requestId,
        expectedRevision: parsed.expectedRevision,
        content,
        reason: parsed.reason,
      }),
    );
  }

  async applyRevision(
    request: ProjectRequest,
    projectId: string,
    requestId: string,
    body: unknown,
  ) {
    const ids = { projectId: parseId(projectId), requestId: parseId(requestId) };
    const parsed = parseInput(ApplyBodySchema, body);
    await this.service.getDraft({
      actor: actor(request),
      correlationId: request.correlationId,
      ...ids,
    });
    const result = await this.service.applyRevision({
      actor: actor(request),
      correlationId: request.correlationId,
      requestId: ids.requestId,
      ...parsed,
    });
    return {
      requestId: result.requestId,
      selectedRevision: result.selectedRevision,
      contract: { id: result.contractId, state: result.contractState, version: 1 as const },
    };
  }

  async reject(request: ProjectRequest, projectId: string, requestId: string, body: unknown) {
    const ids = { projectId: parseId(projectId), requestId: parseId(requestId) };
    const parsed = parseInput(RejectBodySchema, body);
    await this.service.getDraft({
      actor: actor(request),
      correlationId: request.correlationId,
      ...ids,
    });
    return toPublicReceipt(
      await this.service.rejectDraft({
        actor: actor(request),
        correlationId: request.correlationId,
        requestId: ids.requestId,
        ...parsed,
      }),
    );
  }
}

function mergePublicRevision(
  current: import("@evaluation/contracts").ProgressContractAiDraftOutput,
  edited: z.infer<typeof PublicContentSchema>,
): import("@evaluation/contracts").ProgressContractAiDraftOutput {
  if (current.components.length !== edited.components.length) {
    throw inputError();
  }
  return parseInput(ProgressContractAiDraftOutputSchema, {
    components: edited.components.map(({ position, ...component }) => {
      const hidden = current.components[position - 1];
      if (hidden === undefined) throw inputError();
      return {
        ...component,
        clientKey: hidden.clientKey,
        proposedSourceMappings: hidden.proposedSourceMappings,
        sourceReferences: hidden.sourceReferences,
      };
    }),
    ambiguities: edited.ambiguities,
    clarificationQuestions: edited.clarificationQuestions,
  });
}

function toPublicReceipt(receipt: import("@evaluation/projects").ProgressContractDraftReceipt) {
  const source = {
    label: "Approved Project document",
    version: receipt.sourceDocumentVersion,
  } as const;
  return {
    requestId: receipt.requestId,
    state: receipt.state,
    revision: receipt.revision,
    origin: receipt.origin,
    source,
    draft:
      receipt.content === null
        ? null
        : {
            components: receipt.content.components.map((component, index) => ({
              position: index + 1,
              kind: component.kind,
              name: component.name,
              description: component.description,
              weight: component.weight,
              baseline: component.baseline,
              target: component.target,
              unit: component.unit,
              direction: component.direction,
              acceptanceConditions: component.acceptanceConditions,
              requiredEvidence: component.requiredEvidence,
              confirmationMode: component.confirmationMode,
              sourceLabels: [`${source.label} · version ${source.version}`],
              automationHints: component.proposedSourceMappings.map((mapping) => ({
                source: mapping.source,
                event: mapping.event,
                repositoryLabel: mapping.repositoryRef,
                branchLabel: mapping.branchRef,
                checkLabels: mapping.checkNames,
              })),
            })),
            ambiguities: receipt.content.ambiguities,
            clarificationQuestions: receipt.content.clarificationQuestions,
          },
    contract:
      receipt.appliedContractId === null
        ? null
        : { id: receipt.appliedContractId, state: "draft" as const, version: 1 as const },
  };
}

function actor(request: ProjectRequest) {
  return { userId: request.principal.userId, active: request.principal.active };
}

function parseId(value: unknown): string {
  return parseInput(UuidSchema, value);
}

function parseInput<T>(schema: { parse(value: unknown): T }, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.name === "ZodError") throw inputError();
    throw error;
  }
}

function inputError() {
  return new AppError(
    "PROGRESS_CONTRACT_DRAFT_INPUT_INVALID",
    "errors.progressContractDraft.inputInvalid",
    400,
  );
}

Controller("api/v1/projects/:projectId/progress-contract-drafts")(ProgressContractDraftsController);
UseGuards(ProjectsAuthenticationGuard)(ProgressContractDraftsController);
Inject(ProgressContractDraftService)(ProgressContractDraftsController, undefined, 0);

const endpoints = [
  ["create", "", "project.manage", "post"],
  ["get", ":requestId", "resource.read", "get"],
  ["revise", ":requestId/revisions", "project.manage", "post"],
  ["applyRevision", ":requestId/apply", "project.manage", "post"],
  ["reject", ":requestId/reject", "project.manage", "post"],
] as const;

for (const [method, path, action, verb] of endpoints) {
  const descriptor = Object.getOwnPropertyDescriptor(
    ProgressContractDraftsController.prototype,
    method,
  )!;
  Req()(ProgressContractDraftsController.prototype, method, 0);
  Param("projectId")(ProgressContractDraftsController.prototype, method, 1);
  if (method !== "create") {
    Param("requestId")(ProgressContractDraftsController.prototype, method, 2);
  }
  if (!["get"].includes(method)) {
    Body()(ProgressContractDraftsController.prototype, method, method === "create" ? 2 : 3);
  }
  if (verb === "get") Get(path)(ProgressContractDraftsController.prototype, method, descriptor);
  else Post(path)(ProgressContractDraftsController.prototype, method, descriptor);
  SetMetadata(PROJECT_POLICY_ACTION, action)(
    ProgressContractDraftsController.prototype,
    method,
    descriptor,
  );
  UseGuards(ProjectPolicyGuard)(ProgressContractDraftsController.prototype, method, descriptor);
}
