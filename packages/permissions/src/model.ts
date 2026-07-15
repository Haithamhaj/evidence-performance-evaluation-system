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
  | "managerFeedback.response.read"
  | "department.manage"
  | "system.configure"
  | "project.manage"
  | "workstream.manage"
  | "resource.contribute";

export type PolicyResource =
  | Readonly<{ kind: "system"; systemId: string }>
  | Readonly<{ kind: "department"; departmentId: string }>
  | Readonly<{ kind: "project"; projectId: string }>
  | Readonly<{ kind: "workstream"; workstreamId: string; projectId: string }>
  | Readonly<{
      kind: "managerFeedback.response";
      responseId: string;
      departmentId: string;
      managerId: string;
      submitterId: string;
      status: "draft" | "submitted";
      visibilityMode: "identified" | "manager_blinded" | "anonymous_aggregated";
    }>;

export type ActingOwnerWindow = Readonly<{
  subjectId: string;
  scopeType: "project" | "workstream";
  scopeId: string;
  startsAt: string;
  endsAt: string;
}>;

export type PolicyContext = Readonly<{
  now: string;
  actingOwnerWindows?: ReadonlyArray<ActingOwnerWindow>;
  incompleteEligibleCount?: number;
  uiVisible?: boolean;
}>;
