import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { composeProjectContextSnapshot } from "./project-context.js";

const projectId = crypto.randomUUID();
const workstreamA = crypto.randomUUID();
const workstreamB = crypto.randomUUID();
const itemA = crypto.randomUUID();
const itemB = crypto.randomUUID();

function input(generatedAt: Date, objective = "Compare safe retrieval approaches") {
  const projectName = "Bounded Research";
  const projectVersion = 3;
  const projectContentIdentitySha256 = identity({
    kind: "project",
    id: projectId,
    version: projectVersion,
    name: projectName,
    description: objective,
  });
  const firstWorkstream = workstreamReference({
    id: workstreamB,
    projectId,
    name: "Source review",
    description: "Review cited sources.",
    version: 2,
  });
  const secondWorkstream = workstreamReference({
    id: workstreamA,
    projectId,
    name: "Retrieval security",
    description: "Validate bounded retrieval.",
    version: 4,
  });
  const firstItem = workItemReference({
    id: itemB,
    projectId,
    workstreamId: workstreamB,
    title: "Review citations",
    description: "Verify every claim.",
    status: "planned" as const,
    version: 2,
  });
  const secondItem = workItemReference({
    id: itemA,
    projectId,
    workstreamId: workstreamA,
    title: "Test SSRF controls",
    description: "Reject unsafe destinations.",
    status: "in_progress" as const,
    version: 4,
  });
  return {
    generatedAt,
    projectId,
    projectName,
    projectVersion,
    projectContentIdentitySha256,
    projectSourceReference: `project:${projectId}`,
    projectContentIdentityReference: `project-version:${projectContentIdentitySha256}`,
    sourceReferences: [
      `project:${projectId}`,
      `project-version:${projectContentIdentitySha256}`,
      firstItem.sourceReference,
      firstItem.contentIdentityReference,
      secondItem.sourceReference,
      secondItem.contentIdentityReference,
      firstWorkstream.sourceReference,
      firstWorkstream.contentIdentityReference,
      secondWorkstream.sourceReference,
      secondWorkstream.contentIdentityReference,
    ],
    objective,
    constraints: ["No private-network access", "No credential forwarding"],
    deliverables: ["Cited relevance review", "Bounded retrieval adapter"],
    operationalKpis: ["Blocked target coverage", "Citation trace completeness"],
    workstreams: [firstWorkstream, secondWorkstream],
    workItems: [firstItem, secondItem],
    decisions: ["Use allowlisted protocols", "Store only bounded extracted content"],
  };
}

describe("composeProjectContextSnapshot", () => {
  it("sorts every collection and emits the exact versioned snapshot shape", () => {
    const snapshot = composeProjectContextSnapshot(input(new Date("2026-08-05T09:00:00.000Z")));

    expect(snapshot).toEqual({
      schemaVersion: "research-project-context.v1",
      projectId,
      projectName: "Bounded Research",
      projectVersion: 3,
      projectContentIdentitySha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      projectSourceReference: `project:${projectId}`,
      projectContentIdentityReference: expect.stringMatching(/^project-version:[a-f0-9]{64}$/u),
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
    const previousItem = changedVersionInput.workItems[0]!;
    const changedItem = workItemReference({ ...previousItem, version: 3 });
    changedVersionInput.workItems[0] = changedItem;
    changedVersionInput.sourceReferences = changedVersionInput.sourceReferences
      .filter(
        (reference) =>
          reference !== previousItem.sourceReference &&
          reference !== previousItem.contentIdentityReference,
      )
      .concat(changedItem.sourceReference, changedItem.contentIdentityReference);
    const changedVersion = composeProjectContextSnapshot(changedVersionInput);

    expect(changedContent.fingerprintSha256).not.toBe(baseline.fingerprintSha256);
    expect(changedVersion.fingerprintSha256).not.toBe(baseline.fingerprintSha256);
  });

  it("changes the fingerprint when version-pinned Project or Workstream content changes", () => {
    const baseline = composeProjectContextSnapshot(input(new Date("2026-08-05T09:00:00.000Z")));
    const changedProject = input(
      new Date("2026-08-05T09:00:00.000Z"),
      "Compare a revised safe retrieval approach",
    );
    const changedWorkstream = input(new Date("2026-08-05T09:00:00.000Z"));
    const previousWorkstream = changedWorkstream.workstreams[0]!;
    const revisedWorkstream = workstreamReference({
      ...changedWorkstream.workstreams[0]!,
      name: "Source review v2",
      version: 3,
    });
    changedWorkstream.workstreams[0] = revisedWorkstream;
    changedWorkstream.sourceReferences = changedWorkstream.sourceReferences
      .filter(
        (reference) =>
          reference !== previousWorkstream.sourceReference &&
          reference !== previousWorkstream.contentIdentityReference,
      )
      .concat(revisedWorkstream.sourceReference, revisedWorkstream.contentIdentityReference);

    expect(composeProjectContextSnapshot(changedProject).fingerprintSha256).not.toBe(
      baseline.fingerprintSha256,
    );
    expect(composeProjectContextSnapshot(changedWorkstream).fingerprintSha256).not.toBe(
      baseline.fingerprintSha256,
    );
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

  it("rejects cross-Project, absent-Workstream, foreign Project, and mismatched identity inputs", () => {
    const crossProjectWorkstream = input(new Date("2026-08-05T09:00:00.000Z"));
    crossProjectWorkstream.workstreams[0] = workstreamReference({
      ...crossProjectWorkstream.workstreams[0]!,
      projectId: crypto.randomUUID(),
    });
    expect(() => composeProjectContextSnapshot(crossProjectWorkstream)).toThrow(
      expect.objectContaining({ code: "RESEARCH_PROJECT_CONTEXT_INVALID" }),
    );

    const absentWorkstream = input(new Date("2026-08-05T09:00:00.000Z"));
    absentWorkstream.workItems[0] = workItemReference({
      ...absentWorkstream.workItems[0]!,
      workstreamId: crypto.randomUUID(),
    });
    expect(() => composeProjectContextSnapshot(absentWorkstream)).toThrow(
      expect.objectContaining({ code: "RESEARCH_PROJECT_CONTEXT_INVALID" }),
    );

    const foreignProjectReference = input(new Date("2026-08-05T09:00:00.000Z"));
    foreignProjectReference.sourceReferences.push(`project:${crypto.randomUUID()}`);
    expect(() => composeProjectContextSnapshot(foreignProjectReference)).toThrow(
      expect.objectContaining({ code: "RESEARCH_PROJECT_CONTEXT_INVALID" }),
    );

    const mismatchedIdentity = input(new Date("2026-08-05T09:00:00.000Z"));
    mismatchedIdentity.workstreams[0] = {
      ...mismatchedIdentity.workstreams[0]!,
      contentIdentitySha256: "f".repeat(64),
      contentIdentityReference: `workstream-version:${"f".repeat(64)}`,
    };
    expect(() => composeProjectContextSnapshot(mismatchedIdentity)).toThrow(
      expect.objectContaining({ code: "RESEARCH_PROJECT_CONTEXT_INVALID" }),
    );
  });
});

function workstreamReference(input: {
  id: string;
  projectId: string;
  name: string;
  description: string;
  version: number;
}) {
  const contentIdentitySha256 = identity({
    kind: "workstream",
    id: input.id,
    projectId: input.projectId,
    version: input.version,
    name: input.name,
    description: input.description,
  });
  return {
    ...input,
    contentIdentitySha256,
    sourceReference: `workstream:${input.id}`,
    contentIdentityReference: `workstream-version:${contentIdentitySha256}`,
  };
}

function workItemReference(input: {
  id: string;
  projectId: string;
  workstreamId: string | null;
  title: string;
  description: string;
  status: "planned" | "in_progress";
  version: number;
}) {
  const contentIdentitySha256 = identity({
    kind: "work-item",
    id: input.id,
    projectId: input.projectId,
    workstreamId: input.workstreamId,
    title: input.title,
    description: input.description,
    status: input.status,
    version: input.version,
  });
  return {
    ...input,
    contentIdentitySha256,
    sourceReference: `work-item:${input.id}`,
    contentIdentityReference: `work-item-version:${contentIdentitySha256}`,
  };
}

function identity(value: object): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}
