import { getCatalog } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ManagerOperationsClient } from "./manager-operations-client.js";

const projectId = crypto.randomUUID();

describe("ManagerOperationsClient", () => {
  it("renders actionable queues and keeps readiness separate from evaluation", async () => {
    const item = {
      id: crypto.randomUUID(),
      projectId,
      projectName: "Customer workspace",
      detailKey: "approval_waiting" as const,
    };
    const markup = renderToStaticMarkup(
      createElement(ManagerOperationsClient, {
        catalog: await getCatalog("en"),
        locale: "en",
        view: {
          approvalsWaiting: [item],
          blockedProjects: [{ ...item, detailKey: "project_paused" }],
          ambiguousProgressEvidence: [{ ...item, detailKey: "progress_source_ambiguous" }],
          ownershipGaps: [{ ...item, detailKey: "ownership_missing" }],
          upcomingCommitments: [
            {
              ...item,
              label: "Confirm rollout",
              detailKey: "commitment_upcoming",
              dueAt: "2026-08-10T09:00:00.000Z",
            },
          ],
          readinessHref: "/manager/readiness",
          evaluationHref: "/manager/evaluations",
        },
      }),
    );

    expect(markup).toContain("Waiting for approval");
    expect(markup).toContain("Blocked projects");
    expect(markup).toContain("Ownership gaps");
    expect(markup).toContain('href="/en/manager/readiness"');
    expect(markup).toContain('href="/en/manager/evaluations"');
    expect(markup).not.toMatch(
      /quick add|quick update|readiness percentage|productivity score|predicted rating|ranking|leaderboard/iu,
    );
  });
});
