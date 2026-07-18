import { describe, expect, it } from "vitest";

import {
  AssignWorkItemInputSchema,
  CreateWorkItemInputSchema,
  TransitionWorkItemInputSchema,
  WorkItemDetailSchema,
} from "./work-items.js";

const projectId = "00000000-0000-4000-8000-000000000101";
const workstreamId = "00000000-0000-4000-8000-000000000102";
const employeeId = "00000000-0000-4000-8000-000000000103";

describe("work item contracts", () => {
  it("requires a Project and accepts an optional Workstream", () => {
    expect(
      CreateWorkItemInputSchema.parse({
        title: "مراجعة عقد التقدم",
        description: "تحقق من خط الأساس والهدف.",
        projectId,
        workstreamId,
        assigneeId: employeeId,
        dueAt: "2026-07-20T09:00:00+03:00",
        priority: "high",
        requirements: ["اعتماد المصدر"],
        acceptanceConditions: ["تأكيد المالك"],
      }),
    ).toMatchObject({ projectId, workstreamId, assigneeId: employeeId });

    expect(() =>
      CreateWorkItemInputSchema.parse({
        title: "Review",
        projectId: "",
        workstreamId: null,
      }),
    ).toThrow();
  });

  it("keeps transitions and assignments optimistic and reasoned", () => {
    expect(
      TransitionWorkItemInputSchema.parse({
        status: "in_progress",
        expectedVersion: 2,
        reason: "بدأ التنفيذ",
      }),
    ).toMatchObject({ status: "in_progress", expectedVersion: 2 });
    expect(
      AssignWorkItemInputSchema.parse({
        assigneeId: employeeId,
        expectedVersion: 3,
        reason: "نقل المسؤولية",
      }),
    ).toMatchObject({ assigneeId: employeeId, expectedVersion: 3 });
  });

  it("does not admit progress or performance fields", () => {
    expect(() =>
      WorkItemDetailSchema.parse({
        id: "00000000-0000-4000-8000-000000000104",
        projectId,
        workstreamId: null,
        title: "Review",
        description: "",
        status: "done",
        priority: "normal",
        assigneeId: employeeId,
        dueAt: null,
        requirements: [],
        acceptanceConditions: [],
        blocker: null,
        nextAction: null,
        version: 4,
        createdAt: "2026-07-18T10:00:00Z",
        updatedAt: "2026-07-18T11:00:00Z",
        progressPercent: 100,
      }),
    ).toThrow();
  });
});
