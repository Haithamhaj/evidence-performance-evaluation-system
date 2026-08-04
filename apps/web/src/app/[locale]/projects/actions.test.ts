import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mutateCriteriaUpstream: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("../../../platform/workspace-api.js", () => ({
  mutateCriteriaUpstream: mocks.mutateCriteriaUpstream,
  safeWorkspaceError: () => ({
    status: 500,
    messageKey: "errors.internal",
    correlationId: "11111111-1111-4111-8111-111111111111",
  }),
}));

import {
  activateCriteriaAction,
  generateCriteriaAction,
  ownerReviewCriteriaAction,
  publishCriteriaAction,
  resolveCriteriaAction,
  respondToCriteriaAction,
} from "./actions.js";

const projectId = "11111111-1111-4111-8111-111111111111";
const workstreamId = "22222222-2222-4222-8222-222222222222";
const documentVersionId = "33333333-3333-4333-8333-333333333333";
const proposalId = "44444444-4444-4444-8444-444444444444";
const idle = { status: "idle" as const };

beforeEach(() => {
  mocks.mutateCriteriaUpstream.mockReset().mockResolvedValue(undefined);
  mocks.revalidatePath.mockReset();
});

describe("criteria Server Action input boundary", () => {
  it.each([
    [
      "generate",
      generateCriteriaAction,
      {
        locale: "ar",
        kind: "project",
        resourceId: projectId,
        projectId,
        documentVersionId,
        idempotencyKey: "criteria-request-1",
      },
      {
        route: { kind: "generate" },
        body: {
          kind: "project",
          resourceId: projectId,
          documentVersionId,
          idempotencyKey: "criteria-request-1",
        },
      },
    ],
    [
      "owner review",
      ownerReviewCriteriaAction,
      {
        locale: "ar",
        kind: "workstream",
        resourceId: workstreamId,
        projectId,
        proposalId,
        action: "request_correction",
        reason: "يلزم توضيح النتيجة المتوقعة.",
        feedback: "اربط الصياغة بالمصدر.",
      },
      {
        route: { kind: "owner_review", proposalId },
        body: {
          action: "request_correction",
          reason: "يلزم توضيح النتيجة المتوقعة.",
          feedback: "اربط الصياغة بالمصدر.",
        },
      },
    ],
    [
      "publish",
      publishCriteriaAction,
      {
        locale: "ar",
        kind: "workstream",
        resourceId: workstreamId,
        projectId,
        proposalId,
        reason: "اكتملت مراجعة المالك.",
      },
      {
        route: { kind: "publish", proposalId },
        body: { reason: "اكتملت مراجعة المالك." },
      },
    ],
    [
      "respond",
      respondToCriteriaAction,
      {
        locale: "ar",
        kind: "workstream",
        resourceId: workstreamId,
        projectId,
        proposalId,
        action: "object",
        reason: "المعيار لا يطابق فترة مسؤوليتي.",
      },
      {
        route: { kind: "respond", proposalId },
        body: { action: "object", reason: "المعيار لا يطابق فترة مسؤوليتي." },
      },
    ],
    [
      "resolve",
      resolveCriteriaAction,
      {
        locale: "ar",
        kind: "workstream",
        resourceId: workstreamId,
        projectId,
        proposalId,
        decision: "accept_with_objections",
        reason: "اعتمدت المعايير مع الاحتفاظ بالاعتراض.",
      },
      {
        route: { kind: "manager_resolve", proposalId },
        body: {
          decision: "accept_with_objections",
          reason: "اعتمدت المعايير مع الاحتفاظ بالاعتراض.",
        },
      },
    ],
    [
      "activate",
      activateCriteriaAction,
      {
        locale: "ar",
        kind: "workstream",
        resourceId: workstreamId,
        projectId,
        proposalId,
        expectedProposalVersion: "3",
        effectiveFrom: "2026-08-01T00:00:00.000+03:00",
        reason: "تفعيل مستقبلي بعد اكتمال الاعتماد.",
      },
      {
        route: { kind: "activate", proposalId },
        body: {
          expectedProposalVersion: 3,
          effectiveFrom: "2026-08-01T00:00:00.000+03:00",
          reason: "تفعيل مستقبلي بعد اكتمال الاعتماد.",
        },
      },
    ],
  ] as const)("accepts the exact %s shape", async (_name, action, fields, expected) => {
    const result = await action(idle, form(fields));

    expect(result).toEqual({ status: "success", messageKey: "workspace.actionSuccess" });
    expect(mocks.mutateCriteriaUpstream).toHaveBeenCalledWith(expected);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      fields.kind === "project"
        ? `/ar/projects/${projectId}`
        : `/ar/projects/${projectId}/workstreams/${workstreamId}`,
    );
  });

  it.each([
    [
      "actor injection",
      generateCriteriaAction,
      {
        locale: "ar",
        kind: "project",
        resourceId: projectId,
        projectId,
        documentVersionId,
        idempotencyKey: "criteria-request-1",
        actorId: projectId,
      },
    ],
    [
      "arbitrary route",
      generateCriteriaAction,
      {
        locale: "ar",
        kind: "project",
        resourceId: projectId,
        projectId,
        documentVersionId,
        idempotencyKey: "criteria-request-1",
        path: "/api/v1/admin",
      },
    ],
    [
      "criterion edit",
      ownerReviewCriteriaAction,
      {
        locale: "ar",
        kind: "workstream",
        resourceId: workstreamId,
        projectId,
        proposalId,
        action: "request_correction",
        reason: "Needs correction.",
        criterionName: "Injected criterion",
      },
    ],
    ...(["suggestedRating", "employeeRank", "productivityScore"] as const).map(
      (field) =>
        [
          `${field} field`,
          respondToCriteriaAction,
          {
            locale: "ar",
            kind: "workstream",
            resourceId: workstreamId,
            projectId,
            proposalId,
            action: "acknowledge",
            [field]: "5",
          },
        ] as const,
    ),
  ] as readonly (readonly [
    string,
    typeof generateCriteriaAction,
    Readonly<Record<string, string>>,
  ])[])("rejects %s before upstream access", async (_name, action, fields) => {
    const result = await action(idle, form(fields));

    expect(result).toEqual({ status: "error", messageKey: "errors.validation" });
    expect(mocks.mutateCriteriaUpstream).not.toHaveBeenCalled();
  });

  it.each([
    [
      "objection reason",
      respondToCriteriaAction,
      { action: "object", proposalId, kind: "workstream", resourceId: workstreamId },
    ],
    [
      "review reason",
      ownerReviewCriteriaAction,
      { action: "reject", proposalId, kind: "workstream", resourceId: workstreamId },
    ],
    [
      "resolution reason",
      resolveCriteriaAction,
      {
        decision: "request_revision",
        proposalId,
        kind: "workstream",
        resourceId: workstreamId,
      },
    ],
  ])("requires %s", async (_name, action, fields) => {
    const result = await action(idle, form({ locale: "ar", projectId, ...fields }));

    expect(result).toEqual({ status: "error", messageKey: "errors.validation" });
    expect(mocks.mutateCriteriaUpstream).not.toHaveBeenCalled();
  });

  it("rejects invalid activation values and mismatched project identity", async () => {
    const invalidActivation = await activateCriteriaAction(
      idle,
      form({
        locale: "ar",
        kind: "project",
        resourceId: projectId,
        projectId: workstreamId,
        proposalId,
        expectedProposalVersion: "0",
        effectiveFrom: "tomorrow",
        reason: "Invalid.",
      }),
    );

    expect(invalidActivation).toEqual({
      status: "error",
      messageKey: "errors.validation",
    });
    expect(mocks.mutateCriteriaUpstream).not.toHaveBeenCalled();
  });

  it("omits an empty optional owner feedback field", async () => {
    const result = await ownerReviewCriteriaAction(
      idle,
      form({
        locale: "en",
        kind: "workstream",
        resourceId: workstreamId,
        projectId,
        proposalId,
        action: "reject",
        reason: "The proposal does not match the source.",
        feedback: "",
      }),
    );

    expect(result).toEqual({
      status: "success",
      messageKey: "workspace.actionSuccess",
    });
    expect(mocks.mutateCriteriaUpstream).toHaveBeenCalledWith({
      route: { kind: "owner_review", proposalId },
      body: {
        action: "reject",
        reason: "The proposal does not match the source.",
      },
    });
  });
});

function form(fields: Readonly<Record<string, string>>): FormData {
  const value = new FormData();
  for (const [key, entry] of Object.entries(fields)) value.set(key, entry);
  return value;
}
