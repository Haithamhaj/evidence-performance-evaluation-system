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
            relatedKpiComponents: [
              { id: crypto.randomUUID(), name: "Acceptance completion" },
            ],
            relatedCriteria: [{ id: crypto.randomUUID(), name: "Reliable delivery" }],
            verificationState: "unverified",
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
});
