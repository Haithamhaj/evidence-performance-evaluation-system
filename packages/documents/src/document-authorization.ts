import { AppError } from "@evaluation/contracts";
import { decide } from "@evaluation/permissions";

type Database = import("./model.js").DocumentTransaction;
type Identity = import("./model.js").DocumentResourceIdentity;

export async function authorizeDocument(
  database: Database,
  actor: Readonly<{ userId: string; active: boolean }>,
  identity: Identity,
  action: "document.read" | "document.version.create",
  now: Date,
): Promise<void> {
  const [user, roles, departmentScope, windows] = await Promise.all([
    database.user.findUnique({ where: { id: actor.userId }, select: { active: true } }),
    database.roleAssignment.findMany({
      where: { userId: actor.userId },
      select: { role: true, scopeType: true, scopeId: true },
    }),
    database.authorizationScope.findFirst({
      where: { departmentId: identity.departmentId, scopeType: "department" },
      select: { id: true },
    }),
    database.responsibilityWindow.findMany({
      where: {
        employeeId: actor.userId,
        OR: [
          { projectId: identity.projectId },
          ...(identity.kind === "workstream" ? [{ workstreamId: identity.resourceId }] : []),
        ],
      },
      select: {
        projectId: true,
        workstreamId: true,
        responsibilityType: true,
        startsAt: true,
        endsAt: true,
      },
    }),
  ]);
  if (user === null || !user.active || !actor.active) throw authorizationError("INACTIVE");
  if (departmentScope === null) throw authorizationError("SCOPE_MISMATCH");
  const resource =
    identity.kind === "project"
      ? {
          kind: "project" as const,
          projectId: identity.resourceId,
          departmentId: departmentScope.id,
        }
      : {
          kind: "workstream" as const,
          workstreamId: identity.resourceId,
          projectId: identity.projectId,
          departmentId: departmentScope.id,
        };
  const decision = decide({ subjectId: actor.userId, active: true, roles }, action, resource, {
    now: now.toISOString(),
    responsibilityWindows: windows.map((window) => ({
      subjectId: actor.userId,
      scopeType: window.workstreamId === null ? ("project" as const) : ("workstream" as const),
      scopeId: window.workstreamId ?? window.projectId!,
      ...(window.workstreamId === null ? {} : { projectId: identity.projectId }),
      responsibilityType: window.responsibilityType,
      startsAt: window.startsAt.toISOString(),
      endsAt: window.endsAt?.toISOString() ?? null,
    })),
  });
  if (!decision.allowed) throw authorizationError(decision.reasonCode);
}

function authorizationError(reason: import("@evaluation/permissions").DenialReason) {
  return new AppError(
    `AUTHZ_${reason}`,
    "errors.authorization.denied",
    reason === "UNAUTHENTICATED" ? 401 : 403,
  );
}
