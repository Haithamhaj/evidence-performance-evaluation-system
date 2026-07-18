import { getCatalogSync } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../../../platform/workspace-api.js", () => ({
  mutateCriteriaUpstream: vi.fn(),
  safeWorkspaceError: vi.fn(),
}));

import { CriteriaActions } from "./criteria-actions.js";
import { ProjectDetailView, ProjectListView, WorkstreamDetailView } from "./workspace-views.js";

const projectId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";
const workstreamId = "33333333-3333-4333-8333-333333333333";
const project = {
  id: projectId,
  departmentId: "44444444-4444-4444-8444-444444444444",
  name: "منصة تحليل API طويلة الاسم للاختبار",
  description: "وصف موجز للمشروع.",
  status: "active" as const,
  version: 2,
  primaryOwnerId: ownerId,
};

describe("localized project workspace views", () => {
  it("renders the Arabic project list, owner, status, and isolated technical ID", () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectListView, {
        catalog: getCatalogSync("ar"),
        locale: "ar",
        projects: [project],
        ownersById: { [ownerId]: "سارة أحمد" },
      }),
    );

    expect(markup).toContain("مشاريعي ومسارات العمل");
    expect(markup).toContain("سارة أحمد");
    expect(markup).toContain("نشط");
    expect(markup).toContain('data-bidi-kind="code"');
    expect(markup).toContain(projectId);
  });

  it("renders a clear empty state", () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectListView, {
        catalog: getCatalogSync("en"),
        locale: "en",
        projects: [],
        ownersById: {},
      }),
    );

    expect(markup).toContain("No projects are available in your authorized scope.");
  });

  it("renders semantic English project detail without scoring language or readiness values", () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectDetailView, {
        catalog: getCatalogSync("en"),
        locale: "en",
        screen: {
          workspace: {
            project,
            people: [
              {
                person: { id: ownerId, displayName: "Sara Ahmed" },
                responsibilityType: "original",
                startsAt: "2026-07-01T00:00:00.000Z",
                endsAt: null,
              },
            ],
            workstreams: [
              {
                id: workstreamId,
                projectId,
                name: "API foundation",
                description: "Shared API work.",
                status: "active",
                version: 1,
                primaryOwnerId: ownerId,
              },
            ],
          },
          document: null,
          readiness: { audience: "manager", state: "needs_attention" },
          criteria: {
            proposal: null,
            activeSet: null,
            replacementRequest: null,
            allowedActions: [],
          },
        },
      }),
    );

    expect(markup).toContain("<h1");
    expect(markup).toContain("<h2");
    expect(markup).toContain("Current people");
    expect(markup).toContain("Needs attention");
    expect(markup).not.toMatch(/readinessPercentage|productivity|employee rank|suggested rating/iu);
  });

  it("renders governed workstream history, sources, response progress, and retained objections", () => {
    const item = {
      id: "55555555-5555-4555-8555-555555555555",
      position: 1,
      name: "تسليم واجهة API موثقة",
      selectionReason: "مرتبط بنطاق مسار العمل.",
      successLink: "يوضح اكتمال التسليم.",
      expectedBehaviorOrResult: "تتوفر واجهة موثقة وقابلة للاستخدام.",
      evaluationMethod: "مراجعة المستند والمصادر المرتبطة.",
      suggestedEvidence: ["مرجع المستند"],
      sourceReferences: ["section:1"],
    };
    const screen = {
      workspace: {
        workstream: {
          id: workstreamId,
          projectId,
          name: "مسار واجهة API",
          description: "المسار المسؤول عن الواجهة المشتركة.",
          status: "active" as const,
          version: 2,
          primaryOwnerId: ownerId,
        },
        people: [],
      },
      document: {
        id: "66666666-6666-4666-8666-666666666666",
        kind: "workstream" as const,
        resourceId: workstreamId,
        templateVersionId: "77777777-7777-4777-8777-777777777777",
        currentVersion: 1,
        createdAt: "2026-07-01T00:00:00.000Z",
        versions: [
          {
            id: "88888888-8888-4888-8888-888888888888",
            documentId: "66666666-6666-4666-8666-666666666666",
            version: 1,
            templateVersionId: "77777777-7777-4777-8777-777777777777",
            createdById: ownerId,
            reason: "المصدر الأول",
            createdAt: "2026-07-02T00:00:00.000Z",
            sources: [
              {
                id: "99999999-9999-4999-8999-999999999999",
                position: 1,
                sourceType: "upload" as const,
                uploadedSource: {
                  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                  kind: "workstream" as const,
                  resourceId: workstreamId,
                  filename: "API-spec.pdf",
                  detectedMime: "application/pdf",
                  detectedType: "pdf",
                  byteSize: 2048,
                  sha256: "a".repeat(64),
                  createdAt: "2026-07-02T00:00:00.000Z",
                },
              },
            ],
          },
        ],
      },
      readiness: { audience: "manager" as const, state: "needs_attention" as const },
      criteria: {
        proposal: {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          kind: "workstream" as const,
          state: "manager_resolution" as const,
          version: 3,
          sourceDocumentVersionId: "88888888-8888-4888-8888-888888888888",
          items: [item, { ...item, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", position: 2 }],
          requiredResponses: 2,
          completedResponses: 1,
          objectionCount: 1,
          viewerResponse: null,
          managerResolution: {
            decision: "accept_with_objections" as const,
            reason: "حُفظ الاعتراض مع القرار.",
          },
        },
        activeSet: null,
        replacementRequest: null,
        allowedActions: ["manager_resolve" as const],
      },
    };

    const markup = renderToStaticMarkup(
      createElement(WorkstreamDetailView, {
        catalog: getCatalogSync("ar"),
        locale: "ar",
        projectId,
        screen,
        workstreamId,
      }),
    );

    expect(markup).toContain("١ / ٢");
    expect(markup).toContain("حُفظ الاعتراض مع القرار.");
    expect(markup).toContain("API-spec.pdf");
    expect(markup).toContain("a".repeat(64));
    expect(markup).not.toMatch(/rating|rank|productivity|percentage/iu);
  });

  it("renders only forms authorized by allowedActions", () => {
    const markup = renderToStaticMarkup(
      createElement(CriteriaActions, {
        allowedActions: ["respond"],
        catalog: getCatalogSync("en"),
        context: {
          locale: "en",
          kind: "workstream",
          resourceId: workstreamId,
          projectId,
          proposalId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          proposalVersion: 3,
          documentVersionId: "88888888-8888-4888-8888-888888888888",
          replacementRequest: null,
        },
      }),
    );

    expect(markup).toContain("Respond to proposal");
    expect(markup).toContain('value="acknowledge"');
    expect(markup).toContain('value="object"');
    expect(markup).not.toContain("Resolve objections");
    expect(markup).not.toContain("Activate criteria");
  });

  it("uses proposal lineage in generation idempotency keys", () => {
    const proposalId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const documentVersionId = "88888888-8888-4888-8888-888888888888";
    const markup = renderToStaticMarkup(
      createElement(CriteriaActions, {
        allowedActions: ["generate"],
        catalog: getCatalogSync("en"),
        context: {
          locale: "en",
          kind: "workstream",
          resourceId: workstreamId,
          projectId,
          proposalId,
          proposalVersion: 3,
          documentVersionId,
          replacementRequest: {
            replacesProposalId: proposalId,
            ownerFeedback: "Generate a corrected replacement.",
          },
        },
      }),
    );

    expect(markup).toContain(
      `value="criteria:workstream:${workstreamId}:${documentVersionId}:${proposalId}"`,
    );
  });
});
