// @vitest-environment jsdom
/* eslint-disable no-unused-vars */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { ContinuityWorkspace } from "./continuity-workspace.js";

const catalog = new Proxy({}, { get: (_target, key) => String(key) }) as Readonly<
  Record<string, string>
>;

describe("ContinuityWorkspace", () => {
  it("shows a compact manager leave decision with fairness and handover state", () => {
    render(
      <ContinuityWorkspace
        catalog={catalog}
        locale="en"
        view={{
          mode: "manager",
          generatedAt: "2026-08-15T08:00:00.000Z",
          availableScopes: [],
          leaves: [
            {
              id: "20000000-0000-4000-8000-000000000001",
              employeeId: "20000000-0000-4000-8000-000000000002",
              employeeName: "Codex",
              state: "SUBMITTED",
              startsAt: "2026-08-20T00:00:00.000Z",
              endsAt: "2026-08-22T00:00:00.000Z",
              affectedScopeCount: 1,
              version: 1,
              handover: null,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("continuity.experience.managerTitle")).toBeTruthy();
    expect(screen.getByText("continuity.experience.fairnessBoundary")).toBeTruthy();
    expect(screen.getByRole("button", { name: "continuity.experience.approve" })).toBeTruthy();
    expect(screen.queryByText(/performance|score|rating/iu)).toBeNull();
  });

  it("shows the employee a short leave request and scoped handover path", () => {
    render(
      <ContinuityWorkspace
        catalog={catalog}
        locale="en"
        view={{
          mode: "employee",
          generatedAt: "2026-08-15T08:00:00.000Z",
          leaves: [],
          availableScopes: [
            {
              kind: "PROJECT",
              id: "20000000-0000-4000-8000-000000000004",
              name: "Evaluation System",
              departmentId: "20000000-0000-4000-8000-000000000005",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("continuity.experience.employeeTitle")).toBeTruthy();
    expect(screen.getByRole("button", { name: "continuity.experience.submitLeave" })).toBeTruthy();
    expect(screen.getByText("continuity.experience.draftBoundary")).toBeTruthy();
  });
});
