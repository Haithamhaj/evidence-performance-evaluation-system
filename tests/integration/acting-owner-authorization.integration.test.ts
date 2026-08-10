import { describe, expect, it } from "vitest";

import { decide } from "../../packages/permissions/src/index.js";

describe("acting owner authorization composition", () => {
  const actor = {
    subjectId: "delegate",
    active: true,
    roles: [{ role: "acting_owner", scopeType: "project", scopeId: "project-1" }],
  } as const;
  const project = {
    kind: "project",
    projectId: "project-1",
    departmentId: "department-1",
  } as const;
  const authority = {
    delegationId: "delegation-1",
    subjectId: "delegate",
    scopeType: "project",
    scopeId: "project-1",
    action: "project.update",
    startsAt: "2026-08-10T08:00:00.000Z",
    endsAt: "2026-08-10T10:00:00.000Z",
  } as const;

  it("allows an exact active action but never permanent ownership transfer", () => {
    expect(
      decide(actor, "project.update", project, {
        now: "2026-08-10T08:00:00.000Z",
        actingAuthorities: [authority],
      }),
    ).toEqual({ allowed: true });
    expect(
      decide(actor, "project.transferPermanentOwner", project, {
        now: "2026-08-10T09:00:00.000Z",
        actingAuthorities: [authority],
      }),
    ).toEqual({ allowed: false, reasonCode: "ROLE_REQUIRED" });
  });

  it("denies an expired authority using the request time", () => {
    expect(
      decide(actor, "project.update", project, {
        now: "2026-08-10T10:00:00.000Z",
        actingAuthorities: [authority],
      }),
    ).toEqual({ allowed: false, reasonCode: "RESOURCE_STATE" });
  });
});
