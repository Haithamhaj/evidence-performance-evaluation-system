import {
  AppError,
  ConcludeResearchInputSchema,
  CreateAppliedLearningInputSchema,
  CreateExperimentInputSchema,
  CreateResearchInputSchema,
  CreateWorkItemInputSchema,
  LinkResearchEvidenceInputSchema,
  ReviseExperimentMethodInputSchema,
  ReviseResearchInputSchema,
  TransferResearchOwnerInputSchema,
  TransitionResearchInputSchema,
} from "@evaluation/contracts";
import {
  AddResearchSourceInputSchema,
  ExperimentService,
  AppliedLearningService,
  ResearchDecisionService,
  ResearchEvidenceLinkService,
  ResearchProposalConfirmationService,
  ResearchQueryService,
  ResearchService,
} from "@evaluation/research-experiments";
import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { ResearchExperimentsPolicyGuard } from "./research-experiments-policy.guard.js";

type Request = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

const ListResearchInputSchema = z
  .object({ projectId: z.string().uuid(), workstreamId: z.string().uuid().optional() })
  .strict();
const RetractionInputSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();
const ParticipantInputSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    employeeId: z.string().uuid(),
    action: z.enum(["ADD", "REMOVE"]),
    effectiveAt: z.iso.datetime({ offset: true }),
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();
const ConfirmWorkItemInputSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    researchId: z.string().uuid(),
    researchConclusionId: z.string().uuid(),
    researchExpectedVersion: z.number().int().positive(),
    editedTask: CreateWorkItemInputSchema,
    reason: z.string().trim().min(1).max(1_000),
    whatChanged: z.string().trim().min(1).max(8_000),
    causalRationale: z.string().trim().min(1).max(8_000),
  })
  .strict();
const CreateExperimentEnvelopeSchema = z
  .object({ input: CreateExperimentInputSchema, method: z.unknown() })
  .strict();

type ResearchServices = Readonly<{
  research: ResearchService;
  query: ResearchQueryService;
  experiments: ExperimentService;
  decisions: ResearchDecisionService;
  learning: AppliedLearningService;
  evidence: ResearchEvidenceLinkService;
  proposals: ResearchProposalConfirmationService;
}>;

export class ResearchRecordsController {
  private readonly services: ResearchServices;

  constructor(
    research: ResearchService,
    query: ResearchQueryService,
    experiments: ExperimentService,
    decisions: ResearchDecisionService,
    learning: AppliedLearningService,
    evidence: ResearchEvidenceLinkService,
    proposals: ResearchProposalConfirmationService,
  ) {
    this.services = { research, query, experiments, decisions, learning, evidence, proposals };
  }

  async create(request: Request, body: unknown) {
    return this.services.research.create({
      actor: actor(request),
      correlationId: request.correlationId,
      input: parseInput(CreateResearchInputSchema, body),
    });
  }

  async list(request: Request, query: unknown) {
    const input = parseInput(ListResearchInputSchema, query);
    const records = await this.services.query.list({
      actor: actor(request),
      projectId: input.projectId,
    });
    return input.workstreamId === undefined
      ? records
      : records.filter(({ workstreamId }) => workstreamId === input.workstreamId);
  }

  async get(request: Request, researchId: string) {
    return this.services.query.read({ actor: actor(request), researchId: parseUuid(researchId) });
  }

  async revise(request: Request, researchId: string, body: unknown) {
    return this.services.research.revise({
      actor: actor(request),
      correlationId: request.correlationId,
      researchId: parseUuid(researchId),
      input: parseInput(ReviseResearchInputSchema, body),
    });
  }

  async prepareFrame(request: Request, researchId: string) {
    return this.services.research.prepareFrame(command(request, researchId));
  }

  async prepareSynthesis(request: Request, researchId: string) {
    return this.services.research.prepareSynthesis(command(request, researchId));
  }

  async addSource(request: Request, researchId: string, body: unknown) {
    return this.services.research.addSource({
      ...command(request, researchId),
      input: parseInput(AddResearchSourceInputSchema, body),
    });
  }

  async retractSource(request: Request, researchId: string, sourceId: string, body: unknown) {
    return this.services.research.retractSource({
      ...command(request, researchId),
      sourceReferenceId: parseUuid(sourceId),
      input: parseInput(RetractionInputSchema, body),
    });
  }

  async transition(request: Request, researchId: string, body: unknown) {
    return this.services.research.transition({
      ...command(request, researchId),
      input: parseInput(TransitionResearchInputSchema, body),
    });
  }

  async transferOwner(request: Request, researchId: string, body: unknown) {
    return this.services.research.transferOwner({
      ...command(request, researchId),
      input: parseInput(TransferResearchOwnerInputSchema, body),
    });
  }

  async changeParticipant(request: Request, researchId: string, body: unknown) {
    return this.services.research.changeContributor({
      ...command(request, researchId),
      input: parseInput(ParticipantInputSchema, body),
    });
  }

  async createExperiment(request: Request, researchId: string, body: unknown) {
    const envelope = parseInput(CreateExperimentEnvelopeSchema, body);
    const pathResearchId = parseUuid(researchId);
    if (envelope.input.researchId !== pathResearchId) throw invalidInput();
    const parsedMethod = parseInput(ReviseExperimentMethodInputSchema, {
      ...(isRecord(envelope.method) ? envelope.method : {}),
      expectedVersion: 1,
    });
    const { expectedVersion, ...method } = parsedMethod;
    void expectedVersion;
    return this.services.experiments.create({
      actor: actor(request),
      correlationId: request.correlationId,
      input: envelope.input,
      method,
    });
  }

  async conclude(request: Request, researchId: string, body: unknown) {
    return this.services.decisions.conclude({
      ...command(request, researchId),
      input: parseInput(ConcludeResearchInputSchema, body),
    });
  }

  async applyLearning(request: Request, researchId: string, body: unknown) {
    return this.services.learning.create({
      ...command(request, researchId),
      input: parseInput(CreateAppliedLearningInputSchema, body),
    });
  }

  async linkEvidence(request: Request, researchId: string, body: unknown) {
    return this.services.evidence.link({
      ...command(request, researchId),
      input: parseInput(LinkResearchEvidenceInputSchema, body),
    });
  }

  async confirmWorkItem(request: Request, proposalId: string, body: unknown) {
    const input = parseInput(ConfirmWorkItemInputSchema, body);
    return this.services.proposals.confirmWorkItemProposal({
      actor: actor(request),
      correlationId: request.correlationId,
      proposalId: parseUuid(proposalId),
      ...input,
    });
  }
}

Controller("api/v1/research")(ResearchRecordsController);
UseGuards(ResearchExperimentsPolicyGuard)(ResearchRecordsController);
Inject(ResearchService)(ResearchRecordsController, undefined, 0);
Inject(ResearchQueryService)(ResearchRecordsController, undefined, 1);
Inject(ExperimentService)(ResearchRecordsController, undefined, 2);
Inject(ResearchDecisionService)(ResearchRecordsController, undefined, 3);
Inject(AppliedLearningService)(ResearchRecordsController, undefined, 4);
Inject(ResearchEvidenceLinkService)(ResearchRecordsController, undefined, 5);
Inject(ResearchProposalConfirmationService)(ResearchRecordsController, undefined, 6);

decorate("create", Post(), [Req(), Body()]);
decorate("list", Get(), [Req(), Query()]);
decorate("get", Get(":id"), [Req(), Param("id")]);
decorate("revise", Post(":id/revisions"), [Req(), Param("id"), Body()]);
decorate("prepareFrame", Post(":id/frame-drafts"), [Req(), Param("id")]);
decorate("prepareSynthesis", Post(":id/synthesis-drafts"), [Req(), Param("id")]);
decorate("addSource", Post(":id/sources"), [Req(), Param("id"), Body()]);
decorate("retractSource", Post(":id/sources/:sourceId/retract"), [
  Req(),
  Param("id"),
  Param("sourceId"),
  Body(),
]);
decorate("transition", Post(":id/transitions"), [Req(), Param("id"), Body()]);
decorate("transferOwner", Post(":id/owner-transfers"), [Req(), Param("id"), Body()]);
decorate("changeParticipant", Post(":id/participants"), [Req(), Param("id"), Body()]);
decorate("createExperiment", Post(":id/experiments"), [Req(), Param("id"), Body()]);
decorate("conclude", Post(":id/conclusions"), [Req(), Param("id"), Body()]);
decorate("applyLearning", Post(":id/applied-learning"), [Req(), Param("id"), Body()]);
decorate("linkEvidence", Post(":id/evidence-links"), [Req(), Param("id"), Body()]);
decorate("confirmWorkItem", Post("proposals/:id/confirm-work-item"), [Req(), Param("id"), Body()]);

function command(request: Request, researchId: string) {
  return {
    actor: actor(request),
    correlationId: request.correlationId,
    researchId: parseUuid(researchId),
  };
}

function actor(request: Request) {
  return { userId: request.principal.userId, active: request.principal.active };
}

function parseUuid(value: unknown): string {
  return parseInput(z.string().uuid(), value);
}

function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw invalidInput();
  return parsed.data;
}

function invalidInput() {
  return new AppError("RESEARCH_INPUT_INVALID", "errors.research.inputInvalid", 400);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decorate(
  methodName: keyof ResearchRecordsController,
  methodDecorator: MethodDecorator,
  parameters: readonly ParameterDecorator[],
) {
  const descriptor = Object.getOwnPropertyDescriptor(
    ResearchRecordsController.prototype,
    methodName,
  )!;
  parameters.forEach((parameter, index) =>
    parameter(ResearchRecordsController.prototype, methodName, index),
  );
  methodDecorator(ResearchRecordsController.prototype, methodName, descriptor);
}
