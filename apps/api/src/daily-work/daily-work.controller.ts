import {
  AppError,
  ProgressContractDecisionInputSchema,
  ProgressContractDraftSchema,
} from "@evaluation/contracts";
import { ProgressContractService } from "@evaluation/projects";
import { CheckInService } from "@evaluation/updates-evidence";
import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { WorkItemsPolicyGuard } from "../work-items/work-items-policy.guard.js";
import { DailyWorkQueryService } from "./daily-work-query.service.js";
import { EmployeeHomeQueryService } from "./employee-home-query.service.js";
import { ProjectExperienceQueryService } from "./project-experience-query.service.js";
import { ManagerOperationsQueryService } from "./manager-operations-query.service.js";
import { ReadinessQueryService } from "./readiness-query.service.js";
import { AuthoritativeOperationsEventPublisher } from "../operations/authoritative-event-publisher.js";

type Request = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

const ProposalBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(1_000),
    draft: ProgressContractDraftSchema,
  })
  .strict();

export class DailyWorkController {
  private readonly query: DailyWorkQueryService;
  private readonly checkIns: Pick<CheckInService, "listForEmployee"> | undefined;
  private readonly readiness: Pick<ReadinessQueryService, "employeeProjectMonth"> | undefined;
  private readonly managerOperations: Pick<ManagerOperationsQueryService, "load"> | undefined;
  private readonly operationsEvents: AuthoritativeOperationsEventPublisher | undefined;
  private readonly employeeHome: EmployeeHomeQueryService | undefined;
  private readonly projectExperience: ProjectExperienceQueryService | undefined;

  constructor(
    query: DailyWorkQueryService,
    checkIns?: Pick<CheckInService, "listForEmployee">,
    readiness?: Pick<ReadinessQueryService, "employeeProjectMonth">,
    managerOperations?: Pick<ManagerOperationsQueryService, "load">,
    operationsEvents?: AuthoritativeOperationsEventPublisher,
    employeeHome?: EmployeeHomeQueryService,
    projectExperience?: ProjectExperienceQueryService,
  ) {
    this.query = query;
    this.checkIns = checkIns;
    this.readiness = readiness;
    this.managerOperations = managerOperations;
    this.operationsEvents = operationsEvents;
    this.employeeHome = employeeHome;
    this.projectExperience = projectExperience;
  }

  myWork(request: Request): Promise<import("@evaluation/contracts").DailyWorkspaceSnapshot> {
    return this.query.dailyWorkspace(dailyWorkspaceActor(request));
  }

  home(request: Request): Promise<import("@evaluation/contracts").EmployeeHomeV1> {
    if (this.employeeHome === undefined) throw new Error("Employee Home service is not configured");
    return this.employeeHome.load(employeeHomeActor(request));
  }

  updateContext(request: Request): Promise<import("@evaluation/contracts").UpdateComposerContext> {
    return this.query.updateContext(request.principal.userId);
  }

  projects(request: Request): Promise<unknown> {
    return this.query.projects(request.principal.userId);
  }

  project(request: Request, projectId: string): Promise<unknown> {
    return this.query.project(request.principal.userId, z.string().uuid().parse(projectId));
  }

  projectExperienceView(request: Request, projectId: string) {
    if (this.projectExperience === undefined)
      throw new Error("Project Experience service is not configured");
    return this.projectExperience.load(
      { userId: request.principal.userId, active: request.principal.active },
      z.string().uuid().parse(projectId),
    );
  }

  async checkInObligations(request: Request) {
    if (this.checkIns === undefined) throw new Error("Check-in service is not configured");
    const obligations = await this.checkIns.listForEmployee({
      employeeId: request.principal.userId,
    });
    await this.operationsEvents?.publishDueCheckIns(request.principal.userId, obligations);
    return obligations;
  }

  readinessForProject(request: Request, projectId: string) {
    if (this.readiness === undefined) throw new Error("Readiness service is not configured");
    return this.readiness.employeeProjectMonth(
      request.principal.userId,
      z.string().uuid().parse(projectId),
    );
  }

  managerOperationsView(request: Request) {
    if (this.managerOperations === undefined) {
      throw new Error("Manager operations service is not configured");
    }
    return this.managerOperations.load(request.principal.userId);
  }
}

export class ProgressContractsController {
  private readonly service: ProgressContractService;

  constructor(service: ProgressContractService) {
    this.service = service;
  }

  propose(request: Request, projectId: string, body: unknown) {
    const id = z.string().uuid().parse(projectId);
    const parsed = ProposalBodySchema.parse(body);
    if (parsed.draft.projectId !== id)
      throw new AppError("SCOPE_MISMATCH", "errors.authorization.scopeMismatch", 403);
    return this.service.propose({
      actor: progressContractActor(request),
      correlationId: request.correlationId,
      reason: parsed.reason,
      draft: parsed.draft,
    });
  }

  submit(request: Request, projectId: string, contractId: string, body: unknown) {
    return this.decision("submit", request, projectId, contractId, body);
  }

  approve(request: Request, projectId: string, contractId: string, body: unknown) {
    return this.decision("approve", request, projectId, contractId, body);
  }

  reject(request: Request, projectId: string, contractId: string, body: unknown) {
    return this.decision("reject", request, projectId, contractId, body);
  }

  private decision(
    kind: "submit" | "approve" | "reject",
    request: Request,
    projectId: string,
    contractId: string,
    body: unknown,
  ) {
    const id = z.string().uuid().parse(projectId);
    const command = {
      actor: progressContractActor(request),
      correlationId: request.correlationId,
      projectId: id,
      contractId: z.string().uuid().parse(contractId),
      input: ProgressContractDecisionInputSchema.parse(body),
    };
    return kind === "submit"
      ? this.service.submitForApproval(command)
      : kind === "approve"
        ? this.service.approve(command)
        : this.service.reject(command);
  }
}

function progressContractActor(request: Request) {
  return {
    userId: request.principal.userId,
    active: request.principal.active,
  };
}

function dailyWorkspaceActor(request: Request) {
  return {
    userId: request.principal.userId,
    active: request.principal.active,
    roles: request.principal.roles,
  };
}

function employeeHomeActor(request: Request) {
  return {
    ...dailyWorkspaceActor(request),
    email: request.principal.email,
  };
}

Controller("api/v1/daily-work")(DailyWorkController);
UseGuards(WorkItemsPolicyGuard)(DailyWorkController);
Inject(DailyWorkQueryService)(DailyWorkController, undefined, 0);
Inject(CheckInService)(DailyWorkController, undefined, 1);
Inject(ReadinessQueryService)(DailyWorkController, undefined, 2);
Inject(ManagerOperationsQueryService)(DailyWorkController, undefined, 3);
Inject(AuthoritativeOperationsEventPublisher)(DailyWorkController, undefined, 4);
Inject(EmployeeHomeQueryService)(DailyWorkController, undefined, 5);
Inject(ProjectExperienceQueryService)(DailyWorkController, undefined, 6);

const myWork = Object.getOwnPropertyDescriptor(DailyWorkController.prototype, "myWork")!;
Req()(DailyWorkController.prototype, "myWork", 0);
Get("my-work")(DailyWorkController.prototype, "myWork", myWork);

const home = Object.getOwnPropertyDescriptor(DailyWorkController.prototype, "home")!;
Req()(DailyWorkController.prototype, "home", 0);
Get("home")(DailyWorkController.prototype, "home", home);

const updateContext = Object.getOwnPropertyDescriptor(
  DailyWorkController.prototype,
  "updateContext",
)!;
Req()(DailyWorkController.prototype, "updateContext", 0);
Get("update-context")(DailyWorkController.prototype, "updateContext", updateContext);

const projects = Object.getOwnPropertyDescriptor(DailyWorkController.prototype, "projects")!;
Req()(DailyWorkController.prototype, "projects", 0);
Get("projects")(DailyWorkController.prototype, "projects", projects);

const project = Object.getOwnPropertyDescriptor(DailyWorkController.prototype, "project")!;
Req()(DailyWorkController.prototype, "project", 0);
Param("projectId")(DailyWorkController.prototype, "project", 1);
Get("projects/:projectId")(DailyWorkController.prototype, "project", project);

const projectExperienceView = Object.getOwnPropertyDescriptor(
  DailyWorkController.prototype,
  "projectExperienceView",
)!;
Req()(DailyWorkController.prototype, "projectExperienceView", 0);
Param("projectId")(DailyWorkController.prototype, "projectExperienceView", 1);
Get("projects/:projectId/experience")(
  DailyWorkController.prototype,
  "projectExperienceView",
  projectExperienceView,
);

const checkInObligations = Object.getOwnPropertyDescriptor(
  DailyWorkController.prototype,
  "checkInObligations",
)!;
Req()(DailyWorkController.prototype, "checkInObligations", 0);
Get("check-ins")(DailyWorkController.prototype, "checkInObligations", checkInObligations);

const readinessForProject = Object.getOwnPropertyDescriptor(
  DailyWorkController.prototype,
  "readinessForProject",
)!;
Req()(DailyWorkController.prototype, "readinessForProject", 0);
Param("projectId")(DailyWorkController.prototype, "readinessForProject", 1);
Get("projects/:projectId/readiness")(
  DailyWorkController.prototype,
  "readinessForProject",
  readinessForProject,
);

const managerOperationsView = Object.getOwnPropertyDescriptor(
  DailyWorkController.prototype,
  "managerOperationsView",
)!;
Req()(DailyWorkController.prototype, "managerOperationsView", 0);
Get("manager/operations")(
  DailyWorkController.prototype,
  "managerOperationsView",
  managerOperationsView,
);

Controller("api/v1/projects")(ProgressContractsController);
UseGuards(WorkItemsPolicyGuard)(ProgressContractsController);
Inject(ProgressContractService)(ProgressContractsController, undefined, 0);

for (const [method, path] of [
  ["propose", ":projectId/progress-contracts"],
  ["submit", ":projectId/progress-contracts/:contractId/submit"],
  ["approve", ":projectId/progress-contracts/:contractId/approve"],
  ["reject", ":projectId/progress-contracts/:contractId/reject"],
] as const) {
  const descriptor = Object.getOwnPropertyDescriptor(
    ProgressContractsController.prototype,
    method,
  )!;
  Req()(ProgressContractsController.prototype, method, 0);
  Param("projectId")(ProgressContractsController.prototype, method, 1);
  if (method !== "propose") Param("contractId")(ProgressContractsController.prototype, method, 2);
  Body()(ProgressContractsController.prototype, method, method === "propose" ? 2 : 3);
  Post(path)(ProgressContractsController.prototype, method, descriptor);
}
