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
  window: import("./model.js").ResponsibilityAccessWindow,
  subject: import("./model.js").PolicyInput,
  scopeType: "project" | "workstream",
  scopeId: string,
  now: string,
  responsibilityTypes: ReadonlyArray<
    import("./model.js").ResponsibilityAccessWindow["responsibilityType"]
  >,
): boolean {
  const current = Date.parse(now);
  const startsAt = Date.parse(window.startsAt);
  const endsAt = window.endsAt === null ? Number.POSITIVE_INFINITY : Date.parse(window.endsAt);
  return (
    Number.isFinite(current) &&
    Number.isFinite(startsAt) &&
    (window.endsAt === null || Number.isFinite(endsAt)) &&
    window.subjectId === subject.subjectId &&
    window.scopeType === scopeType &&
    window.scopeId === scopeId &&
    responsibilityTypes.includes(window.responsibilityType) &&
    startsAt <= current &&
    current < endsAt
  );
}

function managerCanAccessDepartment(
  subject: import("./model.js").PolicyInput,
  departmentId: string,
): boolean {
  return hasScopedRole(subject, "manager", "department", departmentId);
}

function activeResponsibility(
  subject: import("./model.js").PolicyInput,
  context: import("./model.js").PolicyContext,
  scopeType: "project" | "workstream",
  scopeId: string,
  responsibilityTypes: ReadonlyArray<
    import("./model.js").ResponsibilityAccessWindow["responsibilityType"]
  >,
): boolean {
  return (context.responsibilityWindows ?? []).some((window) =>
    activeWindow(window, subject, scopeType, scopeId, context.now, responsibilityTypes),
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
  if (
    (resource.kind === "project" || resource.kind === "workstream") &&
    managerCanAccessDepartment(subject, resource.departmentId)
  ) {
    return allow;
  }

  const isPermanentOwner = hasRole(subject, ownerRole);
  const hasPermanentScope =
    isPermanentOwner && hasScopedRole(subject, ownerRole, scopeType, scopeId);
  if (!hasPermanentScope) {
    return isPermanentOwner || hasRole(subject, "acting_owner") || hasRole(subject, "manager")
      ? deny("SCOPE_MISMATCH")
      : deny("ROLE_REQUIRED");
  }

  const permanentIsActive =
    hasPermanentScope &&
    activeResponsibility(subject, context, scopeType, scopeId, ["original", "permanent"]);
  return permanentIsActive ? allow : deny("RESOURCE_STATE");
}

function decideContribution(
  subject: import("./model.js").PolicyInput,
  resource: import("./model.js").PolicyResource,
  context: import("./model.js").PolicyContext,
): import("./model.js").Decision {
  if (!hasRole(subject, "contributor")) return deny("ROLE_REQUIRED");
  if (resource.kind !== "project" && resource.kind !== "workstream") {
    return deny("RESOURCE_STATE");
  }
  const scopeId = resource.kind === "project" ? resource.projectId : resource.workstreamId;
  if (!hasScopedRole(subject, "contributor", resource.kind, scopeId)) {
    return deny("SCOPE_MISMATCH");
  }
  return activeResponsibility(subject, context, resource.kind, scopeId, ["contributor"])
    ? allow
    : deny("RESOURCE_STATE");
}

function decideCurrentOwner(
  subject: import("./model.js").PolicyInput,
  resource: import("./model.js").PolicyResource,
  context: import("./model.js").PolicyContext,
): import("./model.js").Decision {
  if (resource.kind === "project") {
    const hasPermanentScope = hasScopedRole(
      subject,
      "project_owner",
      "project",
      resource.projectId,
    );
    const hasActingScope = hasScopedRole(subject, "acting_owner", "project", resource.projectId);
    if (!hasPermanentScope && !hasActingScope) {
      return hasRole(subject, "project_owner") || hasRole(subject, "acting_owner")
        ? deny("SCOPE_MISMATCH")
        : deny("ROLE_REQUIRED");
    }
    const permanentIsActive =
      hasPermanentScope &&
      activeResponsibility(subject, context, "project", resource.projectId, [
        "original",
        "permanent",
      ]);
    const actingIsActive =
      hasActingScope &&
      activeResponsibility(subject, context, "project", resource.projectId, ["acting"]);
    return permanentIsActive || actingIsActive ? allow : deny("RESOURCE_STATE");
  }
  if (resource.kind === "workstream") {
    const hasPermanentScope = hasScopedRole(
      subject,
      "workstream_owner",
      "workstream",
      resource.workstreamId,
    );
    const hasActingScope = hasScopedRole(
      subject,
      "acting_owner",
      "workstream",
      resource.workstreamId,
    );
    if (!hasPermanentScope && !hasActingScope) {
      return hasRole(subject, "workstream_owner") || hasRole(subject, "acting_owner")
        ? deny("SCOPE_MISMATCH")
        : deny("ROLE_REQUIRED");
    }
    const permanentIsActive =
      hasPermanentScope &&
      activeResponsibility(subject, context, "workstream", resource.workstreamId, [
        "original",
        "permanent",
      ]);
    const actingIsActive =
      hasActingScope &&
      activeResponsibility(subject, context, "workstream", resource.workstreamId, ["acting"]);
    return permanentIsActive || actingIsActive ? allow : deny("RESOURCE_STATE");
  }
  return deny("RESOURCE_STATE");
}

function decideReadinessDetail(
  subject: import("./model.js").PolicyInput,
  resource: import("./model.js").PolicyResource,
  context: import("./model.js").PolicyContext,
): import("./model.js").Decision {
  if (hasRole(subject, "manager")) return deny("ROLE_REQUIRED");
  if (resource.kind !== "project" && resource.kind !== "workstream") {
    return deny("RESOURCE_STATE");
  }
  const ownerDecision = decideCurrentOwner(subject, resource, context);
  if (ownerDecision.allowed) return ownerDecision;
  if (hasRole(subject, "contributor")) {
    return decideContribution(subject, resource, context);
  }
  return ownerDecision;
}

function decideFrozenContributorResponse(
  subject: import("./model.js").PolicyInput,
  resource: import("./model.js").PolicyResource,
): import("./model.js").Decision {
  if (resource.kind !== "criteriaReviewSnapshot") return deny("RESOURCE_STATE");
  // The criteria service matches subjectId against the immutable published snapshot.
  // This policy intentionally avoids re-checking mutable current contributor scope.
  return hasRole(subject, "employee") || hasRole(subject, "contributor")
    ? allow
    : deny("ROLE_REQUIRED");
}

function roleMatchesWindow(
  subject: import("./model.js").PolicyInput,
  window: import("./model.js").ResponsibilityAccessWindow,
): boolean {
  const role =
    window.responsibilityType === "acting"
      ? "acting_owner"
      : window.responsibilityType === "contributor"
        ? "contributor"
        : window.scopeType === "project"
          ? "project_owner"
          : "workstream_owner";
  return hasScopedRole(subject, role, window.scopeType, window.scopeId);
}

function decideResourceRead(
  subject: import("./model.js").PolicyInput,
  resource: import("./model.js").PolicyResource,
  context: import("./model.js").PolicyContext,
): import("./model.js").Decision {
  if (resource.kind !== "project" && resource.kind !== "workstream") {
    return deny("RESOURCE_STATE");
  }
  if (managerCanAccessDepartment(subject, resource.departmentId)) return allow;

  const matchingWindows = (context.responsibilityWindows ?? []).filter((window) => {
    if (!roleMatchesWindow(subject, window)) return false;
    if (resource.kind === "project") {
      return (
        (window.scopeType === "project" && window.scopeId === resource.projectId) ||
        (window.scopeType === "workstream" && window.projectId === resource.projectId)
      );
    }
    return (
      (window.scopeType === "workstream" && window.scopeId === resource.workstreamId) ||
      (window.scopeType === "project" &&
        window.scopeId === resource.projectId &&
        window.responsibilityType !== "contributor")
    );
  });
  if (
    matchingWindows.some((window) =>
      activeWindow(window, subject, window.scopeType, window.scopeId, context.now, [
        window.responsibilityType,
      ]),
    )
  ) {
    return allow;
  }
  return matchingWindows.length > 0 ? deny("RESOURCE_STATE") : deny("SCOPE_MISMATCH");
}

function decideKnownAction(
  subject: import("./model.js").PolicyInput,
  action: string,
  resource: import("./model.js").PolicyResource,
  context: import("./model.js").PolicyContext,
): import("./model.js").Decision {
  switch (action) {
    case "project.update":
    case "project.document.update":
    case "project.criteria.approve":
    case "project.participants.manage":
    case "project.decision.record":
    case "project.source.manage":
    case "project.stage.close":
    case "workstream.update":
    case "workstream.document.update":
    case "workstream.criteria.approve":
    case "workstream.participants.manage":
    case "workstream.decision.record":
    case "workstream.source.manage":
    case "workstream.stage.close":
      return decideExactActingAuthority(subject, action, resource, context);
    case "project.transferPermanentOwner":
    case "workstream.transferPermanentOwner":
      return deny("ROLE_REQUIRED");
    case "managerFeedback.response.read":
      return decideManagerFeedbackRead(subject, resource);
    case "department.manage":
      if (!hasRole(subject, "manager")) return deny("ROLE_REQUIRED");
      if (resource.kind !== "department") return deny("RESOURCE_STATE");
      return hasScopedRole(subject, "manager", "department", resource.departmentId)
        ? allow
        : deny("SCOPE_MISMATCH");
    case "project.create":
      if (!hasRole(subject, "manager")) return deny("ROLE_REQUIRED");
      if (resource.kind !== "department") return deny("RESOURCE_STATE");
      return managerCanAccessDepartment(subject, resource.departmentId)
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
    case "workstream.create":
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
    case "responsibility.transfer":
      if (!hasRole(subject, "manager")) return deny("ROLE_REQUIRED");
      if (resource.kind !== "project" && resource.kind !== "workstream") {
        return deny("RESOURCE_STATE");
      }
      return managerCanAccessDepartment(subject, resource.departmentId)
        ? allow
        : deny("SCOPE_MISMATCH");
    case "document.template.manage":
      if (resource.kind === "organizationTemplate") {
        if (!hasRole(subject, "system_administrator")) return deny("ROLE_REQUIRED");
        if (
          roleAssignments(subject, "system_administrator").some(
            (role) => role.scopeType === "system",
          )
        ) {
          return allow;
        }
        return hasScopedRole(
          subject,
          "system_administrator",
          "organization",
          resource.organizationId,
        )
          ? allow
          : deny("SCOPE_MISMATCH");
      }
      if (resource.kind === "departmentTemplate") {
        if (!hasRole(subject, "manager")) return deny("ROLE_REQUIRED");
        return managerCanAccessDepartment(subject, resource.departmentId)
          ? allow
          : deny("SCOPE_MISMATCH");
      }
      return deny("RESOURCE_STATE");
    case "document.read":
      return decideResourceRead(subject, resource, context);
    case "document.readiness.summary.read":
    case "criteria.read":
      return decideResourceRead(subject, resource, context);
    case "document.readiness.detail.read":
      return decideReadinessDetail(subject, resource, context);
    case "document.analysis.run":
    case "document.comparison.review":
    case "criteria.generate":
    case "criteria.owner.review":
    case "criteria.activate":
      return decideCurrentOwner(subject, resource, context);
    case "criteria.contributor.respond":
      return decideFrozenContributorResponse(subject, resource);
    case "criteria.manager.resolve":
      if (!hasRole(subject, "manager")) return deny("ROLE_REQUIRED");
      if (resource.kind !== "workstream") return deny("RESOURCE_STATE");
      return managerCanAccessDepartment(subject, resource.departmentId)
        ? allow
        : deny("SCOPE_MISMATCH");
    case "document.version.create":
      if (resource.kind === "project") {
        return decideOwnerManagement(
          subject,
          resource,
          context,
          "project_owner",
          "project",
          resource.projectId,
        );
      }
      if (resource.kind === "workstream") {
        return decideOwnerManagement(
          subject,
          resource,
          context,
          "workstream_owner",
          "workstream",
          resource.workstreamId,
        );
      }
      return deny("RESOURCE_STATE");
    case "resource.contribute":
      return decideContribution(subject, resource, context);
    case "resource.read":
      return decideResourceRead(subject, resource, context);
    default:
      return deny("ROLE_REQUIRED");
  }
}

function decideExactActingAuthority(
  subject: import("./model.js").PolicyInput,
  action: string,
  resource: import("./model.js").PolicyResource,
  context: import("./model.js").PolicyContext,
): import("./model.js").Decision {
  if (resource.kind !== "project" && resource.kind !== "workstream") {
    return deny("RESOURCE_STATE");
  }
  const scopeId = resource.kind === "project" ? resource.projectId : resource.workstreamId;
  if (managerCanAccessDepartment(subject, resource.departmentId)) return allow;
  const permanentRole = resource.kind === "project" ? "project_owner" : "workstream_owner";
  if (
    hasScopedRole(subject, permanentRole, resource.kind, scopeId) &&
    activeResponsibility(subject, context, resource.kind, scopeId, ["original", "permanent"])
  ) {
    return allow;
  }
  if (!hasRole(subject, "acting_owner")) return deny("ROLE_REQUIRED");
  if (!hasScopedRole(subject, "acting_owner", resource.kind, scopeId)) {
    return deny("SCOPE_MISMATCH");
  }
  const occurredAt = Date.parse(context.now);
  const matching = (context.actingAuthorities ?? []).filter(
    (authority) =>
      authority.subjectId === subject.subjectId &&
      authority.scopeType === resource.kind &&
      authority.scopeId === scopeId &&
      authority.action === action,
  );
  return matching.some(
    (authority) =>
      Date.parse(authority.startsAt) <= occurredAt && occurredAt < Date.parse(authority.endsAt),
  )
    ? allow
    : deny("RESOURCE_STATE");
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
