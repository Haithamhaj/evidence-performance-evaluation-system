/* eslint-disable no-unused-vars */
import { createDatabaseClient } from "@evaluation/database";

/**
 * Deterministic E5B fixture entrypoint. It intentionally delegates organization
 * identity to the approved pilot seed; its returned IDs support the employee →
 * private action → bounded sharing → manager support → formal-plan evidence journey.
 */
export async function seedCoachingDevelopmentAcceptance(
  database: ReturnType<typeof createDatabaseClient>,
) {
  const employee = await database.user.findUniqueOrThrow({ where: { pilotKey: "pilot-employee" } });
  const manager = await database.user.findUniqueOrThrow({ where: { pilotKey: "pilot-manager" } });
  return {
    employeeId: employee.id,
    managerId: manager.id,
    journey: [
      "INSIGHT_DECIDED",
      "ACTION_PRIVATE",
      "ACTION_SHARED",
      "MANAGER_SUPPORTED",
      "PLAN_EMPLOYEE_APPROVED",
      "PLAN_MANAGER_AGREED",
      "CONFIRMED_EVIDENCE_LINKED",
    ] as const,
  };
}
