import { getCatalog } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TimelineItems } from "./timeline-list.js";

describe("TimelineItems", () => {
  it("labels GitHub provenance separately from employee confirmation and shows readable links", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(TimelineItems, {
        catalog,
        locale: "en",
        items: [
          {
            id: crypto.randomUUID(),
            kind: "evidence",
            projectId: crypto.randomUUID(),
            workstreamId: crypto.randomUUID(),
            workItemId: crypto.randomUUID(),
            employeeId: crypto.randomUUID(),
            occurredAt: "2026-07-20T10:00:00.000Z",
            title: "Required checks passed.",
            detail: "Implemented and reviewed the acceptance path.",
            sourceReferences: [`evidence:${crypto.randomUUID()}`],
            sourceProvenance: "github_automated",
            reviewState: "employee_confirmed",
            project: { id: crypto.randomUUID(), name: "Atlas Delivery" },
            workstream: { id: crypto.randomUUID(), name: "API readiness" },
            workItem: { id: crypto.randomUUID(), title: "Verify acceptance flow" },
            relatedKpiComponents: [{ id: crypto.randomUUID(), name: "Acceptance completion" }],
            relatedCriteria: [{ id: crypto.randomUUID(), name: "Reliable delivery" }],
            verificationState: "unverified",
            decisionOutcome: null,
          },
        ],
      }),
    );

    expect(markup).toContain("Automated GitHub fact");
    expect(markup).toContain("Employee confirmed");
    expect(markup).toContain("Atlas Delivery");
    expect(markup).toContain("API readiness");
    expect(markup).toContain("Verify acceptance flow");
    expect(markup).toContain("Acceptance completion");
    expect(markup).toContain("Reliable delivery");
    expect(markup).toContain("Not yet verified");
    expect(markup).not.toContain("productivity");
    expect(markup).not.toContain("score");
  });

  it("renders confirmed Research lifecycle items without exposing private AI turns", async () => {
    const catalog = await getCatalog("en");
    const base = {
      projectId: crypto.randomUUID(),
      workstreamId: null,
      workItemId: null,
      employeeId: null,
      occurredAt: "2026-07-20T10:00:00.000Z",
      title: "Source lifecycle",
      detail: "Visible state",
      sourceReferences: [`source:${crypto.randomUUID()}`],
      project: { id: crypto.randomUUID(), name: "Atlas Delivery" },
      workstream: null,
      workItem: null,
      relatedKpiComponents: [],
      relatedCriteria: [],
      verificationState: null,
      decisionOutcome: null,
    };
    const markup = renderToStaticMarkup(
      createElement(TimelineItems, {
        catalog,
        locale: "en",
        items: [
          {
            ...base,
            id: crypto.randomUUID(),
            kind: "project_fact",
            sourceProvenance: "github_automated",
            reviewState: "automated_project_fact",
          },
          {
            ...base,
            id: crypto.randomUUID(),
            kind: "research",
            sourceProvenance: "human_decision",
            reviewState: "human_decision",
          },
          {
            ...base,
            id: crypto.randomUUID(),
            kind: "experiment",
            sourceProvenance: "human_decision",
            reviewState: "human_decision",
          },
          {
            ...base,
            id: crypto.randomUUID(),
            kind: "applied_learning",
            sourceProvenance: "human_decision",
            reviewState: "human_decision",
          },
          {
            ...base,
            id: crypto.randomUUID(),
            kind: "evidence",
            sourceProvenance: "employee_file",
            reviewState: "employee_confirmed",
          },
          {
            ...base,
            id: crypto.randomUUID(),
            kind: "decision",
            sourceProvenance: "human_decision",
            reviewState: "human_decision",
            decisionOutcome: "not_satisfied",
          },
        ],
      }),
    );

    expect(markup).toContain("Automated Project fact");
    expect(markup).toContain("Research");
    expect(markup).toContain("Experiment");
    expect(markup).toContain("Applied learning");
    expect(markup).toContain("Employee confirmed");
    expect(markup).toContain("Human decision");
    expect(markup).toContain("Not satisfied");
    expect(markup).not.toContain("AI draft");
  });

  it("offers a verified GitHub fact for employee evidence review", async () => {
    const catalog = await getCatalog("en");
    const sourceEventId = crypto.randomUUID();
    const markup = renderToStaticMarkup(
      createElement(TimelineItems, {
        catalog,
        locale: "en",
        onReviewGitHubSuggestion: () => undefined,
        items: [
          {
            id: crypto.randomUUID(),
            kind: "project_fact",
            projectId: crypto.randomUUID(),
            workstreamId: null,
            workItemId: null,
            employeeId: null,
            occurredAt: "2026-08-03T10:00:00.000Z",
            title: "Verified pull request",
            detail: "A verified GitHub event is available for review.",
            sourceReferences: [`github-source-event:${sourceEventId}`],
            sourceProvenance: "github_automated",
            reviewState: "automated_project_fact",
            project: { id: crypto.randomUUID(), name: "Atlas Delivery" },
            workstream: null,
            workItem: null,
            relatedKpiComponents: [],
            relatedCriteria: [],
            verificationState: null,
            decisionOutcome: null,
          },
        ],
      }),
    );

    expect(markup).toContain("Review as evidence");
    expect(markup).toContain("Verified pull request");
  });
});
