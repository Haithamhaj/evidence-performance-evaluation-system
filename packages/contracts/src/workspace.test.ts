import { describe, expect, it } from "vitest";

import {
  CriteriaWorkspaceSchema,
  DailyWorkspaceSnapshotSchema,
  ProjectWorkspaceSchema,
  WorkstreamWorkspaceSchema,
} from "./workspace.js";

const projectId = "00000000-0000-4000-8000-000000000001";
const workstreamId = "00000000-0000-4000-8000-000000000002";
const departmentId = "00000000-0000-4000-8000-000000000003";
const personId = "00000000-0000-4000-8000-000000000004";
const proposalId = "00000000-0000-4000-8000-000000000005";
const documentVersionId = "00000000-0000-4000-8000-000000000006";
const itemId = "00000000-0000-4000-8000-000000000007";

const item = {
  id: itemId,
  position: 1,
  name: "Traceable outcome",
  selectionReason: "It reflects the approved source.",
  successLink: "Links to project success.",
  expectedBehaviorOrResult: "A source-supported result.",
  evaluationMethod: "Human review of the approved evidence.",
  suggestedEvidence: ["Approved source"],
  sourceReferences: ["document-version:00000000-0000-4000-8000-000000000008"],
};

const projectWorkspace = {
  project: {
    id: projectId,
    departmentId,
    name: "Project",
    description: "Description",
    status: "active",
    version: 1,
    primaryOwnerId: personId,
  },
  people: [
    {
      person: { id: personId, displayName: "Current Owner" },
      responsibilityType: "original",
      startsAt: "2026-07-18T08:00:00.000Z",
      endsAt: null,
    },
  ],
  workstreams: [
    {
      id: workstreamId,
      projectId,
      name: "Workstream",
      description: "Description",
      status: "active",
      version: 1,
      primaryOwnerId: personId,
    },
  ],
};

const criteriaWorkspace = {
  proposal: {
    id: proposalId,
    kind: "workstream",
    state: "contributor_review",
    version: 2,
    sourceDocumentVersionId: documentVersionId,
    items: [{ ...item }, { ...item, id: crypto.randomUUID(), position: 2 }],
    requiredResponses: 2,
    completedResponses: 1,
    objectionCount: 1,
    viewerResponse: null,
    managerResolution: null,
  },
  activeSet: null,
  replacementRequest: null,
  allowedActions: ["respond"],
};

describe("workspace contracts", () => {
  it("accepts strict project and workstream workspace views", () => {
    expect(ProjectWorkspaceSchema.parse(projectWorkspace)).toEqual(projectWorkspace);
    expect(
      WorkstreamWorkspaceSchema.parse({
        workstream: projectWorkspace.workstreams[0],
        people: projectWorkspace.people,
      }),
    ).toEqual({
      workstream: projectWorkspace.workstreams[0],
      people: projectWorkspace.people,
    });
  });

  it("accepts a unique sorted action list and rejects protected scoring fields", () => {
    expect(CriteriaWorkspaceSchema.parse(criteriaWorkspace).allowedActions).toEqual(["respond"]);
    expect(() =>
      CriteriaWorkspaceSchema.parse({ ...criteriaWorkspace, readinessPercentage: 93 }),
    ).toThrow();
    expect(() =>
      CriteriaWorkspaceSchema.parse({
        ...criteriaWorkspace,
        proposal: { ...criteriaWorkspace.proposal, suggestedRating: 5 },
      }),
    ).toThrow();
    expect(() =>
      CriteriaWorkspaceSchema.parse({
        ...criteriaWorkspace,
        allowedActions: ["respond", "generate"],
      }),
    ).toThrow();
    expect(() =>
      CriteriaWorkspaceSchema.parse({
        ...criteriaWorkspace,
        allowedActions: ["respond", "respond"],
      }),
    ).toThrow();
  });

  it("accepts only an exact immutable replacement request projection", () => {
    const replacement = {
      ...criteriaWorkspace,
      replacementRequest: {
        replacesProposalId: proposalId,
        ownerFeedback: "Request a corrected proposal.",
      },
      allowedActions: ["generate"],
    };
    expect(CriteriaWorkspaceSchema.parse(replacement).replacementRequest).toEqual(
      replacement.replacementRequest,
    );
    expect(() =>
      CriteriaWorkspaceSchema.parse({
        ...replacement,
        replacementRequest: {
          ...replacement.replacementRequest,
          transitionId: crypto.randomUUID(),
        },
      }),
    ).toThrow();
    expect(() =>
      CriteriaWorkspaceSchema.parse({
        ...replacement,
        replacementRequest: {
          replacesProposalId: proposalId,
          ownerFeedback: "Request a corrected proposal.",
          readinessPercentage: 90,
        },
      }),
    ).toThrow();
  });

  it("keeps Project pulse operational and rejects employee scoring fields", () => {
    const snapshot = {
      needsMyAction: [],
      today: [],
      overdue: [],
      reviewQueue: [],
      inbox: [],
      projectPulse: [
        {
          id: projectId,
          name: "Project",
          status: "active",
          progress: { state: "accepted", percent: 42, updatedAt: "2026-07-20T08:00:00.000Z" },
        },
      ],
      upcoming: [],
    };
    expect(DailyWorkspaceSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(() =>
      DailyWorkspaceSnapshotSchema.parse({
        ...snapshot,
        productivityScore: 90,
      }),
    ).toThrow();
  });
});
