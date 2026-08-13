import { describe, expect, it, vi } from "vitest";
import { ProgressContractService } from "@evaluation/projects";

import { DailyWorkController, ProgressContractsController } from "./daily-work.controller.js";
import { DailyWorkQueryService } from "./daily-work-query.service.js";

const actorId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const documentId = crypto.randomUUID();
const documentVersionId = crypto.randomUUID();
const request = {
  principal: { userId: actorId, email: "Codex@pilot.local", active: true, roles: ["employee"] },
  correlationId: crypto.randomUUID(),
} as never;

function validProposal() {
  return {
    reason: "Approved document is ready for contract review.",
    draft: {
      scopeKind: "project",
      projectId,
      workstreamId: null,
      sourceDocumentId: documentId,
      sourceDocumentVersionId: documentVersionId,
      sourceDocumentVersion: 2,
      calculationKind: "weighted",
      calculationSchemaVersion: "1.0.0",
      effectiveAt: "2026-07-18T12:00:00.000Z",
      components: [
        {
          id: crypto.randomUUID(),
          kind: "milestone",
          name: "Pilot accepted",
          description: "Owner accepts the runnable pilot.",
          weight: 100,
          baseline: null,
          target: null,
          unit: null,
          direction: null,
          acceptanceConditions: ["Acceptance is recorded"],
          requiredEvidence: ["Acceptance record"],
          confirmationMode: "human_confirmed",
        },
      ],
    },
  };
}

describe("daily work protected API contracts", () => {
  it("composes the daily workspace using only the authenticated identity", async () => {
    const dailyWorkspace = vi.fn(async () => ({
      needsMyAction: [],
      today: [],
      overdue: [],
      reviewQueue: [],
      inbox: [],
      projectPulse: [],
      upcoming: [],
    }));
    const controller = new DailyWorkController({ dailyWorkspace } as never);
    await controller.myWork(request);
    expect(dailyWorkspace).toHaveBeenCalledWith({
      userId: actorId,
      active: true,
      roles: ["employee"],
    });
  });

  it("composes Home with the authenticated employee identity", async () => {
    const load = vi.fn(async () => ({ schemaVersion: "employee-home.v1" }));
    const controller = new DailyWorkController(
      {} as never,
      undefined,
      undefined,
      undefined,
      undefined,
      { load } as never,
    );

    await controller.home(request);

    expect(load).toHaveBeenCalledWith({
      userId: actorId,
      email: "Codex@pilot.local",
      active: true,
      roles: ["employee"],
    });
  });

  it("orders primary daily groups and keeps private Inbox access employee-scoped", async () => {
    const task = (id: string, status: "ready" | "in_progress") => ({
      id,
      projectId,
      workstreamId: null,
      title: id,
      description: "",
      status,
      priority: "normal",
      assigneeId: actorId,
      dueAt: null,
      requirements: [],
      acceptanceConditions: [],
      blocker: null,
      nextAction: null,
      version: 1,
      createdAt: "2026-07-20T08:00:00.000Z",
      updatedAt: "2026-07-20T08:00:00.000Z",
      checklist: [],
      collaboratorIds: [],
      allowedActions: ["edit", "transition", "assign", "add_update"],
    });
    const needsAction = task(crypto.randomUUID(), "ready");
    const today = task(crypto.randomUUID(), "in_progress");
    const overdue = task(crypto.randomUUID(), "in_progress");
    const upcoming = task(crypto.randomUUID(), "in_progress");
    const workItems = {
      listMyWork: vi.fn(async () => ({
        groups: [
          { key: "needs_my_action", items: [needsAction], collapsedByDefault: false },
          { key: "today", items: [today], collapsedByDefault: false },
          { key: "overdue", items: [overdue], collapsedByDefault: false },
          { key: "this_week", items: [upcoming], collapsedByDefault: true },
        ],
        nextCursor: null,
      })),
    };
    const inbox = {
      list: vi.fn(async () => ({
        items: [],
        nextCursor: null,
      })),
    };
    const progress = {
      listPortfolio: vi.fn(async () => []),
    };
    const query = new DailyWorkQueryService(
      workItems as never,
      progress as never,
      undefined,
      inbox as never,
    );

    await expect(
      query.dailyWorkspace({ userId: actorId, active: true, roles: ["employee"] }),
    ).resolves.toMatchObject({
      needsMyAction: [{ id: needsAction.id }],
      today: [{ id: today.id }],
      overdue: [{ id: overdue.id }],
      upcoming: [{ id: upcoming.id }],
    });
    expect(inbox.list).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true, roles: ["employee"] },
      input: { status: "open", limit: 20, cursor: null },
    });
  });

  it("composes the Update context through public Project and Work Item readers", async () => {
    const updateContext = vi.fn(async () => ({ projects: [] }));
    const controller = new DailyWorkController({ updateContext } as never);

    await controller.updateContext(request);

    expect(updateContext).toHaveBeenCalledWith(actorId);
  });

  it("binds check-in and readiness reads to the authenticated employee", async () => {
    const checkIns = { listForEmployee: vi.fn(async () => []) };
    const readiness = { employeeProjectMonth: vi.fn(async () => ({ state: "clear" })) };
    const controller = new DailyWorkController({} as never, checkIns, readiness as never);

    await controller.checkInObligations(request);
    await controller.readinessForProject(request, projectId);

    expect(checkIns.listForEmployee).toHaveBeenCalledWith({ employeeId: actorId });
    expect(readiness.employeeProjectMonth).toHaveBeenCalledWith(actorId, projectId);
  });

  it("binds manager operations to the authenticated principal", async () => {
    const managerOperations = { load: vi.fn(async () => ({ approvalsWaiting: [] })) };
    const controller = new DailyWorkController(
      {} as never,
      undefined,
      undefined,
      managerOperations as never,
    );

    await controller.managerOperationsView(request);

    expect(managerOperations.load).toHaveBeenCalledWith(actorId);
  });

  it("server-composes the approved source request without exposing document identity", async () => {
    const progress = {
      getProjectProgress: vi.fn(async () => ({
        project: { id: projectId },
        contract: null,
        progress: { state: "awaiting_contract" },
      })),
    };
    const sourceRequests = {
      locateApprovedProjectVersion: vi.fn(async () => ({
        documentVersionId,
        sourceChecksum: "a".repeat(64),
        sourceVersion: 2,
      })),
    };
    const query = new DailyWorkQueryService({} as never, progress as never, sourceRequests);

    await expect(query.project(actorId, projectId)).resolves.toEqual({
      project: { id: projectId },
      contract: null,
      progress: { state: "awaiting_contract" },
      contractDraftSourceRequest: {
        documentVersionId,
        sourceChecksum: "a".repeat(64),
        sourceVersion: 2,
      },
    });
    expect(sourceRequests.locateApprovedProjectVersion).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      projectId,
    });
  });

  it("uses the bounded Project dashboard composition for the operational pulse", async () => {
    const pulse = {
      officialProgress: 64,
      previousOfficialProgress: 50,
      sourceCoverage: "INSUFFICIENT",
      milestoneStates: [],
      nextRequiredEvidence: [],
      explanation: [],
    } as const;
    const projectDashboard = {
      load: vi.fn(async () => ({
        project: { id: projectId },
        contract: null,
        progress: { state: "awaiting_information" },
        pulse,
      })),
    };
    const query = new DailyWorkQueryService(
      {} as never,
      {} as never,
      undefined,
      undefined,
      projectDashboard,
    );

    await expect(query.project(actorId, projectId)).resolves.toMatchObject({ pulse });
    expect(projectDashboard.load).toHaveBeenCalledWith(actorId, projectId);
  });

  it("rejects cross-Project contracts before domain mutation", () => {
    const service = { propose: vi.fn() };
    const controller = new ProgressContractsController(service as never);
    const proposal = validProposal();
    proposal.draft.projectId = crypto.randomUUID();
    expect(() => controller.propose(request, projectId, proposal)).toThrow();
    expect(service.propose).not.toHaveBeenCalled();
  });

  it.each(["manualPercent", "rating", "rank", "productivityScore"])(
    "rejects forbidden %s input",
    (field) => {
      const controller = new ProgressContractsController({} as never);
      expect(() =>
        controller.propose(request, projectId, {
          ...validProposal(),
          [field]: 90,
        }),
      ).toThrow();
    },
  );

  it("rejects stale or unknown decision input fields", () => {
    const controller = new ProgressContractsController({} as never);
    expect(() =>
      controller.approve(request, projectId, crypto.randomUUID(), {
        expectedVersion: 2,
        reason: "Approved",
        actorId,
      }),
    ).toThrow();
  });

  it("binds a progress-contract decision to the Project in the route", async () => {
    const approve = vi.fn(async () => ({ state: "active" }));
    const controller = new ProgressContractsController({ approve } as never);
    const contractId = crypto.randomUUID();

    await controller.approve(request, projectId, contractId, {
      expectedVersion: 2,
      reason: "Approved measurable rules.",
    });

    expect(approve).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
        contractId,
      }),
    );
  });

  it.each(["propose", "submit", "approve", "reject"] as const)(
    "projects a role-bearing principal into the strict %s command actor",
    async (operation) => {
      const reachedPersistence = new Error("strict command accepted the controller actor");
      const service = new ProgressContractService(
        {
          $transaction: vi.fn(async () => {
            throw reachedPersistence;
          }),
        } as never,
        {} as never,
        {} as never,
        {} as never,
        () => new Date("2026-07-19T08:00:00.000Z"),
        {} as never,
      );
      const controller = new ProgressContractsController(service);
      const contractId = crypto.randomUUID();

      await expect(
        Promise.resolve().then(() =>
          operation === "propose"
            ? controller.propose(request, projectId, validProposal())
            : controller[operation](request, projectId, contractId, {
                expectedVersion: 1,
                reason: "Continue the protected Progress Contract workflow.",
              }),
        ),
      ).rejects.toBe(reachedPersistence);
    },
  );
});
