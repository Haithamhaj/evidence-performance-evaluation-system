/* eslint-disable no-unused-vars */
export class OperationsTargetAuthorizer {
  constructor(private readonly database: import("@evaluation/database").DatabaseClient) {}

  async authorize(actorId: string, action: Readonly<{ kind: string; resourceId: string }>) {
    if (action.kind === "DOWNLOAD_EXPORT") {
      return Boolean(
        await this.database.exportArtifact.findFirst({
          where: { id: action.resourceId, manifest: { request: { requesterId: actorId } } },
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
