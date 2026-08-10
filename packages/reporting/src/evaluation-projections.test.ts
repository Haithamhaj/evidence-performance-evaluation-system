import { describe, expect, it } from "vitest";

import { createEvaluationProjectionRegistry } from "./evaluation-projections.js";

describe("evaluation projection registry", () => {
  it("registers the approved employee, department, and identified-upward report audiences only", () => {
    const registry = createEvaluationProjectionRegistry({} as never);
    expect(registry.resolve("EMPLOYEE_EVALUATION", "EMPLOYEE_SELF").source).toBe(
      "employee-evaluation",
    );
    expect(registry.resolve("DEPARTMENT_EVALUATION", "MANAGER_DEPARTMENT").source).toBe(
      "employee-evaluation-department",
    );
    expect(registry.resolve("MANAGER_UPWARD_FEEDBACK", "MANAGER_IDENTIFIED_UPWARD").source).toBe(
      "manager-evaluation-identified",
    );
    expect(() => registry.resolve("DEPARTMENT_EVALUATION", "EMPLOYEE_SELF")).toThrow(
      "REPORT_PROJECTION_NOT_ALLOWED",
    );
  });

  it("reauthorizes employee export access against the current department role", async () => {
    let rolePresent = true;
    const database = {
      evaluationAssignment: {
        findFirst: async () => ({ cycle: { departmentId: "department" } }),
      },
      roleAssignment: {
        findFirst: async () => (rolePresent ? { id: "role" } : null),
      },
    };
    const entry = createEvaluationProjectionRegistry(database as never).resolve(
      "EMPLOYEE_EVALUATION",
      "EMPLOYEE_SELF",
    );
    const context = {
      requesterId: "10000000-0000-4000-8000-000000000001",
      cycleId: "10000000-0000-4000-8000-000000000002",
    };
    await expect(entry.authorizeCurrent(context)).resolves.toBe(true);
    rolePresent = false;
    await expect(entry.authorizeCurrent(context)).resolves.toBe(false);
  });
});
