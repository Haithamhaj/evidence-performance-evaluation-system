import { describe, expect, it, vi } from "vitest";

import { ActivityReader } from "./activity-reader.js";

const actorId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const workstreamId = "33333333-3333-4333-8333-333333333333";

describe("ActivityReader", () => {
  it("includes workstream events in the Project timeline and paginates stably", async () => {
    const firstPage = [
      timelineItem("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "update", "2026-07-18T12:00:00.000Z"),
      timelineItem("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "evidence", "2026-07-18T11:00:00.000Z"),
    ];
    const secondPage = [
      timelineItem("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "update", "2026-07-18T10:00:00.000Z"),
    ];
    const queryRaw = vi.fn().mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage);
    const reader = new ActivityReader({
      project: { findFirst: vi.fn(async () => ({ id: projectId })) },
      $queryRaw: queryRaw,
    } as never);

    const first = await reader.timeline({
      actorId,
      projectId,
      workstreamId: null,
      limit: 2,
      cursor: null,
    });

    expect(first.items.map((item) => item.kind)).toEqual(["update", "evidence"]);
    expect(first.items[0]).toMatchObject({ workstreamId });
    expect(first.nextCursor).not.toBeNull();

    const second = await reader.timeline({
      actorId,
      projectId,
      workstreamId: null,
      limit: 2,
      cursor: first.nextCursor,
    });
    expect(second.items).toHaveLength(1);
    expect(second.items[0]).toMatchObject({ id: secondPage[0]!.id });
    expect(second.nextCursor).toBeNull();
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it("rejects a Project timeline outside the viewer's authorized scope", async () => {
    const reader = new ActivityReader({
      project: { findFirst: vi.fn(async () => null) },
      $queryRaw: vi.fn(),
    } as never);

    await expect(
      reader.timeline({ actorId, projectId, workstreamId: null, limit: 20, cursor: null }),
    ).rejects.toMatchObject({ code: "SCOPE_MISMATCH", status: 403 });
  });

  it("returns an authorized confirmed result with readable scope names and progress disposition", async () => {
    const acceptedEventId = "44444444-4444-4444-8444-444444444444";
    const draftId = "55555555-5555-4555-8555-555555555555";
    const reader = new ActivityReader({
      acceptedUpdateEvent: {
        findFirst: vi.fn(async () => ({
          id: acceptedEventId,
          employeeId: actorId,
          sourceReferences: [`update-source:${draftId}:1`],
          occurredAt: new Date("2026-07-18T12:00:00.000Z"),
          project: { id: projectId, name: "Atlas Delivery" },
          workstream: { id: workstreamId, name: "API readiness" },
          workItem: null,
          confirmation: {
            confirmedAt: new Date("2026-07-18T12:00:00.000Z"),
            draftRevision: {
              summary: "اكتمل مسار القبول.",
              result: "نجحت 12 حالة من أصل 12.",
              blocker: null,
              nextAction: "إرفاق سجل الاعتماد.",
              documentationNeeds: [],
              relatedProgressComponentIds: ["66666666-6666-4666-8666-666666666666"],
              comparison: {
                previousAcceptedEventId: null,
                changedFields: ["result"],
                explanation: "هذه أول نتيجة مؤكدة.",
              },
            },
          },
        })),
      },
      progressSnapshotSource: { findFirst: vi.fn(async () => null) },
    } as never);

    await expect(reader.updateResult({ actorId, acceptedEventId })).resolves.toMatchObject({
      acceptedEventId,
      project: { id: projectId, name: "Atlas Delivery" },
      workstream: { id: workstreamId, name: "API readiness" },
      workItem: null,
      progressImpact: {
        state: "awaiting_confirmation",
        componentIds: ["66666666-6666-4666-8666-666666666666"],
      },
    });
  });

  it("does not return another employee's confirmed result", async () => {
    const reader = new ActivityReader({
      acceptedUpdateEvent: { findFirst: vi.fn(async () => null) },
      progressSnapshotSource: { findFirst: vi.fn() },
    } as never);

    await expect(
      reader.updateResult({
        actorId,
        acceptedEventId: "44444444-4444-4444-8444-444444444444",
      }),
    ).rejects.toMatchObject({ code: "SCOPE_MISMATCH", status: 403 });
  });

  it("returns readable evidence scope, rule links, provenance, and verification state", async () => {
    const evidenceId = "77777777-7777-4777-8777-777777777777";
    const revisionId = "88888888-8888-4888-8888-888888888888";
    const componentId = "99999999-9999-4999-8999-999999999999";
    const criterionId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const reader = new ActivityReader({
      evidenceRecord: {
        findFirst: vi.fn(async () => ({
          id: evidenceId,
          employeeId: actorId,
          projectId,
          workstreamId,
          workItemId: null,
          githubSourceEventId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          state: "draft",
          project: { id: projectId, name: "Atlas Delivery" },
          workstream: { id: workstreamId, name: "API readiness" },
          workItem: null,
          revisions: [
            {
              id: revisionId,
              revision: 1,
              revisionKind: "ai_draft",
              sourceKind: "url",
              sourceText: null,
              sourceUrl: "https://github.com/acme/atlas/pull/42",
              mediaType: null,
              supportedClaim: "Required checks passed.",
              contributionContext: "Implemented and reviewed the acceptance path.",
              executionMode: "ai_assisted",
              links: [
                {
                  progressComponent: { id: componentId, name: "Acceptance completion" },
                  dynamicCriterion: null,
                },
                {
                  progressComponent: null,
                  dynamicCriterion: { id: criterionId, name: "Reliable delivery" },
                },
              ],
              verifications: [{ outcome: "unverified" }],
            },
          ],
        })),
      },
    } as never);

    await expect(reader.evidenceReview({ actorId, evidenceId })).resolves.toMatchObject({
      project: { id: projectId, name: "Atlas Delivery" },
      workstream: { id: workstreamId, name: "API readiness" },
      workItem: null,
      sourceProvenance: "github_automated",
      relatedKpiComponents: [{ id: componentId, name: "Acceptance completion" }],
      relatedCriteria: [{ id: criterionId, name: "Reliable delivery" }],
      verificationState: "unverified",
    });
  });

  it("groups only the employee's Evidence into pending, confirmed, attribution, gaps, and history", async () => {
    const findMany = vi.fn(async () => [
      evidenceRecord({
        id: "77777777-7777-4777-8777-777777777771",
        state: "draft",
        attributionState: "proposed",
        verificationState: "unverified",
      }),
      evidenceRecord({
        id: "77777777-7777-4777-8777-777777777772",
        state: "confirmed",
        attributionState: "acknowledged",
        verificationState: "supported",
      }),
      evidenceRecord({
        id: "77777777-7777-4777-8777-777777777773",
        state: "rejected",
        attributionState: null,
        verificationState: "rejected",
      }),
    ]);
    const reader = new ActivityReader({ evidenceRecord: { findMany } } as never);

    const result = await reader.evidenceWorkspace({ actorId, projectId, limit: 50 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { employeeId: actorId, projectId } }),
    );
    expect(result.pending).toHaveLength(1);
    expect(result.confirmed).toHaveLength(1);
    expect(result.attributionIssues).toHaveLength(1);
    expect(result.gaps).toHaveLength(1);
    expect(result.history.map(({ state }) => state)).toEqual(["draft", "confirmed", "rejected"]);
  });
});

function evidenceRecord(input: {
  id: string;
  state: "draft" | "confirmed" | "rejected";
  attributionState: "proposed" | "acknowledged" | "disputed" | null;
  verificationState: "unverified" | "supported" | "rejected";
}) {
  return {
    id: input.id,
    projectId,
    workstreamId: null,
    workItemId: null,
    state: input.state,
    version: 1,
    createdAt: new Date("2026-08-13T08:00:00.000Z"),
    updatedAt: new Date("2026-08-13T09:00:00.000Z"),
    project: { id: projectId, name: "Atlas Delivery" },
    workItem: null,
    revisions: [
      {
        revision: 1,
        revisionKind: "employee_edit",
        sourceKind: "url",
        supportedClaim: `Claim ${input.id.slice(-1)}`,
        contributionContext: "Employee contribution context",
        attributions: input.attributionState === null ? [] : [{ state: input.attributionState }],
        verifications: [{ outcome: input.verificationState }],
      },
    ],
  };
}

function timelineItem(id: string, kind: "update" | "evidence", occurredAt: string) {
  return {
    id,
    kind,
    projectId,
    workstreamId,
    workItemId: null,
    employeeId: actorId,
    occurredAt,
    title: kind === "update" ? "تحديث" : "دليل",
    detail: kind === "update" ? "نتيجة التحديث" : "سياق المساهمة",
    sourceReferences: [`${kind === "update" ? "update-source" : "evidence"}:${id}`],
    sourceProvenance: kind === "update" ? "employee_text" : "employee_file",
    reviewState: "employee_confirmed",
    project: { id: projectId, name: "Atlas Delivery" },
    workstream: { id: workstreamId, name: "API readiness" },
    workItem: null,
    relatedKpiComponents: [],
    relatedCriteria: [],
    verificationState: kind === "evidence" ? "unverified" : null,
    decisionOutcome: null,
  };
}
