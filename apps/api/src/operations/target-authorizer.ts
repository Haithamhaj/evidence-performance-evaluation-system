/* eslint-disable no-unused-vars */
export class OperationsTargetAuthorizer {
  constructor(
    private readonly database: import("@evaluation/database").DatabaseClient,
    private readonly registry: import("@evaluation/reporting").ProjectionRegistry,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async authorize(actorId: string, action: Readonly<{ kind: string; resourceId: string }>) {
    if (action.kind === "DOWNLOAD_EXPORT") {
      const artifact = await this.database.exportArtifact.findFirst({
        where: { id: action.resourceId, manifest: { requesterId: actorId } },
        include: { manifest: true, revocations: { take: 1 } },
      });
      if (!artifact || artifact.revocations.length > 0 || artifact.expiresAt <= this.now()) {
        return false;
      }
      return this.registry
        .authorizeCurrent(
          artifact.manifest.reportType as import("@evaluation/reporting").ReportType,
          artifact.manifest.audience as import("@evaluation/reporting").ReportAudience,
          { requesterId: actorId, cycleId: artifact.manifest.cycleId },
        )
        .catch(() => false);
    }
    if (action.kind === "CHECK_IN") {
      return Boolean(
        await this.database.workstreamMember.findFirst({
          where: {
            workstreamId: action.resourceId,
            employeeId: actorId,
            employee: { active: true },
            startsAt: { lte: this.now() },
            OR: [{ endsAt: null }, { endsAt: { gt: this.now() } }],
          },
          select: { id: true },
        }),
      );
    }
    if (action.kind === "OPEN_CONTINUITY") {
      const item = await this.database.reassignmentRequiredCase.findFirst({
        where: { id: action.resourceId, state: "REASSIGNMENT_REQUIRED" },
        select: { id: true, queueItem: { select: { departmentId: true } } },
      });
      if (!item?.queueItem) return false;
      return Boolean(
        await this.database.roleAssignment.findFirst({
          where: {
            userId: actorId,
            role: "manager",
            scopeType: "department",
            scope: { departmentId: item.queueItem.departmentId },
            user: { active: true },
          },
          select: { id: true },
        }),
      );
    }
    if (action.kind === "OPEN_ADMIN_HEALTH") {
      if (!ADMIN_HEALTH_DEPENDENCIES.has(action.resourceId)) return false;
      return Boolean(
        await this.database.roleAssignment.findFirst({
          where: {
            userId: actorId,
            role: "system_administrator",
            scopeType: "system",
            user: { active: true },
          },
          select: { id: true },
        }),
      );
    }
    if (action.kind === "OPEN_EVALUATION") {
      return Boolean(
        await this.database.evaluationAssignment.findFirst({
          where: { id: action.resourceId, OR: [{ employeeId: actorId }, { managerId: actorId }] },
          select: { id: true },
        }),
      );
    }
    if (action.kind === "CONFIRM_EVIDENCE") {
      return Boolean(
        await this.database.evidenceRecord.findFirst({
          where: { id: action.resourceId, employeeId: actorId },
          select: { id: true },
        }),
      );
    }
    if (action.kind === "RECONNECT") {
      return Boolean(
        await this.database.connectedWorkAccount.findFirst({
          where: { id: action.resourceId, employeeId: actorId },
          select: { id: true },
        }),
      );
    }
    return false;
  }
}

const ADMIN_HEALTH_DEPENDENCIES = new Set([
  "WORKER",
  "QUEUE",
  "OBJECT_STORAGE",
  "OIDC",
  "AI_ROUTE",
  "CONNECTOR",
  "EMAIL",
  "BACKUP",
]);
