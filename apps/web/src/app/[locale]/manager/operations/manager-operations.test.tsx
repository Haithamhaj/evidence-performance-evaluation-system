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
        coachingView: {
          generatedAt: "2026-08-15T09:00:00.000Z",
          boundary: "shared_and_formal_only",
          sharedActions: [
            {
              id: crypto.randomUUID(),
              employeeId: crypto.randomUUID(),
              employeeName: "Codex",
              state: "ACTIVE",
              title: "Improve handover",
              objective: "Prepare a clear shared handover",
              targetDate: null,
              updatedAt: "2026-08-15T08:00:00.000Z",
            },
          ],
          formalPlans: [],
        },
        locale: "en",
        view: {
          generatedAt: "2026-08-15T09:00:00.000Z",
          approvalsWaiting: [{ ...item, observedAt: "2026-08-15T08:55:00.000Z" }],
          blockedProjects: [
            { ...item, detailKey: "project_paused", observedAt: "2026-08-15T08:50:00.000Z" },
          ],
          ambiguousProgressEvidence: [
            {
              ...item,
              detailKey: "progress_source_ambiguous",
              observedAt: "2026-08-15T08:45:00.000Z",
            },
          ],
          ownershipGaps: [
            { ...item, detailKey: "ownership_missing", observedAt: "2026-08-15T08:40:00.000Z" },
          ],
          upcomingCommitments: [
            {
              ...item,
              label: "Confirm rollout",
              detailKey: "commitment_upcoming",
              dueAt: "2026-08-10T09:00:00.000Z",
              observedAt: "2026-08-15T08:35:00.000Z",
            },
          ],
          readinessHref: "/manager/readiness",
          evaluationHref: "/manager/evaluations",
          continuityHref: "/continuity",
        },
      }),
    );

    expect(markup).toContain("Waiting for approval");
    expect(markup).toContain("Blocked projects");
    expect(markup).toContain("Ownership gaps");
    expect(markup).toContain("Manager command brief");
    expect(markup).toContain("5 open actions");
    expect(markup).toContain("Portfolio attention");
    expect(markup).toContain("Why it matters");
    expect(markup).toContain("Progress Contract");
    expect(markup).toContain("Review measurable rules");
    expect(markup).toContain("Shared development support");
    expect(markup).toContain("Improve handover");
    expect(markup).not.toContain("employeeSelectedContext");
    expect(markup).toContain('href="/en/manager/readiness"');
    expect(markup).toContain('href="/en/manager/evaluations"');
    expect(markup).not.toMatch(
      /quick add|quick update|readiness percentage|productivity score|predicted rating|ranking|leaderboard/iu,
    );
  });
});
