import { describe, expect, it } from "vitest";

import {
  AssignWorkItemInputSchema,
  CapturePrivateInboxInputSchema,
  CreateWorkItemInputSchema,
  DismissPrivateInboxInputSchema,
  ListWorkItemsInputSchema,
  ListPrivateInboxInputSchema,
  PrivateInboxItemSchema,
  PromotePrivateInboxInputSchema,
  TransitionWorkItemInputSchema,
  UpdateWorkItemInputSchema,
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

    expect(() =>
      CreateWorkItemInputSchema.parse({
        title: "Unassigned official Task",
        projectId,
        assigneeId: null,
      }),
    ).toThrow();
    expect(() =>
      CreateWorkItemInputSchema.parse({
        title: "Missing responsible employee",
        projectId,
      }),
    ).toThrow();
  });

  it("validates the normal Task workspace view and layout", () => {
    expect(ListWorkItemsInputSchema.parse({})).toEqual({
      view: "my",
      layout: "list",
      limit: 100,
      cursor: null,
    });
    expect(
      ListWorkItemsInputSchema.parse({
        view: "team",
        layout: "calendar",
        limit: "25",
      }),
    ).toMatchObject({ view: "team", layout: "calendar", limit: 25 });
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
    expect(() =>
      AssignWorkItemInputSchema.parse({
        assigneeId: null,
        expectedVersion: 4,
        reason: "Remove responsibility",
      }),
    ).toThrow();
    expect(() =>
      UpdateWorkItemInputSchema.parse({
        assigneeId: null,
        expectedVersion: 4,
        reason: "Remove responsibility",
      }),
    ).toThrow();
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

describe("private inbox contracts", () => {
  it("accepts a private unlinked capture without creating an official Task", () => {
    expect(
      CapturePrivateInboxInputSchema.parse({
        text: "راجع ملاحظات اجتماع العميل",
      }),
    ).toEqual({
      text: "راجع ملاحظات اجتماع العميل",
      projectId: null,
    });

    expect(
      PrivateInboxItemSchema.parse({
        id: "00000000-0000-4000-8000-000000000105",
        employeeId,
        text: "راجع ملاحظات اجتماع العميل",
        projectId: null,
        status: "open",
        promotedWorkItemId: null,
        version: 1,
        createdAt: "2026-07-20T09:00:00Z",
        updatedAt: "2026-07-20T09:00:00Z",
      }),
    ).toMatchObject({
      employeeId,
      projectId: null,
      promotedWorkItemId: null,
      status: "open",
    });
  });

  it("validates list, dismiss, and Project-linked promotion commands", () => {
    expect(ListPrivateInboxInputSchema.parse({})).toEqual({
      status: "open",
      limit: 50,
      cursor: null,
    });
    expect(
      DismissPrivateInboxInputSchema.parse({
        expectedVersion: 1,
        reason: "لم تعد مطلوبة",
      }),
    ).toMatchObject({ expectedVersion: 1 });
    expect(
      PromotePrivateInboxInputSchema.parse({
        title: "مراجعة ملاحظات العميل",
        description: "",
        projectId,
        workstreamId: null,
        assigneeId: employeeId,
        dueAt: null,
        priority: "normal",
        requirements: [],
        acceptanceConditions: [],
        blocker: null,
        nextAction: null,
        expectedVersion: 1,
        reason: "أكد الموظف إنشاء المهمة",
      }),
    ).toMatchObject({ projectId, expectedVersion: 1 });

    expect(() =>
      PromotePrivateInboxInputSchema.parse({
        title: "Unlinked official task",
        projectId: null,
        expectedVersion: 1,
        reason: "invalid",
      }),
    ).toThrow();
  });
});

describe("editable Task contracts", () => {
  it("accepts a checklist, assignee, collaborators, and Workstream edit", () => {
    expect(
      UpdateWorkItemInputSchema.parse({
        workstreamId,
        assigneeId: employeeId,
        collaboratorIds: ["00000000-0000-4000-8000-000000000106"],
        checklist: [
          { text: "Confirm the result", completed: true },
          { text: "Attach the evidence", completed: false },
        ],
        expectedVersion: 2,
        reason: "Employee edited the Task",
      }),
    ).toMatchObject({
      checklist: [
        { text: "Confirm the result", completed: true },
        { text: "Attach the evidence", completed: false },
      ],
    });
  });
});
