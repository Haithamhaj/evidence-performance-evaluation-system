export type Role =
  | "employee"
  | "manager"
  | "system_administrator"
  | "project_owner"
  | "workstream_owner"
  | "contributor"
  | "acting_owner";

export type ScopeType = "system" | "organization" | "department" | "project" | "workstream";

export type DenialReason =
  "UNAUTHENTICATED" | "INACTIVE" | "ROLE_REQUIRED" | "SCOPE_MISMATCH" | "RESOURCE_STATE";

export type Decision = { allowed: true } | { allowed: false; reasonCode: DenialReason };

export type PolicyInput = Readonly<{
  subjectId: string;
  active: boolean;
  roles: ReadonlyArray<{
    role: Role;
    scopeType: ScopeType;
    scopeId: string;
  }>;
}>;

export type PolicyAction =
  | "audit.query"
  | "managerFeedback.response.read"
  | "department.manage"
  | "system.configure"
  | "project.create"
  | "project.manage"
  | "workstream.create"
  | "workstream.manage"
  | "responsibility.transfer"
  | "document.template.manage"
  | "document.read"
  | "document.version.create"
  | "document.analysis.run"
  | "document.readiness.detail.read"
  | "document.readiness.summary.read"
  | "document.comparison.review"
  | "criteria.generate"
  | "criteria.owner.review"
  | "criteria.contributor.respond"
  | "criteria.manager.resolve"
  | "criteria.activate"
  | "criteria.read"
  | "resource.contribute"
  | "resource.read";

export type PolicyResource =
  | Readonly<{ kind: "system"; systemId: string }>
  | Readonly<{ kind: "department"; departmentId: string }>
  | Readonly<{ kind: "organizationTemplate"; organizationId: string }>
  | Readonly<{
      kind: "departmentTemplate";
      organizationId: string;
      departmentId: string;
    }>
  | Readonly<{ kind: "project"; projectId: string; departmentId: string }>
  | Readonly<{
      kind: "workstream";
      workstreamId: string;
      projectId: string;
      departmentId: string;
    }>
  | Readonly<{
      kind: "criteriaReviewSnapshot";
      reviewSnapshotId: string;
      workstreamId: string;
      projectId: string;
      departmentId: string;
    }>
  | Readonly<{
      kind: "managerFeedback.response";
      responseId: string;
      departmentId: string;
      managerId: string;
      submitterId: string;
      status: "draft" | "submitted";
      visibilityMode: "identified" | "manager_blinded" | "anonymous_aggregated";
    }>;

export type ResponsibilityAccessWindow = Readonly<{
  subjectId: string;
  scopeType: "project" | "workstream";
  scopeId: string;
  projectId?: string;
  responsibilityType: "original" | "acting" | "permanent" | "contributor";
  startsAt: string;
  endsAt: string | null;
}>;

export type ActingAuthority = Readonly<{
  delegationId: string;
  subjectId: string;
  scopeType: "project" | "workstream";
  scopeId: string;
  action: string;
  startsAt: string;
  endsAt: string;
}>;

export type PolicyContext = Readonly<{
  now: string;
  responsibilityWindows?: ReadonlyArray<ResponsibilityAccessWindow>;
  actingAuthorities?: ReadonlyArray<ActingAuthority>;
  incompleteEligibleCount?: number;
  uiVisible?: boolean;
}>;
