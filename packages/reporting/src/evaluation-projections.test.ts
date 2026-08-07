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
});
