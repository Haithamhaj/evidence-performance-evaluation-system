import { getCatalog } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { UpdateComposerView } from "./update-composer.js";

const item = {
  id: crypto.randomUUID(),
  projectId: crypto.randomUUID(),
  workstreamId: crypto.randomUUID(),
  title: "إغلاق مسار القبول",
  description: "تأكيد النتيجة وإرفاق الدليل.",
  status: "in_progress" as const,
  priority: "high" as const,
  assigneeId: crypto.randomUUID(),
  dueAt: null,
  requirements: [],
  acceptanceConditions: [],
  blocker: null,
  nextAction: "إرفاق نتيجة الاختبار",
  version: 1,
  createdAt: "2026-07-18T08:00:00.000Z",
  updatedAt: "2026-07-18T09:00:00.000Z",
  allowedActions: ["add_update" as const],
};

describe("UpdateComposerView", () => {
  it("shows one clarification question with human-readable project context", async () => {
    const catalog = await getCatalog("ar");
    const markup = renderToStaticMarkup(
      createElement(UpdateComposerView, {
        catalog,
        items: [item],
        projectNames: { [item.projectId]: "منصة التقييم التجريبية" },
        stage: {
          kind: "question",
          itemId: item.id,
          question: "ما النتيجة القابلة للتحقق؟",
          remainingFieldCount: 3,
        },
      }),
    );
    expect(markup).toContain("ما النتيجة القابلة للتحقق؟");
    expect(markup).toContain("منصة التقييم التجريبية");
    expect(markup).toContain("إغلاق مسار القبول");
    expect(markup).not.toContain(item.projectId);
    expect(markup).not.toContain("rating");
    expect(markup).not.toContain("productivity");
  });

  it("keeps evidence and employee confirmation inside the review flow", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(UpdateComposerView, {
        catalog,
        items: [item],
        projectNames: { [item.projectId]: "Pilot evaluation platform" },
        stage: {
          kind: "review",
          itemId: item.id,
          saved: true,
          evidenceCount: 1,
          draft: {
            summary: "Acceptance path completed",
            result: "All 12 agreed scenarios passed",
            blocker: null,
            nextAction: "Confirm with the product owner",
            contributionContext: "Implemented and verified the scenarios",
            comparison: {
              explanation: "The result is now measurable.",
              changedFields: ["result"],
            },
          },
        },
      }),
    );
    expect(markup).toContain("Add evidence");
    expect(markup).toContain("Confirm update");
    expect(markup).toContain("The result is now measurable.");
    expect(markup).toContain("1");
  });
});
