import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CheckInCard } from "./check-in-card.js";

describe("CheckInCard", () => {
  it("shows a short action only for required Thursday obligations", () => {
    const onStart = vi.fn();
    const tree = createElement(CheckInCard, {
      catalog: {
        "checkIn.title": "Thursday check-in",
        "checkIn.subtitle": "Only needed because no substantive update was confirmed this week.",
        "checkIn.status": "Current state",
        "checkIn.status.noChange": "Work continues with no material change.",
        "checkIn.status.paused": "Temporarily paused.",
        "checkIn.status.priorityMoved": "Priority moved.",
        "checkIn.status.waiting": "Waiting for a dependency.",
        "checkIn.status.inProgress": "Work is in progress.",
        "checkIn.status.completedNotClosed": "Completed but not closed.",
        "checkIn.status.noLongerActive": "No longer active.",
        "checkIn.start": "Add quick update",
      } as never,
      obligations: [
        {
          projectId: crypto.randomUUID(),
          projectName: "Customer workspace",
          workstreamId: crypto.randomUUID(),
          workstreamName: "Daily operations",
          weekStartsAt: "2026-08-01T21:00:00.000Z",
          weekEndsAt: "2026-08-08T21:00:00.000Z",
          state: "required",
          capture: {
            projectId: crypto.randomUUID(),
            workstreamId: crypto.randomUUID(),
            workItemId: null,
          },
        },
        {
          projectId: crypto.randomUUID(),
          projectName: "Other",
          workstreamId: crypto.randomUUID(),
          workstreamName: "Satisfied",
          weekStartsAt: "2026-08-01T21:00:00.000Z",
          weekEndsAt: "2026-08-08T21:00:00.000Z",
          state: "satisfied_by_update",
          capture: null,
        },
      ],
      onStart,
    });
    const serialized = renderToStaticMarkup(tree);
    expect(serialized).toContain("Daily operations");
    expect(serialized).not.toContain("Satisfied");
    expect(serialized).not.toMatch(/score|percentage|quota|penalty|rank/iu);
  });
});
