const allow: import("./model.js").Decision = { allowed: true };

function deny(
  reasonCode: Exclude<import("./model.js").Decision, { allowed: true }>["reasonCode"],
): import("./model.js").Decision {
  return { allowed: false, reasonCode };
}

function roleAssignments(
  subject: import("./model.js").PolicyInput,
  role: import("./model.js").Role,
) {
  return subject.roles.filter((assignment) => assignment.role === role);
}

function hasRole(
  subject: import("./model.js").PolicyInput,
  role: import("./model.js").Role,
): boolean {
  return subject.roles.some((assignment) => assignment.role === role);
}

function hasScopedRole(
  subject: import("./model.js").PolicyInput,
  role: import("./model.js").Role,
  scopeType: import("./model.js").ScopeType,
  scopeId: string,
): boolean {
  return roleAssignments(subject, role).some(
    (assignment) => assignment.scopeType === scopeType && assignment.scopeId === scopeId,
  );
}

function decideManagerFeedbackRead(
  subject: import("./model.js").PolicyInput,
  resource: import("./model.js").PolicyResource,
): import("./model.js").Decision {
  if (resource.kind !== "managerFeedback.response") return deny("RESOURCE_STATE");

  const isManager = hasRole(subject, "manager");
  const isEmployee = hasRole(subject, "employee");
  if (!isManager && !isEmployee) return deny("ROLE_REQUIRED");

  const authorizedManager =
    isManager &&
    subject.subjectId === resource.managerId &&
    hasScopedRole(subject, "manager", "department", resource.departmentId);
  const responseOwner = isEmployee && subject.subjectId === resource.submitterId;
  if (!authorizedManager && !responseOwner) return deny("SCOPE_MISMATCH");

  if (resource.status !== "submitted" || resource.visibilityMode !== "identified") {
    return deny("RESOURCE_STATE");
  }
  return allow;
}

function activeWindow(
  window: import("./model.js").ActingOwnerWindow,
  subject: import("./model.js").PolicyInput,
  scopeType: "project" | "workstream",
  scopeId: string,
  now: string,
): boolean {
  const current = Date.parse(now);
  const startsAt = Date.parse(window.startsAt);
  const endsAt = Date.parse(window.endsAt);
  return (
    Number.isFinite(current) &&
    Number.isFinite(startsAt) &&
    Number.isFinite(endsAt) &&
    window.subjectId === subject.subjectId &&
    window.scopeType === scopeType &&
    window.scopeId === scopeId &&
    startsAt <= current &&
    current < endsAt
  );
}

function decideOwnerManagement(
  subject: import("./model.js").PolicyInput,
  resource: import("./model.js").PolicyResource,
  context: import("./model.js").PolicyContext,
  ownerRole: "project_owner" | "workstream_owner",
  scopeType: "project" | "workstream",
  scopeId: string,
): import("./model.js").Decision {
  const isPermanentOwner = hasRole(subject, ownerRole);
  const isActingOwner = hasRole(subject, "acting_owner");
  if (!isPermanentOwner && !isActingOwner) return deny("ROLE_REQUIRED");

  if (isPermanentOwner && hasScopedRole(subject, ownerRole, scopeType, scopeId)) return allow;

  if (isActingOwner && hasScopedRole(subject, "acting_owner", scopeType, scopeId)) {
    const windowIsActive = (context.actingOwnerWindows ?? []).some((window) =>
      activeWindow(window, subject, scopeType, scopeId, context.now),
    );
    return windowIsActive ? allow : deny("RESOURCE_STATE");
  }

  return deny("SCOPE_MISMATCH");
}

function decideKnownAction(
  subject: import("./model.js").PolicyInput,
  action: string,
  resource: import("./model.js").PolicyResource,
  context: import("./model.js").PolicyContext,
): import("./model.js").Decision {
  switch (action) {
    case "managerFeedback.response.read":
      return decideManagerFeedbackRead(subject, resource);
    case "department.manage":
      if (!hasRole(subject, "manager")) return deny("ROLE_REQUIRED");
      if (resource.kind !== "department") return deny("RESOURCE_STATE");
      return hasScopedRole(subject, "manager", "department", resource.departmentId)
        ? allow
        : deny("SCOPE_MISMATCH");
    case "audit.query":
    case "system.configure":
      if (!hasRole(subject, "system_administrator")) return deny("ROLE_REQUIRED");
      if (resource.kind !== "system") return deny("RESOURCE_STATE");
      return hasScopedRole(subject, "system_administrator", "system", resource.systemId)
        ? allow
        : deny("SCOPE_MISMATCH");
    case "project.manage":
      if (resource.kind !== "project") return deny("RESOURCE_STATE");
      return decideOwnerManagement(
        subject,
        resource,
        context,
        "project_owner",
        "project",
        resource.projectId,
      );
    case "workstream.manage":
      if (resource.kind !== "workstream") return deny("RESOURCE_STATE");
      return decideOwnerManagement(
        subject,
        resource,
        context,
        "workstream_owner",
        "workstream",
        resource.workstreamId,
      );
    case "resource.contribute": {
      if (!hasRole(subject, "contributor")) return deny("ROLE_REQUIRED");
      if (resource.kind === "project") {
        return hasScopedRole(subject, "contributor", "project", resource.projectId)
          ? allow
          : deny("SCOPE_MISMATCH");
      }
      if (resource.kind === "workstream") {
        return hasScopedRole(subject, "contributor", "workstream", resource.workstreamId)
          ? allow
          : deny("SCOPE_MISMATCH");
      }
      return deny("RESOURCE_STATE");
    }
    default:
      return deny("ROLE_REQUIRED");
  }
}

export function decide(
  subject: import("./model.js").PolicyInput | null,
  action: string,
  resource: import("./model.js").PolicyResource,
  context: import("./model.js").PolicyContext,
): import("./model.js").Decision {
  if (subject === null) return deny("UNAUTHENTICATED");
  if (!subject.active) return deny("INACTIVE");
  return decideKnownAction(subject, action, resource, context);
}
