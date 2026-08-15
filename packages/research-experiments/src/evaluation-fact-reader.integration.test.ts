import { describe, expect, it, vi } from "vitest";

import { ResearchEvaluationFactReader } from "./evaluation-fact-reader.js";

describe("ResearchEvaluationFactReader", () => {
  it("resolves a workstream responsibility window to its owning project", async () => {
    const projectId = crypto.randomUUID();
    const workstreamId = crypto.randomUUID();
    const employeeId = crypto.randomUUID();
    const reader = new ResearchEvaluationFactReader({
      researchRecord: { findMany: vi.fn(async () => []) },
      responsibilityWindow: {
        findMany: vi.fn(async () => [
          {
            id: crypto.randomUUID(),
            projectId: null,
            workstreamId,
            workstream: { projectId },
            responsibilityType: "contributor",
            startsAt: new Date("2026-07-01T00:00:00Z"),
            endsAt: null,
          },
        ]),
      },
    } as never);

    const bundle = await reader.readAuthorizedFacts({
      cycleId: crypto.randomUUID(),
      subjectEmployeeId: employeeId,
      cycleStart: "2026-08-01T00:00:00.000Z",
      cycleEnd: "2026-08-31T23:59:59.999Z",
      requester: {
        actorId: employeeId,
        subjectEmployeeId: employeeId,
        access: "self",
        active: true,
      },
    });

    expect(bundle.responsibilityWindows[0]).toMatchObject({ projectId, workstreamId });
  });

  it("separates source-supported experiment conclusions from employee interpretation", async () => {
    const projectId = crypto.randomUUID();
    const employeeId = crypto.randomUUID();
    const conclusionId = crypto.randomUUID();
    const reader = new ResearchEvaluationFactReader({
      researchRecord: {
        findMany: vi.fn(async () => [
          {
            id: crypto.randomUUID(),
            projectId,
            workstreamId: null,
            workItemId: null,
            ownerId: employeeId,
            revisions: [],
            sourceReferences: [],
            experiments: [
              {
                id: crypto.randomUUID(),
                workstreamId: null,
                workItemId: null,
                methodRevisions: [],
                runs: [],
                conclusions: [
                  {
                    id: conclusionId,
                    summary: "Latency improved under the tested conditions.",
                    limitations: ["Small sample"],
                    confidenceDescription: "Moderate",
                    confirmerId: employeeId,
                    confirmedAt: new Date("2026-08-03T10:00:00Z"),
                  },
                ],
              },
            ],
            researchConclusions: [],
            appliedLearning: [],
            participantEvents: [],
          },
        ]),
      },
      responsibilityWindow: {
        findMany: vi.fn(async () => [
          {
            id: crypto.randomUUID(),
            projectId,
            workstreamId: null,
            startsAt: new Date("2026-07-01T00:00:00Z"),
            endsAt: null,
          },
        ]),
      },
    } as never);

    const bundle = await reader.readAuthorizedFacts({
      cycleId: crypto.randomUUID(),
      subjectEmployeeId: employeeId,
      cycleStart: "2026-08-01T00:00:00.000Z",
      cycleEnd: "2026-08-31T23:59:59.999Z",
      requester: {
        actorId: employeeId,
        subjectEmployeeId: employeeId,
        access: "self",
        active: true,
      },
    });

    expect(bundle.researchFacts).toEqual([
      expect.objectContaining({
        sourceId: conclusionId,
        factType: "experiment_conclusion",
        summary: "Latency improved under the tested conditions.",
      }),
    ]);
    expect(bundle.employeeInterpretations).toEqual([]);
    expect(Object.keys(bundle)).toEqual([
      "responsibilityWindows",
      "researchFacts",
      "employeeInterpretations",
    ]);
  });

  it("excludes an ACTIVE source whose predecessor has an append-only retraction marker", async () => {
    const projectId = crypto.randomUUID();
    const employeeId = crypto.randomUUID();
    const sourceId = crypto.randomUUID();
    const reader = new ResearchEvaluationFactReader({
      researchRecord: {
        findMany: vi.fn(async () => [
          {
            id: crypto.randomUUID(),
            projectId,
            workstreamId: null,
            workItemId: null,
            ownerId: employeeId,
            revisions: [],
            sourceReferences: [
              {
                id: sourceId,
                state: "ACTIVE",
                title: "Withdrawn source",
                relevanceNote: "Must not appear in facts.",
                credibilityNote: "Retracted",
                canonicalUrl: "https://example.invalid/withdrawn",
                citedLocations: ["section:1"],
                createdAt: new Date("2026-08-03T10:00:00Z"),
              },
              {
                id: crypto.randomUUID(),
                state: "RETRACTED",
                title: "Retraction marker",
                relevanceNote: "Withdrawn",
                credibilityNote: "Withdrawn",
                canonicalUrl: null,
                citedLocations: [
                  {
                    schemaVersion: "research-source-retraction.v1",
                    predecessorSourceReferenceId: sourceId,
                  },
                ],
                createdAt: new Date("2026-08-03T11:00:00Z"),
              },
            ],
            experiments: [],
            researchConclusions: [],
            appliedLearning: [],
            participantEvents: [],
          },
        ]),
      },
      responsibilityWindow: { findMany: vi.fn(async () => []) },
    } as never);

    const bundle = await reader.readAuthorizedFacts({
      cycleId: crypto.randomUUID(),
      subjectEmployeeId: employeeId,
      cycleStart: "2026-08-01T00:00:00.000Z",
      cycleEnd: "2026-08-31T23:59:59.999Z",
      requester: {
        actorId: employeeId,
        subjectEmployeeId: employeeId,
        access: "self",
        active: true,
      },
    });

    expect(bundle.researchFacts).toEqual([]);
  });

  it("attributes facts only inside the subject's Research responsibility interval after owner transfer", async () => {
    const projectId = crypto.randomUUID();
    const formerOwnerId = crypto.randomUUID();
    const currentOwnerId = crypto.randomUUID();
    const beforeTransferId = crypto.randomUUID();
    const afterTransferId = crypto.randomUUID();
    const root = {
      id: crypto.randomUUID(),
      projectId,
      workstreamId: null,
      workItemId: null,
      ownerId: currentOwnerId,
      revisions: [
        {
          id: beforeTransferId,
          revision: 1,
          question: "Fact before transfer",
          knownUncertainty: [],
          origin: "EMPLOYEE",
          createdAt: new Date("2026-08-10T10:00:00Z"),
        },
        {
          id: afterTransferId,
          revision: 2,
          question: "Fact after transfer",
          knownUncertainty: [],
          origin: "EMPLOYEE",
          createdAt: new Date("2026-08-20T10:00:00Z"),
        },
      ],
      sourceReferences: [],
      experiments: [],
      researchConclusions: [],
      appliedLearning: [],
      participantEvents: [
        {
          id: crypto.randomUUID(),
          employeeId: formerOwnerId,
          role: "OWNER",
          action: "STARTED",
          effectiveAt: new Date("2026-08-01T00:00:00Z"),
        },
        {
          id: crypto.randomUUID(),
          employeeId: formerOwnerId,
          role: "OWNER",
          action: "ENDED",
          effectiveAt: new Date("2026-08-15T00:00:00Z"),
        },
        {
          id: crypto.randomUUID(),
          employeeId: currentOwnerId,
          role: "OWNER",
          action: "STARTED",
          effectiveAt: new Date("2026-08-15T00:00:00Z"),
        },
      ],
    };
    const reader = new ResearchEvaluationFactReader({
      researchRecord: { findMany: vi.fn(async () => [root]) },
      responsibilityWindow: { findMany: vi.fn(async () => []) },
    } as never);
    const input = (subjectEmployeeId: string) => ({
      cycleId: crypto.randomUUID(),
      subjectEmployeeId,
      cycleStart: "2026-08-01T00:00:00.000Z",
      cycleEnd: "2026-08-31T23:59:59.999Z",
      requester: {
        actorId: subjectEmployeeId,
        subjectEmployeeId,
        access: "self" as const,
        active: true as const,
      },
    });

    const former = await reader.readAuthorizedFacts(input(formerOwnerId));
    const current = await reader.readAuthorizedFacts(input(currentOwnerId));

    expect(former.researchFacts.map(({ sourceId }) => sourceId)).toEqual([beforeTransferId]);
    expect(current.researchFacts.map(({ sourceId }) => sourceId)).toEqual([afterTransferId]);
  });
});
