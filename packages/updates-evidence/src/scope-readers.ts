import { AppError } from "@evaluation/contracts";

type Transaction = import("@evaluation/database").DatabaseTransaction;
type UpdateScopeReader = import("./update-service.js").UpdateScopeReader;
type EvidenceScopeReader = import("./evidence-service.js").EvidenceScopeReader;
type SafeEvidenceUploadReader = import("./evidence-service.js").SafeEvidenceUploadReader;

type BaseScopeInput = Readonly<{
  actor: { userId: string; active: boolean };
  projectId: string;
  workstreamId: string | null;
  workItemId: string | null;
  at: Date;
}>;

export class PrismaUpdateScopeReader implements UpdateScopeReader {
  authorizeIn(transaction: Transaction, input: BaseScopeInput) {
    return authorizeBase(transaction, input);
  }
}

export class PrismaEvidenceScopeReader implements EvidenceScopeReader {
  async authorizeIn(
    transaction: Transaction,
    input: BaseScopeInput &
      Readonly<{
        progressComponentId: string | null;
        dynamicCriterionId: string | null;
      }>,
  ): Promise<void> {
    await authorizeBase(transaction, input);
    if (input.progressComponentId !== null) {
      const component = await transaction.progressContractComponent.findFirst({
        where: {
          id: input.progressComponentId,
          contract: {
            projectId: input.projectId,
            workstreamId: input.workstreamId,
            state: "active",
            effectiveAt: { lte: input.at },
          },
        },
        select: { id: true },
      });
      if (component === null) throw scopeError();
    }
    if (input.dynamicCriterionId !== null) {
      const criterion = await transaction.dynamicCriterion.findFirst({
        where: {
          id: input.dynamicCriterionId,
          criteriaSet: {
            projectId: input.workstreamId === null ? input.projectId : null,
            workstreamId: input.workstreamId,
            effectiveFrom: { lte: input.at },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.at } }],
          },
        },
        select: { id: true },
      });
      if (criterion === null) throw scopeError();
    }
  }
}

export class PrismaSafeEvidenceUploadReader implements SafeEvidenceUploadReader {
  async getApprovedUploadIn(
    transaction: Transaction,
    input: Readonly<{
      actor: { userId: string; active: boolean };
      uploadedSourceId: string;
      projectId: string;
      workstreamId: string | null;
    }>,
  ) {
    if (!input.actor.active) throw scopeError();
    const source = await transaction.uploadedSource.findFirst({
      where: { id: input.uploadedSourceId, createdById: input.actor.userId },
      select: {
        objectKey: true,
        detectedMime: true,
        sha256: true,
        byteSize: true,
        projectId: true,
        workstreamId: true,
        workstream: { select: { projectId: true } },
      },
    });
    const sourceProjectId = source?.projectId ?? source?.workstream?.projectId ?? null;
    const allowedScope =
      source !== null &&
      sourceProjectId === input.projectId &&
      (source.workstreamId === null || source.workstreamId === input.workstreamId);
    if (!allowedScope || source === null) throw scopeError();
    return {
      objectKey: source.objectKey,
      mediaType: source.detectedMime,
      checksumSha256: source.sha256,
      sizeBytes: source.byteSize,
    };
  }
}

async function authorizeBase(transaction: Transaction, input: BaseScopeInput) {
  if (!input.actor.active) throw scopeError();
  const project = await transaction.project.findUnique({
    where: { id: input.projectId },
    select: {
      id: true,
      organizationId: true,
      departmentId: true,
      authorizationScopeId: true,
      status: true,
      department: {
        select: {
          authorizationScopes: {
            where: { scopeType: "department" },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { id: true },
          },
        },
      },
      members: {
        where: {
          employeeId: input.actor.userId,
          startsAt: { lte: input.at },
          OR: [{ endsAt: null }, { endsAt: { gt: input.at } }],
        },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (project === null || !["active", "paused"].includes(project.status)) throw scopeError();
  const manager = await transaction.roleAssignment.findFirst({
    where: {
      userId: input.actor.userId,
      role: "manager",
      scopeType: "department",
      scope: { departmentId: project.departmentId },
    },
    select: { id: true },
  });
  if (project.members.length === 0 && manager === null) throw scopeError();
  if (input.workstreamId !== null) {
    const workstream = await transaction.workstream.findFirst({
      where: {
        id: input.workstreamId,
        projectId: input.projectId,
        status: { in: ["active", "paused"] },
      },
      select: {
        members: {
          where: {
            employeeId: input.actor.userId,
            startsAt: { lte: input.at },
            OR: [{ endsAt: null }, { endsAt: { gt: input.at } }],
          },
          take: 1,
          select: { id: true },
        },
      },
    });
    if (workstream === null || (workstream.members.length === 0 && manager === null)) {
      throw scopeError();
    }
  }
  if (input.workItemId !== null) {
    const item = await transaction.workItem.findFirst({
      where: {
        id: input.workItemId,
        projectId: input.projectId,
        workstreamId: input.workstreamId,
      },
      select: { id: true },
    });
    if (item === null) throw scopeError();
  }
  const departmentScopeId = project.department.authorizationScopes[0]?.id;
  if (departmentScopeId === undefined) throw scopeError();
  const contract = await transaction.progressContract.findFirst({
    where: {
      projectId: input.projectId,
      workstreamId: input.workstreamId,
      state: "active",
      effectiveAt: { lte: input.at },
    },
    orderBy: [{ effectiveAt: "desc" }, { contractVersion: "desc" }],
    include: { components: { orderBy: { position: "asc" } } },
  });
  return {
    organizationId: project.organizationId,
    projectScopeId: project.authorizationScopeId,
    departmentScopeId,
    activeContract:
      contract === null
        ? null
        : {
            contractId: contract.id,
            contractVersion: contract.contractVersion,
            componentReferences: contract.components.map(
              (component) => `progress-component:${component.id}`,
            ),
          },
  };
}

function scopeError(): AppError {
  return new AppError("SCOPE_MISMATCH", "errors.authorization.scopeMismatch", 403);
}
