// @vitest-environment jsdom
/* eslint-disable no-unused-vars */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { ContinuityWorkspace } from "./continuity-workspace.js";

const catalog = new Proxy({}, { get: (_target, key) => String(key) }) as Readonly<
  Record<string, string>
>;

afterEach(cleanup);

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
          delegationCandidates: [],
          delegations: [],
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
          delegationCandidates: [],
          delegations: [
            {
              id: "20000000-0000-4000-8000-000000000010",
              leaveId: "20000000-0000-4000-8000-000000000011",
              role: "delegate",
              ownerName: "Eva",
              delegateName: "Codex",
              state: "PENDING_DELEGATE",
              startsAt: "2026-08-20T00:00:00.000Z",
              endsAt: "2026-08-22T00:00:00.000Z",
              scopes: [
                {
                  kind: "PROJECT",
                  id: "20000000-0000-4000-8000-000000000004",
                  name: "Evaluation System",
                  actions: ["project.update"],
                },
              ],
              delegateConfirmed: false,
              openAccessGapCount: 0,
              returnHandover: null,
            },
          ],
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
    expect(
      screen.getByRole("button", { name: "continuity.experience.confirmDelegation" }),
    ).toBeTruthy();
  });

  it("lets a manager choose a delegate for an exact approved scope and leave window", () => {
    render(
      <ContinuityWorkspace
        catalog={catalog}
        locale="en"
        view={{
          mode: "manager",
          generatedAt: "2026-08-15T08:00:00.000Z",
          availableScopes: [],
          delegationCandidates: [
            {
              id: "20000000-0000-4000-8000-000000000012",
              name: "Eva",
              departmentId: "20000000-0000-4000-8000-000000000003",
            },
          ],
          delegations: [],
          leaves: [
            {
              id: "20000000-0000-4000-8000-000000000001",
              employeeId: "20000000-0000-4000-8000-000000000002",
              employeeName: "Codex",
              state: "APPROVED",
              startsAt: "2026-08-20T00:00:00.000Z",
              endsAt: "2026-08-22T00:00:00.000Z",
              affectedScopeCount: 1,
              affectedScopes: [
                {
                  kind: "PROJECT",
                  id: "20000000-0000-4000-8000-000000000004",
                  name: "Evaluation System",
                  departmentId: "20000000-0000-4000-8000-000000000003",
                },
              ],
              version: 2,
              handover: {
                id: "20000000-0000-4000-8000-000000000005",
                revision: 1,
                itemCount: 1,
                confirmed: true,
              },
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("option", { name: "Eva" })).toBeTruthy();
    expect(screen.getAllByText("Evaluation System").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "continuity.experience.approveDelegation" }),
    ).toBeTruthy();
  });

  it("shows the human-gated return path to delegate, owner, and manager", () => {
    const base = {
      id: "20000000-0000-4000-8000-000000000010",
      leaveId: "20000000-0000-4000-8000-000000000011",
      ownerName: "Eva",
      delegateName: "Codex",
      startsAt: "2026-08-20T00:00:00.000Z",
      endsAt: "2026-08-22T00:00:00.000Z",
      scopes: [
        {
          kind: "PROJECT" as const,
          id: "20000000-0000-4000-8000-000000000004",
          name: "Evaluation System",
          actions: ["project.update"],
        },
      ],
      delegateConfirmed: true,
      openAccessGapCount: 0,
    };
    const common = {
      generatedAt: "2026-08-15T08:00:00.000Z",
      availableScopes: [],
      delegationCandidates: [],
      leaves: [],
    };

    const { unmount } = render(
      <ContinuityWorkspace
        catalog={catalog}
        locale="en"
        view={{
          ...common,
          mode: "employee",
          delegations: [{ ...base, role: "delegate", state: "ACTIVE", returnHandover: null }],
        }}
      />,
    );
    expect(screen.getByText("continuity.experience.prepareReturn")).toBeTruthy();
    unmount();

    const { unmount: unmountOwner } = render(
      <ContinuityWorkspace
        catalog={catalog}
        locale="en"
        view={{
          ...common,
          mode: "employee",
          delegations: [
            {
              ...base,
              role: "owner",
              state: "ACTIVE",
              returnHandover: {
                id: "20000000-0000-4000-8000-000000000013",
                state: "DRAFT",
                version: 1,
              },
            },
          ],
        }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "continuity.experience.confirmReturn" }),
    ).toBeTruthy();
    unmountOwner();

    render(
      <ContinuityWorkspace
        catalog={catalog}
        locale="en"
        view={{
          ...common,
          mode: "manager",
          delegations: [
            {
              ...base,
              role: "manager",
              state: "ACTIVE",
              returnHandover: {
                id: "20000000-0000-4000-8000-000000000013",
                state: "OWNER_CONFIRMED",
                version: 2,
              },
            },
          ],
        }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "continuity.experience.finalizeReturn" }),
    ).toBeTruthy();
  });
});
