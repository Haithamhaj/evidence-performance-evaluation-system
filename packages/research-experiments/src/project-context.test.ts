import { describe, expect, it } from "vitest";

import { composeProjectContextSnapshot } from "./project-context.js";

const projectId = crypto.randomUUID();
const workstreamA = crypto.randomUUID();
const workstreamB = crypto.randomUUID();
const itemA = crypto.randomUUID();
const itemB = crypto.randomUUID();

function input(generatedAt: Date, objective = "Compare safe retrieval approaches") {
  return {
    generatedAt,
    projectId,
    sourceReferences: [
      `work-item:${itemB}`,
      `project:${projectId}`,
      `work-item:${itemA}`,
      `workstream:${workstreamA}`,
      `workstream:${workstreamB}`,
    ],
    objective,
    constraints: ["No private-network access", "No credential forwarding"],
    deliverables: ["Cited relevance review", "Bounded retrieval adapter"],
    operationalKpis: ["Blocked target coverage", "Citation trace completeness"],
    workstreams: [
      {
        id: workstreamB,
        name: "Source review",
        sourceReference: `workstream:${workstreamB}`,
      },
      {
        id: workstreamA,
        name: "Retrieval security",
        sourceReference: `workstream:${workstreamA}`,
      },
    ],
    workItems: [
      {
        id: itemB,
        projectId,
        workstreamId: workstreamB,
        title: "Review citations",
        description: "Verify every claim.",
        status: "planned" as const,
        version: 2,
        sourceReference: `work-item:${itemB}`,
      },
      {
        id: itemA,
        projectId,
        workstreamId: workstreamA,
        title: "Test SSRF controls",
        description: "Reject unsafe destinations.",
        status: "in_progress" as const,
        version: 4,
        sourceReference: `work-item:${itemA}`,
      },
    ],
    decisions: ["Use allowlisted protocols", "Store only bounded extracted content"],
  };
}

describe("composeProjectContextSnapshot", () => {
  it("sorts every collection and emits the exact versioned snapshot shape", () => {
    const snapshot = composeProjectContextSnapshot(input(new Date("2026-08-05T09:00:00.000Z")));

    expect(snapshot).toEqual({
      schemaVersion: "research-project-context.v1",
      projectId,
      generatedAt: "2026-08-05T09:00:00.000Z",
      fingerprintSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      sourceReferences: [...input(new Date()).sourceReferences].sort(),
      objective: "Compare safe retrieval approaches",
      constraints: ["No credential forwarding", "No private-network access"],
      deliverables: ["Bounded retrieval adapter", "Cited relevance review"],
      operationalKpis: ["Blocked target coverage", "Citation trace completeness"],
      workstreams: [...input(new Date()).workstreams].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
      workItems: [...input(new Date()).workItems].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
      decisions: ["Store only bounded extracted content", "Use allowlisted protocols"],
    });
  });

  it("excludes generatedAt and input ordering from the fingerprint", () => {
    const first = composeProjectContextSnapshot(input(new Date("2026-08-05T09:00:00.000Z")));
    const reordered = input(new Date("2026-08-06T10:00:00.000Z"));
    reordered.sourceReferences.reverse();
    reordered.constraints.reverse();
    reordered.deliverables.reverse();
    reordered.operationalKpis.reverse();
    reordered.workstreams.reverse();
    reordered.workItems.reverse();
    reordered.decisions.reverse();
    const second = composeProjectContextSnapshot(reordered);

    expect(second.fingerprintSha256).toBe(first.fingerprintSha256);
    expect(second.generatedAt).not.toBe(first.generatedAt);
  });

  it("changes the fingerprint when cited content or its pinned version changes", () => {
    const baseline = composeProjectContextSnapshot(input(new Date("2026-08-05T09:00:00.000Z")));
    const changedContent = composeProjectContextSnapshot(
      input(new Date("2026-08-05T09:00:00.000Z"), "Compare a different retrieval approach"),
    );
    const changedVersionInput = input(new Date("2026-08-05T09:00:00.000Z"));
    changedVersionInput.workItems[0] = { ...changedVersionInput.workItems[0]!, version: 3 };
    const changedVersion = composeProjectContextSnapshot(changedVersionInput);

    expect(changedContent.fingerprintSha256).not.toBe(baseline.fingerprintSha256);
    expect(changedVersion.fingerprintSha256).not.toBe(baseline.fingerprintSha256);
  });

  it("rejects an invalid clock and cross-Project Work Item instead of hashing ambiguous context", () => {
    expect(() => composeProjectContextSnapshot(input(new Date("invalid")))).toThrow(
      expect.objectContaining({ code: "RESEARCH_PROJECT_CONTEXT_INVALID" }),
    );
    const crossProject = input(new Date("2026-08-05T09:00:00.000Z"));
    crossProject.workItems[0] = {
      ...crossProject.workItems[0]!,
      projectId: crypto.randomUUID(),
    };
    expect(() => composeProjectContextSnapshot(crossProject)).toThrow(
      expect.objectContaining({ code: "RESEARCH_PROJECT_CONTEXT_INVALID" }),
    );
  });

  it("rejects duplicate Workstream and Work Item identities instead of hashing caller order", () => {
    const duplicateWorkstream = input(new Date("2026-08-05T09:00:00.000Z"));
    duplicateWorkstream.workstreams.push({
      ...duplicateWorkstream.workstreams[0]!,
      sourceReference: `workstream:${crypto.randomUUID()}`,
    });
    expect(() => composeProjectContextSnapshot(duplicateWorkstream)).toThrow(
      expect.objectContaining({ code: "RESEARCH_PROJECT_CONTEXT_INVALID" }),
    );

    const duplicateItem = input(new Date("2026-08-05T09:00:00.000Z"));
    duplicateItem.workItems.push({
      ...duplicateItem.workItems[0]!,
      description: "Conflicting duplicate content",
    });
    expect(() => composeProjectContextSnapshot(duplicateItem)).toThrow(
      expect.objectContaining({ code: "RESEARCH_PROJECT_CONTEXT_INVALID" }),
    );
  });
});
