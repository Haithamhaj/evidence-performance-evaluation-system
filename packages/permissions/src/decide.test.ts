import { describe, expect, it } from "vitest";

import { decide } from "./decide.js";

const now = "2026-07-15T12:00:00.000Z";
const baseContext: import("./model.js").PolicyContext = { now };

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
    [projectOwner, "project.manage", { kind: "project", projectId: "project-1" }],
    [
      workstreamOwner,
      "workstream.manage",
      { kind: "workstream", workstreamId: "workstream-1", projectId: "project-1" },
    ],
    [contributor, "resource.contribute", { kind: "project", projectId: "project-1" }],
    [manager, "department.manage", { kind: "department", departmentId: "department-ai" }],
    [administrator, "system.configure", { kind: "system", systemId: "evaluation-system" }],
  ] as const)("allows the approved scoped role %#", (policySubject, action, resource) => {
    expect(decide(policySubject, action, resource, baseContext)).toEqual({ allowed: true });
  });

  it.each([
    [projectOwner, "project.manage", { kind: "project", projectId: "project-2" }],
    [
      workstreamOwner,
      "workstream.manage",
      { kind: "workstream", workstreamId: "workstream-2", projectId: "project-1" },
    ],
    [contributor, "resource.contribute", { kind: "project", projectId: "project-2" }],
    [manager, "department.manage", { kind: "department", departmentId: "department-other" }],
  ] as const)("denies an approved role outside its scope %#", (policySubject, action, resource) => {
    expect(decide(policySubject, action, resource, baseContext)).toEqual({
      allowed: false,
      reasonCode: "SCOPE_MISMATCH",
    });
  });

  it("keeps owner roles as coordination rather than managerial roles", () => {
    expect(
      decide(projectOwner, "managerFeedback.response.read", submittedResponse, baseContext),
    ).toEqual({ allowed: false, reasonCode: "ROLE_REQUIRED" });
  });

  it("allows an acting owner only during the matching responsibility window", () => {
    expect(
      decide(
        actingOwner,
        "project.manage",
        { kind: "project", projectId: "project-1" },
        {
          now,
          actingOwnerWindows: [
            {
              subjectId: actingOwner.subjectId,
              scopeType: "project",
              scopeId: "project-1",
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
        { kind: "project", projectId: "project-1" },
        {
          now,
          actingOwnerWindows: [
            {
              subjectId: actingOwner.subjectId,
              scopeType: "project",
              scopeId: "project-1",
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
        { kind: "project", projectId: "project-2" },
        {
          now,
          actingOwnerWindows: [
            {
              subjectId: actingOwner.subjectId,
              scopeType: "project",
              scopeId: "project-1",
              startsAt: "2026-07-15T08:00:00.000Z",
              endsAt: "2026-07-15T16:00:00.000Z",
            },
          ],
        },
      ),
    ).toEqual({ allowed: false, reasonCode: "SCOPE_MISMATCH" });
  });

  it("allows a contributor inside the assigned Workstream scope", () => {
    expect(
      decide(
        workstreamContributor,
        "resource.contribute",
        { kind: "workstream", workstreamId: "workstream-1", projectId: "project-1" },
        baseContext,
      ),
    ).toEqual({ allowed: true });
  });

  it("denies a contributor outside the assigned Workstream scope", () => {
    expect(
      decide(
        workstreamContributor,
        "resource.contribute",
        { kind: "workstream", workstreamId: "workstream-2", projectId: "project-1" },
        baseContext,
      ),
    ).toEqual({ allowed: false, reasonCode: "SCOPE_MISMATCH" });
  });

  it("allows a Workstream Acting Owner only during the matching responsibility window", () => {
    expect(
      decide(
        workstreamActingOwner,
        "workstream.manage",
        { kind: "workstream", workstreamId: "workstream-1", projectId: "project-1" },
        {
          now,
          actingOwnerWindows: [
            {
              subjectId: workstreamActingOwner.subjectId,
              scopeType: "workstream",
              scopeId: "workstream-1",
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
        { kind: "workstream", workstreamId: "workstream-1", projectId: "project-1" },
        {
          now,
          actingOwnerWindows: [
            {
              subjectId: workstreamActingOwner.subjectId,
              scopeType: "workstream",
              scopeId: "workstream-1",
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
        { kind: "workstream", workstreamId: "workstream-2", projectId: "project-1" },
        {
          now,
          actingOwnerWindows: [
            {
              subjectId: workstreamActingOwner.subjectId,
              scopeType: "workstream",
              scopeId: "workstream-1",
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
