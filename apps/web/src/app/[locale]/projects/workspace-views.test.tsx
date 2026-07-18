import { getCatalogSync } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProjectDetailView, ProjectListView } from "./workspace-views.js";

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
});
