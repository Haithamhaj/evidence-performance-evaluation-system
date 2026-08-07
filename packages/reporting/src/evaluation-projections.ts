import { EvaluationReportReader } from "@evaluation/employee-evaluation";
import { IdentifiedProjectionPolicy } from "@evaluation/manager-evaluation";

import { ProjectionRegistry } from "./projection-registry.js";

type Database = import("@evaluation/database").DatabaseClient;

export function createEvaluationProjectionRegistry(database: Database) {
  const employee = new EvaluationReportReader(database);
  const upward = new IdentifiedProjectionPolicy(database);
  const registry = new ProjectionRegistry();

  registry.register({
    reportType: "EMPLOYEE_EVALUATION",
    audience: "EMPLOYEE_SELF",
    source: "employee-evaluation",
    projectionVersion: 2,
    snapshot: async ({ requesterId, cycleId }) => {
      if (!cycleId) throw new Error("EVALUATION_CYCLE_REQUIRED");
      const snapshot = await employee.resolveEmployeeExportSnapshot({
        cycleId,
        employeeId: requesterId,
      });
      return { snapshotId: snapshot.snapshotId, version: snapshot.version };
    },
    read: async (version, { requesterId, cycleId }) => {
      if (!cycleId) throw new Error("EVALUATION_CYCLE_REQUIRED");
      const snapshot = await employee.resolveEmployeeExportSnapshot({
        cycleId,
        employeeId: requesterId,
      });
      assertPinned(snapshot, version);
      const projection = await employee.readEmployee({
        assignmentId: snapshot.assignmentId,
        requester: { actorId: requesterId, access: "self", active: true },
      });
      return {
        title: "Employee evaluation",
        lines: [
          `Cycle: ${projection.cycleType}`,
          `State: ${projection.state}`,
          ...(projection.finalSnapshot?.entries.map(
            (decision) => `${decision.criterionId}: ${decision.rating} — ${decision.justification}`,
          ) ?? []),
        ],
      };
    },
  });

  registry.register({
    reportType: "DEPARTMENT_EVALUATION",
    audience: "MANAGER_DEPARTMENT",
    source: "employee-evaluation-department",
    projectionVersion: 2,
    snapshot: async ({ requesterId, cycleId }) => {
      const cycle = await closedEmployeeCycle(database, cycleId, requesterId);
      return { snapshotId: cycle.id, version: cycle.version };
    },
    read: async (version, { requesterId, cycleId }) => {
      const cycle = await closedEmployeeCycle(database, cycleId, requesterId);
      assertPinned(cycle, version);
      const projection = await employee.readDepartment({
        cycleId: cycle.id,
        requester: {
          actorId: requesterId,
          departmentId: cycle.departmentId,
          access: "assigned_manager",
          active: true,
        },
      });
      return {
        title: "Department evaluation",
        lines: [
          `Cycle: ${projection.cycleType}`,
          `State: ${projection.state}`,
          ...projection.ratingDistributions.map(
            (distribution) =>
              `${distribution.criterionStableId}: ${distribution.buckets.map(({ rating, count }) => `${rating}=${count}`).join(", ")}`,
          ),
        ],
      };
    },
  });

  registry.register({
    reportType: "MANAGER_UPWARD_FEEDBACK",
    audience: "MANAGER_IDENTIFIED_UPWARD",
    source: "manager-evaluation-identified",
    projectionVersion: 1,
    snapshot: async ({ requesterId, cycleId }) => {
      const cycle = await closedManagerCycle(database, cycleId, requesterId);
      return { snapshotId: cycle.snapshot!.id, version: cycle.version };
    },
    read: async (version, { requesterId, cycleId }) => {
      const cycle = await closedManagerCycle(database, cycleId, requesterId);
      assertPinned({ snapshotId: cycle.snapshot!.id, version: cycle.version }, version);
      const projection = await upward.readManagerCycle({
        cycleId: cycle.id,
        managerId: requesterId,
        reason: "Generate the manager's authorized identified upward report.",
      });
      return {
        title: "Identified upward feedback",
        lines: projection.responses.flatMap((response) => [
          `Submitter: ${response.submitterDisplayName}`,
          ...response.responses.map(
            (entry) => `${entry.criterionId}: ${entry.rating} — ${entry.comment}`,
          ),
        ]),
      };
    },
  });
  return registry;
}

async function closedEmployeeCycle(database: Database, cycleId: string | null, managerId: string) {
  if (!cycleId) throw new Error("EVALUATION_CYCLE_REQUIRED");
  const cycle = await database.employeeEvaluationCycle.findUnique({
    where: { id: cycleId },
    select: {
      id: true,
      version: true,
      state: true,
      departmentId: true,
      assignments: { where: { managerId }, select: { id: true }, take: 1 },
    },
  });
  if (!cycle || cycle.state !== "CLOSED" || cycle.assignments.length === 0) {
    throw new Error("DEPARTMENT_EVALUATION_EXPORT_NOT_READY");
  }
  return cycle;
}

async function closedManagerCycle(database: Database, cycleId: string | null, managerId: string) {
  if (!cycleId) throw new Error("MANAGER_EVALUATION_CYCLE_REQUIRED");
  const cycle = await database.managerEvaluationCycle.findUnique({
    where: { id: cycleId },
    select: {
      id: true,
      version: true,
      state: true,
      managerId: true,
      visibilityMode: true,
      snapshot: { select: { id: true } },
    },
  });
  if (
    !cycle ||
    cycle.state !== "CLOSED" ||
    cycle.managerId !== managerId ||
    cycle.visibilityMode !== "IDENTIFIED" ||
    !cycle.snapshot
  ) {
    throw new Error("MANAGER_EVALUATION_EXPORT_NOT_READY");
  }
  return cycle;
}

function assertPinned(
  actual: Readonly<{ snapshotId?: string; id?: string; version: number }>,
  expected: Readonly<{ snapshotId: string; version: number }>,
) {
  if (
    (actual.snapshotId ?? actual.id) !== expected.snapshotId ||
    actual.version !== expected.version
  ) {
    throw new Error("EVALUATION_SNAPSHOT_VERSION_MISMATCH");
  }
}
