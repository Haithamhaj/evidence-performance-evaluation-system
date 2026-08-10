import { AppError } from "@evaluation/contracts";
import {
  AppliedLearningService,
  ExperimentQueryService,
  ExperimentService,
  ResearchDecisionService,
  ResearchEvidenceLinkService,
  ResearchProposalConfirmationService,
  ResearchQueryService,
  ResearchService,
  ResearchSourceReviewService,
} from "@evaluation/research-experiments";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AppErrorFilter } from "../platform/error.filter.js";
import { CorrelationMiddleware } from "../platform/correlation.middleware.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { ExperimentsController } from "./experiments.controller.js";
import { ResearchRecordsController } from "./research-records.controller.js";
import { ResearchExperimentsPolicyGuard } from "./research-experiments-policy.guard.js";
import { SourceReviewsController } from "./source-reviews.controller.js";

const employeeId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const otherProjectId = crypto.randomUUID();
const correlationId = crypto.randomUUID();
const experimentId = crypto.randomUUID();
const create = vi.fn(async (command: unknown) => ({ id: crypto.randomUUID(), command }));
const readExperiment = vi.fn(async (command: unknown) => ({ id: experimentId, command }));

const authGuard = {
  canActivate(context: import("@nestjs/common").ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      principal?: unknown;
    }>();
    if (request.headers.authorization !== "Bearer valid") {
      throw new AppError("AUTH_REQUIRED", "errors.auth.required", 401);
    }
    request.principal = {
      userId: employeeId,
      active: request.headers["x-user-active"] !== "false",
    };
    return true;
  },
};

const query = {
  list: vi.fn(async ({ projectId: requestedProject }: { projectId: string }) => {
    if (requestedProject === otherProjectId) {
      throw new AppError("RESEARCH_SCOPE_FORBIDDEN", "errors.research.scopeForbidden", 403);
    }
    return [];
  }),
  read: vi.fn(),
};

class TestResearchModule {}
Module({
  controllers: [SourceReviewsController, ResearchRecordsController, ExperimentsController],
  providers: [
    { provide: AuthGuard, useValue: authGuard },
    ResearchExperimentsPolicyGuard,
    { provide: ResearchSourceReviewService, useValue: {} },
    { provide: ResearchService, useValue: { create } },
    { provide: ResearchQueryService, useValue: query },
    { provide: ExperimentService, useValue: {} },
    { provide: ExperimentQueryService, useValue: { read: readExperiment } },
    { provide: ResearchDecisionService, useValue: {} },
    { provide: AppliedLearningService, useValue: {} },
    { provide: ResearchEvidenceLinkService, useValue: {} },
    { provide: ResearchProposalConfirmationService, useValue: {} },
  ],
})(TestResearchModule);

let app: import("@nestjs/common").INestApplication | undefined;
let baseUrl = "";

beforeAll(async () => {
  app = await NestFactory.create(TestResearchModule, { abortOnError: false, logger: false });
  app.useGlobalFilters(new AppErrorFilter());
  const correlation = new CorrelationMiddleware();
  app.use(correlation.use.bind(correlation));
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as import("node:net").AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => app?.close());

describe("research experiments HTTP boundary", () => {
  it("rejects unauthenticated and inactive callers before domain execution", async () => {
    const unauthenticated = await fetch(`${baseUrl}/api/v1/research?projectId=${projectId}`);
    const inactive = await fetch(`${baseUrl}/api/v1/research?projectId=${projectId}`, {
      headers: { authorization: "Bearer valid", "x-user-active": "false" },
    });

    expect(unauthenticated.status).toBe(401);
    expect(inactive.status).toBe(403);
    expect(query.list).not.toHaveBeenCalled();
  });

  it("propagates authenticated actor and correlation into a valid command", async () => {
    const response = await fetch(`${baseUrl}/api/v1/research`, {
      method: "POST",
      headers: {
        authorization: "Bearer valid",
        "content-type": "application/json",
        "x-correlation-id": correlationId,
      },
      body: JSON.stringify(validCreateResearch()),
    });

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { userId: employeeId, active: true },
        correlationId,
      }),
    );
  });

  it("returns a safe correlated input envelope and does not execute malformed commands", async () => {
    create.mockClear();
    const response = await fetch(`${baseUrl}/api/v1/research`, {
      method: "POST",
      headers: {
        authorization: "Bearer valid",
        "content-type": "application/json",
        "x-correlation-id": correlationId,
      },
      body: JSON.stringify({ scope: { projectId } }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "RESEARCH_INPUT_INVALID",
      messageKey: "errors.research.inputInvalid",
      correlationId,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("does not leak cross-project data through list errors", async () => {
    const response = await fetch(`${baseUrl}/api/v1/research?projectId=${otherProjectId}`, {
      headers: { authorization: "Bearer valid", "x-correlation-id": correlationId },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: "RESEARCH_SCOPE_FORBIDDEN",
      messageKey: "errors.research.scopeForbidden",
      correlationId,
    });
  });

  it("allows the authenticated employee to read the governed Experiment route", async () => {
    readExperiment.mockClear();
    const response = await fetch(`${baseUrl}/api/v1/experiments/${experimentId}`, {
      headers: { authorization: "Bearer valid", "x-correlation-id": correlationId },
    });

    expect(response.status).toBe(200);
    expect(readExperiment).toHaveBeenCalledWith({
      actor: { userId: employeeId, active: true },
      experimentId,
    });
  });

  it("denies an unauthenticated caller before the Experiment route executes", async () => {
    readExperiment.mockClear();
    const response = await fetch(`${baseUrl}/api/v1/experiments/${experimentId}`);

    expect(response.status).toBe(401);
    expect(readExperiment).not.toHaveBeenCalled();
  });
});

function validCreateResearch() {
  return {
    scope: { projectId, workstreamId: null, workItemId: null },
    idempotencyKey: crypto.randomUUID(),
    problemStatement: "Choose a reliable implementation approach.",
    context: "The project needs a source-supported decision.",
    question: "Which approach should the team validate?",
    objective: "Reach a documented human decision.",
    hypothesis: { kind: "TESTABLE", statement: "The bounded approach is viable." },
    assumptions: [],
    constraints: ["Do not infer employee performance."],
    knownUncertainty: ["Production load is not measured yet."],
    alternatives: ["Retain the current approach."],
    decisionQuestion: "Should the project adopt the bounded approach?",
    sourceReferences: [],
    executionMode: "ai_assisted",
  };
}
