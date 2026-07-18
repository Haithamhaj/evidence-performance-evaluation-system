import { AppError } from "@evaluation/contracts";
import { decide } from "@evaluation/permissions";
import { Inject, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { z } from "zod";

export const ANALYSIS_CRITERIA_POLICY_DATABASE = Symbol("ANALYSIS_CRITERIA_POLICY_DATABASE");
export const ANALYSIS_CRITERIA_POLICY_ACTION = Symbol("ANALYSIS_CRITERIA_POLICY_ACTION");

export type AnalysisCriteriaPolicyAction =
  | "document.analysis.run"
  | "document.readiness.detail.read"
  | "document.readiness.summary.read"
  | "document.comparison.review"
  | "criteria.generate"
  | "criteria.owner.review"
  | "criteria.contributor.respond"
  | "criteria.manager.resolve"
  | "criteria.activate"
  | "criteria.read";

type GuardRequest = Readonly<{
  principal?: import("@evaluation/auth").AuthenticatedPrincipal;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
}>;

export class AnalysisCriteriaPolicyGuard {
  private readonly reflector: Reflector;
  private readonly database: import("@evaluation/database").DatabaseClient;

  constructor(reflector: Reflector, database: import("@evaluation/database").DatabaseClient) {
    this.reflector = reflector;
    this.database = database;
  }

  async canActivate(context: import("@nestjs/common").ExecutionContext): Promise<boolean> {
    const action = this.reflector.get<AnalysisCriteriaPolicyAction | undefined>(
      ANALYSIS_CRITERIA_POLICY_ACTION,
      context.getHandler(),
    );
    if (action === undefined) throw authorizationError("ROLE_REQUIRED");
    const request = context.switchToHttp().getRequest<GuardRequest>();
    const principal = request.principal;
    if (principal === undefined) throw authorizationError("UNAUTHENTICATED");
    if (!principal.active) throw authorizationError("INACTIVE");

    const roles = await this.database.roleAssignment.findMany({
      where: { userId: principal.userId },
      select: { role: true, scopeType: true, scopeId: true },
    });
    const loaded = await this.loadResource(action, request, principal.userId);
    const decision = decide(
      { subjectId: principal.userId, active: principal.active, roles },
      action,
      loaded.resource,
      {
        now: new Date().toISOString(),
        responsibilityWindows: loaded.windows,
      },
    );
    if (!decision.allowed) throw authorizationError(decision.reasonCode);
    return true;
  }

  private async loadResource(
    action: AnalysisCriteriaPolicyAction,
    request: GuardRequest,
    actorId: string,
  ): Promise<LoadedPolicyResource> {
    if (action.startsWith("document.")) {
      return this.loadDocument(parseUuid(request.params?.documentId), actorId);
    }
    if (action === "criteria.generate") {
      const kind = parseKind(request.body?.kind);
      return this.loadCriteriaResource(kind, parseUuid(request.body?.resourceId), actorId);
    }
    if (action === "criteria.read") {
      const kind = parseKind(request.query?.kind);
      return this.loadCriteriaResource(kind, parseUuid(request.query?.resourceId), actorId);
    }
    if (request.params?.proposalId !== undefined) {
      return this.loadProposal(
        parseUuid(request.params.proposalId),
        actorId,
        action === "criteria.contributor.respond",
      );
    }
    const kind = parseKind(request.body?.kind);
    return this.loadCriteriaResource(kind, parseUuid(request.body?.resourceId), actorId);
  }

  private async loadDocument(documentId: string, actorId: string): Promise<LoadedPolicyResource> {
    const document = await this.database.documentRecord.findUnique({
      where: { id: documentId },
      select: {
        projectId: true,
        workstreamId: true,
        departmentId: true,
        workstream: { select: { projectId: true } },
      },
    });
    if (document === null) throw authorizationError("SCOPE_MISMATCH");
    if (document.projectId !== null) {
      return this.loadCriteriaResource("project", document.projectId, actorId);
    }
    if (document.workstreamId !== null) {
      return this.loadCriteriaResource("workstream", document.workstreamId, actorId);
    }
    throw authorizationError("RESOURCE_STATE");
  }

  private async loadProposal(
    proposalId: string,
    actorId: string,
    requireContributorEligibility: boolean,
  ): Promise<LoadedPolicyResource> {
    const proposal = await this.database.dynamicCriteriaProposal.findUnique({
      where: { id: proposalId },
      select: {
        kind: true,
        projectId: true,
        workstreamId: true,
        reviewSnapshot: {
          select: {
            id: true,
            eligibility: {
              where: { employeeId: actorId, responseRequired: true },
              select: { employeeId: true },
            },
          },
        },
      },
    });
    if (proposal === null) throw authorizationError("SCOPE_MISMATCH");
    const resourceId = proposal.kind === "project" ? proposal.projectId : proposal.workstreamId;
    if (resourceId === null) throw authorizationError("RESOURCE_STATE");
    const loaded = await this.loadCriteriaResource(proposal.kind, resourceId, actorId);
    if (!requireContributorEligibility) return loaded;
    if (
      proposal.kind !== "workstream" ||
      proposal.reviewSnapshot === null ||
      proposal.reviewSnapshot.eligibility.length !== 1 ||
      loaded.resource.kind !== "workstream"
    ) {
      throw authorizationError("SCOPE_MISMATCH");
    }
    return {
      windows: loaded.windows,
      resource: {
        kind: "criteriaReviewSnapshot",
        reviewSnapshotId: proposal.reviewSnapshot.id,
        workstreamId: loaded.resource.workstreamId,
        projectId: loaded.resource.projectId,
        departmentId: loaded.resource.departmentId,
      },
    };
  }

  private async loadCriteriaResource(
    kind: "project" | "workstream",
    resourceId: string,
    actorId: string,
  ): Promise<LoadedPolicyResource> {
    let departmentId: string;
    let projectId: string;
    if (kind === "project") {
      const project = await this.database.project.findUnique({
        where: { id: resourceId },
        select: { id: true, departmentId: true },
      });
      if (project === null) throw authorizationError("SCOPE_MISMATCH");
      departmentId = project.departmentId;
      projectId = project.id;
    } else {
      const workstream = await this.database.workstream.findUnique({
        where: { id: resourceId },
        select: {
          id: true,
          projectId: true,
          project: { select: { departmentId: true } },
        },
      });
      if (workstream === null) throw authorizationError("SCOPE_MISMATCH");
      departmentId = workstream.project.departmentId;
      projectId = workstream.projectId;
    }
    const departmentScope = await this.database.authorizationScope.findFirst({
      where: { departmentId, scopeType: "department" },
      select: { id: true },
    });
    if (departmentScope === null) throw authorizationError("RESOURCE_STATE");
    const windows = await this.database.responsibilityWindow.findMany({
      where:
        kind === "project"
          ? {
              employeeId: actorId,
              OR: [{ projectId: resourceId }, { workstream: { projectId: resourceId } }],
            }
          : {
              employeeId: actorId,
              OR: [{ projectId }, { workstreamId: resourceId }],
            },
      select: {
        projectId: true,
        workstreamId: true,
        responsibilityType: true,
        startsAt: true,
        endsAt: true,
      },
    });
    const policyWindows = windows.map((window) => {
      const workstreamScoped = window.workstreamId !== null;
      return {
        subjectId: actorId,
        scopeType: workstreamScoped ? ("workstream" as const) : ("project" as const),
        scopeId: workstreamScoped ? window.workstreamId! : window.projectId!,
        ...(workstreamScoped ? { projectId } : {}),
        responsibilityType: window.responsibilityType,
        startsAt: window.startsAt.toISOString(),
        endsAt: window.endsAt?.toISOString() ?? null,
      };
    });
    return kind === "project"
      ? {
          resource: {
            kind: "project",
            projectId: resourceId,
            departmentId: departmentScope.id,
          },
          windows: policyWindows,
        }
      : {
          resource: {
            kind: "workstream",
            workstreamId: resourceId,
            projectId,
            departmentId: departmentScope.id,
          },
          windows: policyWindows,
        };
  }
}

export function AnalysisCriteriaPolicy(action: AnalysisCriteriaPolicyAction): MethodDecorator {
  return SetMetadata(ANALYSIS_CRITERIA_POLICY_ACTION, action);
}

type LoadedPolicyResource = Readonly<{
  resource: import("@evaluation/permissions").PolicyResource;
  windows: ReadonlyArray<import("@evaluation/permissions").ResponsibilityAccessWindow>;
}>;

const UuidSchema = z.string().uuid();
const KindSchema = z.enum(["project", "workstream"]);

function parseUuid(value: unknown): string {
  const parsed = UuidSchema.safeParse(value);
  if (!parsed.success) throw inputError();
  return parsed.data;
}

function parseKind(value: unknown): "project" | "workstream" {
  const parsed = KindSchema.safeParse(value);
  if (!parsed.success) throw inputError();
  return parsed.data;
}

function inputError(): AppError {
  return new AppError(
    "ANALYSIS_CRITERIA_INPUT_INVALID",
    "errors.analysisCriteria.inputInvalid",
    400,
  );
}

function authorizationError(reasonCode: import("@evaluation/permissions").DenialReason): AppError {
  return new AppError(
    `AUTHZ_${reasonCode}`,
    "errors.authorization.denied",
    reasonCode === "UNAUTHENTICATED" ? 401 : 403,
  );
}

Injectable()(AnalysisCriteriaPolicyGuard);
Inject(Reflector)(AnalysisCriteriaPolicyGuard, undefined, 0);
Inject(ANALYSIS_CRITERIA_POLICY_DATABASE)(AnalysisCriteriaPolicyGuard, undefined, 1);
