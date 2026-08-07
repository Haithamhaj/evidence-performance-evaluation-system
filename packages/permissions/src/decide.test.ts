import { describe, expect, it } from "vitest";

import { decide } from "./decide.js";

const now = "2026-07-15T12:00:00.000Z";
const baseContext: import("./model.js").PolicyContext = {
  now,
  responsibilityWindows: [
    {
      subjectId: "owner-1",
      scopeType: "project",
      scopeId: "project-1",
      responsibilityType: "permanent",
      startsAt: "2026-07-15T08:00:00.000Z",
      endsAt: null,
    },
    {
      subjectId: "workstream-owner-1",
      scopeType: "workstream",
      scopeId: "workstream-1",
      projectId: "project-1",
      responsibilityType: "permanent",
      startsAt: "2026-07-15T08:00:00.000Z",
      endsAt: null,
    },
    {
      subjectId: "contributor-1",
      scopeType: "project",
      scopeId: "project-1",
      responsibilityType: "contributor",
      startsAt: "2026-07-15T08:00:00.000Z",
      endsAt: null,
    },
    {
      subjectId: "workstream-contributor-1",
      scopeType: "workstream",
      scopeId: "workstream-1",
      projectId: "project-1",
      responsibilityType: "contributor",
      startsAt: "2026-07-15T08:00:00.000Z",
      endsAt: null,
    },
  ],
};

function subject(
  subjectId: string,
  role: import("./model.js").Role,
  scopeType: import("./model.js").PolicyInput["roles"][number]["scopeType"],
  scopeId: string,
  active = true,
): import("./model.js").PolicyInput {
  return {
    subjectId,
    active,
    roles: [{ role, scopeType, scopeId }],
  };
}

const manager = subject("manager-1", "manager", "department", "department-ai");
const otherManager = subject("manager-2", "manager", "department", "department-other");
const employee = subject("employee-1", "employee", "department", "department-ai");
const otherEmployee = subject("employee-2", "employee", "department", "department-ai");
const administrator = subject(
  "administrator-1",
  "system_administrator",
  "system",
  "evaluation-system",
);
const organizationAdministrator = subject(
  "administrator-2",
  "system_administrator",
  "organization",
  "organization-ai",
);
const projectOwner = subject("owner-1", "project_owner", "project", "project-1");
const workstreamOwner = subject(
  "workstream-owner-1",
  "workstream_owner",
  "workstream",
  "workstream-1",
);
const contributor = subject("contributor-1", "contributor", "project", "project-1");
const actingOwner = subject("delegate-1", "acting_owner", "project", "project-1");
const workstreamContributor = subject(
  "workstream-contributor-1",
  "contributor",
  "workstream",
  "workstream-1",
);
const workstreamActingOwner = subject(
  "workstream-delegate-1",
  "acting_owner",
  "workstream",
  "workstream-1",
);

const submittedResponse: import("./model.js").PolicyResource = {
  kind: "managerFeedback.response",
  responseId: "response-1",
  departmentId: "department-ai",
  managerId: manager.subjectId,
  submitterId: employee.subjectId,
  status: "submitted",
  visibilityMode: "identified",
};

describe("authorization decision contract", () => {
  it("shows a submitted identified response immediately to its authorized manager", () => {
    expect(
      decide(manager, "managerFeedback.response.read", submittedResponse, baseContext),
    ).toEqual({ allowed: true });
  });

  it("denies a manager from another department", () => {
    expect(
      decide(otherManager, "managerFeedback.response.read", submittedResponse, baseContext),
    ).toEqual({
      allowed: false,
      reasonCode: "SCOPE_MISMATCH",
    });
  });

  it("does not depend on full-team completion", () => {
    expect(
      decide(manager, "managerFeedback.response.read", submittedResponse, {
        ...baseContext,
        incompleteEligibleCount: 4,
      }),
    ).toEqual({ allowed: true });
  });

  it("ignores UI visibility state", () => {
    expect(
      decide(manager, "managerFeedback.response.read", submittedResponse, {
        ...baseContext,
        uiVisible: false,
      }),
    ).toEqual({ allowed: true });
  });

  it("allows an employee to read their own submitted response", () => {
    expect(
      decide(employee, "managerFeedback.response.read", submittedResponse, baseContext),
    ).toEqual({ allowed: true });
  });

  it("denies an employee from reading another employee response", () => {
    expect(
      decide(otherEmployee, "managerFeedback.response.read", submittedResponse, baseContext),
    ).toEqual({ allowed: false, reasonCode: "SCOPE_MISMATCH" });
  });

  it("does not treat the System Administrator as the pilot manager", () => {
    expect(
      decide(administrator, "managerFeedback.response.read", submittedResponse, baseContext),
    ).toEqual({ allowed: false, reasonCode: "ROLE_REQUIRED" });
  });

  it.each([
    [
      projectOwner,
      "project.manage",
      { kind: "project", projectId: "project-1", departmentId: "department-ai" },
    ],
    [
      workstreamOwner,
      "workstream.manage",
      {
        kind: "workstream",
        workstreamId: "workstream-1",
        projectId: "project-1",
        departmentId: "department-ai",
      },
    ],
    [
      contributor,
      "resource.contribute",
      { kind: "project", projectId: "project-1", departmentId: "department-ai" },
    ],
    [manager, "department.manage", { kind: "department", departmentId: "department-ai" }],
    [administrator, "system.configure", { kind: "system", systemId: "evaluation-system" }],
  ] as const)("allows the approved scoped role %#", (policySubject, action, resource) => {
    expect(decide(policySubject, action, resource, baseContext)).toEqual({ allowed: true });
  });

  it.each([
    [
      projectOwner,
      "project.manage",
      { kind: "project", projectId: "project-2", departmentId: "department-ai" },
    ],
    [
      workstreamOwner,
      "workstream.manage",
      {
        kind: "workstream",
        workstreamId: "workstream-2",
        projectId: "project-1",
        departmentId: "department-ai",
      },
    ],
    [
      contributor,
      "resource.contribute",
      { kind: "project", projectId: "project-2", departmentId: "department-ai" },
    ],
    [manager, "department.manage", { kind: "department", departmentId: "department-other" }],
  ] as const)("denies an approved role outside its scope %#", (policySubject, action, resource) => {
    expect(decide(policySubject, action, resource, baseContext)).toEqual({
      allowed: false,
      reasonCode: "SCOPE_MISMATCH",
    });
  });

  it("allows only the matching department manager to create and transfer", () => {
    const department = { kind: "department", departmentId: "department-ai" } as const;
    const project = {
      kind: "project",
      projectId: "project-1",
      departmentId: "department-ai",
    } as const;

    expect(decide(manager, "project.create", department, baseContext)).toEqual({ allowed: true });
    expect(decide(otherManager, "project.create", department, baseContext)).toEqual({
      allowed: false,
      reasonCode: "SCOPE_MISMATCH",
    });
    expect(decide(manager, "responsibility.transfer", project, baseContext)).toEqual({
      allowed: true,
    });
    expect(decide(administrator, "responsibility.transfer", project, baseContext)).toEqual({
      allowed: false,
      reasonCode: "ROLE_REQUIRED",
    });
  });

  it("enforces document template management scope", () => {
    const organizationTemplate = {
      kind: "organizationTemplate",
      organizationId: "organization-ai",
    } as const;
    const departmentTemplate = {
      kind: "departmentTemplate",
      organizationId: "organization-ai",
      departmentId: "department-ai",
    } as const;

    expect(
      decide(
        organizationAdministrator,
        "document.template.manage",
        organizationTemplate,
        baseContext,
      ),
    ).toEqual({ allowed: true });
    expect(
      decide(administrator, "document.template.manage", organizationTemplate, baseContext),
    ).toEqual({ allowed: true });
    expect(decide(manager, "document.template.manage", departmentTemplate, baseContext)).toEqual({
      allowed: true,
    });
    expect(
      decide(otherManager, "document.template.manage", departmentTemplate, baseContext),
    ).toEqual({ allowed: false, reasonCode: "SCOPE_MISMATCH" });
    expect(
      decide(projectOwner, "document.template.manage", departmentTemplate, baseContext),
    ).toEqual({ allowed: false, reasonCode: "ROLE_REQUIRED" });
  });

  it("enforces document reads and version creation through current resource scope", () => {
    const project = {
      kind: "project",
      projectId: "project-1",
      departmentId: "department-ai",
    } as const;
    const workstream = {
      kind: "workstream",
      workstreamId: "workstream-1",
      projectId: "project-1",
      departmentId: "department-ai",
    } as const;

    expect(decide(manager, "document.version.create", project, baseContext)).toEqual({
      allowed: true,
    });
    expect(decide(projectOwner, "document.version.create", project, baseContext)).toEqual({
      allowed: true,
    });
    expect(decide(workstreamOwner, "document.version.create", workstream, baseContext)).toEqual({
      allowed: true,
    });
    expect(decide(contributor, "document.version.create", project, baseContext)).toEqual({
      allowed: false,
      reasonCode: "ROLE_REQUIRED",
    });
    expect(decide(workstreamContributor, "document.read", workstream, baseContext)).toEqual({
      allowed: true,
    });
    expect(decide(otherManager, "document.read", project, baseContext)).toEqual({
      allowed: false,
      reasonCode: "SCOPE_MISMATCH",
    });
  });

  it("requires an active responsibility window even when a scoped role remains", () => {
    const project = {
      kind: "project",
      projectId: "project-1",
      departmentId: "department-ai",
    } as const;
    const expired = {
      now,
      responsibilityWindows: [
        {
          subjectId: projectOwner.subjectId,
          scopeType: "project",
          scopeId: "project-1",
          responsibilityType: "permanent",
          startsAt: "2026-07-14T08:00:00.000Z",
          endsAt: now,
        },
      ],
    } satisfies import("./model.js").PolicyContext;

    expect(decide(projectOwner, "project.manage", project, expired)).toEqual({
      allowed: false,
      reasonCode: "RESOURCE_STATE",
    });
    expect(decide(contributor, "resource.contribute", project, expired)).toEqual({
      allowed: false,
      reasonCode: "RESOURCE_STATE",
    });
  });

  it("enforces the project and workstream read matrix", () => {
    const project = {
      kind: "project",
      projectId: "project-1",
      departmentId: "department-ai",
    } as const;
    const workstream = {
      kind: "workstream",
      workstreamId: "workstream-1",
      projectId: "project-1",
      departmentId: "department-ai",
    } as const;

    expect(decide(manager, "resource.read", project, baseContext)).toEqual({ allowed: true });
    expect(decide(projectOwner, "resource.read", workstream, baseContext)).toEqual({
      allowed: true,
    });
    expect(decide(workstreamOwner, "resource.read", project, baseContext)).toEqual({
      allowed: true,
    });
    expect(decide(workstreamContributor, "resource.read", workstream, baseContext)).toEqual({
      allowed: true,
    });
    expect(decide(otherEmployee, "resource.read", project, baseContext)).toEqual({
      allowed: false,
      reasonCode: "SCOPE_MISMATCH",
    });
    expect(decide(otherManager, "resource.read", project, baseContext)).toEqual({
      allowed: false,
      reasonCode: "SCOPE_MISMATCH",
    });
  });

  it("keeps owner roles as coordination rather than managerial roles", () => {
    expect(
      decide(projectOwner, "managerFeedback.response.read", submittedResponse, baseContext),
    ).toEqual({ allowed: false, reasonCode: "ROLE_REQUIRED" });
  });

  it("separates participant readiness detail from the manager operational summary", () => {
    const project = {
      kind: "project",
      projectId: "project-1",
      departmentId: "department-ai",
    } as const;
    const dualRoleOwnerManager: import("./model.js").PolicyInput = {
      subjectId: projectOwner.subjectId,
      active: true,
      roles: [
        ...projectOwner.roles,
        { role: "manager", scopeType: "department", scopeId: "department-ai" },
      ],
    };

    expect(decide(manager, "document.readiness.summary.read", project, baseContext)).toEqual({
      allowed: true,
    });
    expect(decide(manager, "document.readiness.detail.read", project, baseContext)).toEqual({
      allowed: false,
      reasonCode: "ROLE_REQUIRED",
    });
    expect(decide(projectOwner, "document.readiness.detail.read", project, baseContext)).toEqual({
      allowed: true,
    });
    expect(
      decide(dualRoleOwnerManager, "document.readiness.detail.read", project, baseContext),
    ).toEqual({
      allowed: false,
      reasonCode: "ROLE_REQUIRED",
    });
  });

  it("does not inherit hierarchical resource reads for readiness detail", () => {
    const project = {
      kind: "project",
      projectId: "project-1",
      departmentId: "department-ai",
    } as const;
    const workstream = {
      kind: "workstream",
      workstreamId: "workstream-1",
      projectId: "project-1",
      departmentId: "department-ai",
    } as const;

    expect(decide(workstreamOwner, "resource.read", project, baseContext)).toEqual({
      allowed: true,
    });
    expect(decide(workstreamOwner, "document.readiness.detail.read", project, baseContext)).toEqual(
      {
        allowed: false,
        reasonCode: "ROLE_REQUIRED",
      },
    );
    expect(decide(projectOwner, "resource.read", workstream, baseContext)).toEqual({
      allowed: true,
    });
    expect(decide(projectOwner, "document.readiness.detail.read", workstream, baseContext)).toEqual(
      {
        allowed: false,
        reasonCode: "ROLE_REQUIRED",
      },
    );
  });

  it("uses owner-management boundaries for analysis and criteria approval actions", () => {
    const project = {
      kind: "project",
      projectId: "project-1",
      departmentId: "department-ai",
    } as const;
    for (const action of [
      "document.analysis.run",
      "document.comparison.review",
      "criteria.generate",
      "criteria.owner.review",
      "criteria.activate",
    ] as const) {
      expect(decide(projectOwner, action, project, baseContext)).toEqual({ allowed: true });
      expect(decide(otherEmployee, action, project, baseContext)).toEqual({
        allowed: false,
        reasonCode: "ROLE_REQUIRED",
      });
    }
  });

  it("binds permanent and acting owner roles to matching responsibility windows", () => {
    const project = {
      kind: "project",
      projectId: "project-1",
      departmentId: "department-ai",
    } as const;
    const actingWindow = {
      subjectId: projectOwner.subjectId,
      scopeType: "project",
      scopeId: "project-1",
      responsibilityType: "acting",
      startsAt: "2026-07-15T08:00:00.000Z",
      endsAt: "2026-07-15T16:00:00.000Z",
    } as const;
    const permanentWindow = {
      ...actingWindow,
      subjectId: actingOwner.subjectId,
      responsibilityType: "permanent",
      endsAt: null,
    } as const;

    expect(
      decide(projectOwner, "criteria.owner.review", project, {
        now,
        responsibilityWindows: [actingWindow],
      }),
    ).toEqual({ allowed: false, reasonCode: "RESOURCE_STATE" });
    expect(
      decide(actingOwner, "criteria.owner.review", project, {
        now,
        responsibilityWindows: [permanentWindow],
      }),
    ).toEqual({ allowed: false, reasonCode: "RESOURCE_STATE" });
    expect(
      decide(actingOwner, "criteria.owner.review", project, {
        now,
        responsibilityWindows: [{ ...actingWindow, subjectId: actingOwner.subjectId }],
      }),
    ).toEqual({ allowed: true });
  });

  it("delegates contributor eligibility to the frozen review snapshot", () => {
    const reviewSnapshot = {
      kind: "criteriaReviewSnapshot",
      reviewSnapshotId: "snapshot-1",
      workstreamId: "workstream-1",
      projectId: "project-1",
      departmentId: "department-ai",
    } as const;
    const formerContributor = subject(
      "workstream-contributor-1",
      "employee",
      "department",
      "department-other",
    );

    expect(
      decide(formerContributor, "criteria.contributor.respond", reviewSnapshot, {
        now,
        responsibilityWindows: [],
      }),
    ).toEqual({ allowed: true });
    expect(
      decide(
        { ...formerContributor, active: false },
        "criteria.contributor.respond",
        reviewSnapshot,
        baseContext,
      ),
    ).toEqual({ allowed: false, reasonCode: "INACTIVE" });
    expect(
      decide(administrator, "criteria.contributor.respond", reviewSnapshot, baseContext),
    ).toEqual({ allowed: false, reasonCode: "ROLE_REQUIRED" });
  });

  it("limits objection resolution to the matching department manager", () => {
    const workstream = {
      kind: "workstream",
      workstreamId: "workstream-1",
      projectId: "project-1",
      departmentId: "department-ai",
    } as const;

    expect(decide(manager, "criteria.manager.resolve", workstream, baseContext)).toEqual({
      allowed: true,
    });
    expect(decide(otherManager, "criteria.manager.resolve", workstream, baseContext)).toEqual({
      allowed: false,
      reasonCode: "SCOPE_MISMATCH",
    });
    expect(decide(workstreamOwner, "criteria.manager.resolve", workstream, baseContext)).toEqual({
      allowed: false,
      reasonCode: "ROLE_REQUIRED",
    });
  });

  it("allows only the scoped System Administrator to query audit events", () => {
    const resource = { kind: "system", systemId: "evaluation-system" } as const;
    expect(decide(administrator, "audit.query", resource, baseContext)).toEqual({ allowed: true });
    expect(decide(employee, "audit.query", resource, baseContext)).toEqual({
      allowed: false,
      reasonCode: "ROLE_REQUIRED",
    });
    expect(
      decide(administrator, "audit.query", { ...resource, systemId: "other-system" }, baseContext),
    ).toEqual({ allowed: false, reasonCode: "SCOPE_MISMATCH" });
  });

  it("allows an acting owner only during the matching responsibility window", () => {
    expect(
      decide(
        actingOwner,
        "project.manage",
        { kind: "project", projectId: "project-1", departmentId: "department-ai" },
        {
          now,
          responsibilityWindows: [
            {
              subjectId: actingOwner.subjectId,
              scopeType: "project",
              scopeId: "project-1",
              responsibilityType: "acting",
              startsAt: "2026-07-15T08:00:00.000Z",
              endsAt: "2026-07-15T16:00:00.000Z",
            },
          ],
        },
      ),
    ).toEqual({ allowed: true });
  });

  it("denies an acting owner after the responsibility window ends", () => {
    expect(
      decide(
        actingOwner,
        "project.manage",
        { kind: "project", projectId: "project-1", departmentId: "department-ai" },
        {
          now,
          responsibilityWindows: [
            {
              subjectId: actingOwner.subjectId,
              scopeType: "project",
              scopeId: "project-1",
              responsibilityType: "acting",
              startsAt: "2026-07-14T08:00:00.000Z",
              endsAt: "2026-07-15T12:00:00.000Z",
            },
          ],
        },
      ),
    ).toEqual({ allowed: false, reasonCode: "RESOURCE_STATE" });
  });

  it("denies an acting owner outside the delegated scope", () => {
    expect(
      decide(
        actingOwner,
        "project.manage",
        { kind: "project", projectId: "project-2", departmentId: "department-ai" },
        {
          now,
          responsibilityWindows: [
            {
              subjectId: actingOwner.subjectId,
              scopeType: "project",
              scopeId: "project-1",
              responsibilityType: "acting",
              startsAt: "2026-07-15T08:00:00.000Z",
              endsAt: "2026-07-15T16:00:00.000Z",
            },
          ],
        },
      ),
    ).toEqual({ allowed: false, reasonCode: "SCOPE_MISMATCH" });
  });

  it("requires exact action authority for continuity delegation actions", () => {
    const project = {
      kind: "project",
      projectId: "project-1",
      departmentId: "department-ai",
    } as const;
    const authority = {
      delegationId: "delegation-1",
      subjectId: actingOwner.subjectId,
      scopeType: "project",
      scopeId: "project-1",
      action: "project.update",
      startsAt: "2026-07-15T08:00:00.000Z",
      endsAt: "2026-07-15T16:00:00.000Z",
    } as const;

    expect(
      decide(actingOwner, "project.update", project, { now, actingAuthorities: [authority] }),
    ).toEqual({ allowed: true });
    expect(
      decide(actingOwner, "project.document.update", project, {
        now,
        actingAuthorities: [authority],
      }),
    ).toEqual({ allowed: false, reasonCode: "RESOURCE_STATE" });
    expect(
      decide(actingOwner, "project.transferPermanentOwner", project, {
        now,
        actingAuthorities: [authority],
      }),
    ).toEqual({ allowed: false, reasonCode: "ROLE_REQUIRED" });
  });

  it("allows a contributor inside the assigned Workstream scope", () => {
    expect(
      decide(
        workstreamContributor,
        "resource.contribute",
        {
          kind: "workstream",
          workstreamId: "workstream-1",
          projectId: "project-1",
          departmentId: "department-ai",
        },
        baseContext,
      ),
    ).toEqual({ allowed: true });
  });

  it("denies a contributor outside the assigned Workstream scope", () => {
    expect(
      decide(
        workstreamContributor,
        "resource.contribute",
        {
          kind: "workstream",
          workstreamId: "workstream-2",
          projectId: "project-1",
          departmentId: "department-ai",
        },
        baseContext,
      ),
    ).toEqual({ allowed: false, reasonCode: "SCOPE_MISMATCH" });
  });

  it("allows a Workstream Acting Owner only during the matching responsibility window", () => {
    expect(
      decide(
        workstreamActingOwner,
        "workstream.manage",
        {
          kind: "workstream",
          workstreamId: "workstream-1",
          projectId: "project-1",
          departmentId: "department-ai",
        },
        {
          now,
          responsibilityWindows: [
            {
              subjectId: workstreamActingOwner.subjectId,
              scopeType: "workstream",
              scopeId: "workstream-1",
              projectId: "project-1",
              responsibilityType: "acting",
              startsAt: "2026-07-15T08:00:00.000Z",
              endsAt: "2026-07-15T16:00:00.000Z",
            },
          ],
        },
      ),
    ).toEqual({ allowed: true });
  });

  it("denies a Workstream Acting Owner after the responsibility window ends", () => {
    expect(
      decide(
        workstreamActingOwner,
        "workstream.manage",
        {
          kind: "workstream",
          workstreamId: "workstream-1",
          projectId: "project-1",
          departmentId: "department-ai",
        },
        {
          now,
          responsibilityWindows: [
            {
              subjectId: workstreamActingOwner.subjectId,
              scopeType: "workstream",
              scopeId: "workstream-1",
              projectId: "project-1",
              responsibilityType: "acting",
              startsAt: "2026-07-14T08:00:00.000Z",
              endsAt: "2026-07-15T12:00:00.000Z",
            },
          ],
        },
      ),
    ).toEqual({ allowed: false, reasonCode: "RESOURCE_STATE" });
  });

  it("denies a Workstream Acting Owner outside the delegated scope", () => {
    expect(
      decide(
        workstreamActingOwner,
        "workstream.manage",
        {
          kind: "workstream",
          workstreamId: "workstream-2",
          projectId: "project-1",
          departmentId: "department-ai",
        },
        {
          now,
          responsibilityWindows: [
            {
              subjectId: workstreamActingOwner.subjectId,
              scopeType: "workstream",
              scopeId: "workstream-1",
              projectId: "project-1",
              responsibilityType: "acting",
              startsAt: "2026-07-15T08:00:00.000Z",
              endsAt: "2026-07-15T16:00:00.000Z",
            },
          ],
        },
      ),
    ).toEqual({ allowed: false, reasonCode: "SCOPE_MISMATCH" });
  });

  it("denies unauthenticated subjects before inspecting roles", () => {
    expect(
      decide(
        null,
        "system.configure",
        { kind: "system", systemId: "evaluation-system" },
        baseContext,
      ),
    ).toEqual({
      allowed: false,
      reasonCode: "UNAUTHENTICATED",
    });
  });

  it("denies inactive subjects before inspecting roles", () => {
    expect(
      decide(
        { ...administrator, active: false },
        "system.configure",
        { kind: "system", systemId: "evaluation-system" },
        baseContext,
      ),
    ).toEqual({ allowed: false, reasonCode: "INACTIVE" });
  });

  it("denies unknown actions by default", () => {
    expect(
      decide(
        administrator,
        "unknown.action",
        { kind: "system", systemId: "evaluation-system" },
        baseContext,
      ),
    ).toEqual({
      allowed: false,
      reasonCode: "ROLE_REQUIRED",
    });
  });

  it.each([
    [{ ...submittedResponse, status: "draft" }],
    [{ ...submittedResponse, visibilityMode: "manager_blinded" }],
  ] as const)("denies a response whose protected state is not readable %#", (response) => {
    expect(decide(manager, "managerFeedback.response.read", response, baseContext)).toEqual({
      allowed: false,
      reasonCode: "RESOURCE_STATE",
    });
  });
});
