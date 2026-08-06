import { describe, expect, it } from "vitest";

const cycle = {
  id: crypto.randomUUID(),
  startsAt: "2026-07-01T00:00:00.000Z",
  endsAt: "2026-09-30T23:59:59.999Z",
  rubricVersionId: crypto.randomUUID(),
} as const;

function projectFact(sourceId: string, occurredAt = "2026-07-23T09:00:00.000Z") {
  const projectId = crypto.randomUUID();
  return {
    kind: "source_fact",
    sourceType: "project_contribution",
    sourceId,
    sourceOccurredAt: occurredAt,
    projectId,
    workstreamId: null,
    relatedWorkItemId: null,
    criterionStableId: null,
    criterionVersionId: null,
    summary: "A source-supported project result.",
    result: "The approved acceptance condition passed.",
    verificationState: "source_supported",
    attributionState: "employee_confirmed",
    responsibilityWindowIds: [],
    sourceReferences: [
      {
        sourceType: "timeline_event",
        sourceId,
        sourceVersion: 1,
        occurredAt,
        url: null,
      },
    ],
  } as const;
}

function criterionFact(effectiveFrom: string) {
  const sourceId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  return {
    kind: "source_fact",
    sourceType: "criterion_version",
    sourceId,
    sourceOccurredAt: effectiveFrom,
    projectId,
    workstreamId: null,
    criterionStableId: `project:${sourceId}`,
    criterionVersionId: sourceId,
    locale: "en",
    name: "Approved project outcome",
    effectiveFrom,
    effectiveUntil: null,
    sourceReferences: [
      {
        sourceType: "criterion_version",
        sourceId,
        sourceVersion: 1,
        occurredAt: effectiveFrom,
        url: null,
      },
    ],
  } as const;
}

describe("evaluation fact normalizer", () => {
  it("retains Research facts as source facts and links active responsibility windows", async () => {
    const projectId = crypto.randomUUID();
    const windowId = crypto.randomUUID();
    const factId = crypto.randomUUID();
    const normalize = (await import("./index.js")).normalizeEvaluationFactSources;
    const result = normalize(cycle, [
      {
        responsibilityWindows: [
          {
            kind: "source_fact",
            sourceType: "responsibility_window",
            sourceId: windowId,
            sourceOccurredAt: "2026-07-01T00:00:00.000Z",
            projectId,
            workstreamId: null,
            responsibilityType: "contributor",
            startedAt: "2026-07-01T00:00:00.000Z",
            endedAt: null,
            sourceReferences: [
              {
                sourceType: "responsibility_window",
                sourceId: windowId,
                sourceVersion: null,
                occurredAt: "2026-07-01T00:00:00.000Z",
                url: null,
              },
            ],
          },
        ],
        researchFacts: [
          {
            kind: "source_fact",
            sourceType: "research",
            factType: "experiment_conclusion",
            sourceId: factId,
            sourceOccurredAt: "2026-08-15T10:00:00.000Z",
            projectId,
            workstreamId: null,
            relatedWorkItemId: null,
            humanConfirmationState: "human_decision",
            verificationState: "source_supported",
            responsibilityWindowIds: [],
            summary: "A confirmed experiment conclusion.",
            limitations: [],
            uncertainty: null,
            sourceReferences: [
              {
                sourceType: "experiment_conclusion",
                sourceId: factId,
                sourceVersion: null,
                occurredAt: "2026-08-15T10:00:00.000Z",
                url: null,
              },
            ],
          },
        ],
      },
    ]);
    expect(result.researchFacts[0]?.responsibilityWindowIds).toEqual([windowId]);
    expect(Object.keys(result)).toContain("researchFacts");
  });

  it("deduplicates the same immutable source and excludes prospective criterion versions", async () => {
    const sourceId = crypto.randomUUID();
    const duplicate = projectFact(sourceId);
    const activeCriterion = criterionFact("2026-07-01T00:00:00.000Z");
    const prospectiveCriterion = criterionFact("2026-10-01T00:00:00.000Z");
    const module = (await import("./index.js")) as Record<string, unknown>;
    const normalize = module.normalizeEvaluationFactSources as
      | ((
          cycleInput: typeof cycle,
          bundles: readonly Record<string, readonly unknown[]>[],
        ) => {
          projectFacts: readonly { sourceId: string }[];
          dynamicCriteriaVersions: readonly { sourceId: string }[];
        })
      | undefined;

    expect(normalize).toBeTypeOf("function");
    const result = normalize!(cycle, [
      {
        projectFacts: [duplicate],
        dynamicCriteriaVersions: [activeCriterion, prospectiveCriterion],
      },
      { projectFacts: [{ ...duplicate }] },
    ]);

    expect(result.projectFacts.map(({ sourceId: id }) => id)).toEqual([sourceId]);
    expect(result.dynamicCriteriaVersions.map(({ sourceId: id }) => id)).toEqual([
      activeCriterion.sourceId,
    ]);
  });

  it("links project facts only to responsibility windows active when the source occurred", async () => {
    const fact = projectFact(crypto.randomUUID(), "2026-08-14T10:00:00.000Z");
    const activeWindowId = crypto.randomUUID();
    const endedWindowId = crypto.randomUUID();
    const responsibilityWindow = (sourceId: string, startedAt: string, endedAt: string | null) => ({
      kind: "source_fact" as const,
      sourceType: "responsibility_window" as const,
      sourceId,
      sourceOccurredAt: startedAt,
      projectId: fact.projectId,
      workstreamId: null,
      responsibilityType: "contributor" as const,
      startedAt,
      endedAt,
      sourceReferences: [
        {
          sourceType: "responsibility_window" as const,
          sourceId,
          sourceVersion: null,
          occurredAt: startedAt,
          url: null,
        },
      ],
    });
    const module = (await import("./index.js")) as Record<string, unknown>;
    const normalize = module.normalizeEvaluationFactSources as (
      cycleInput: typeof cycle,
      bundles: readonly Record<string, readonly unknown[]>[],
    ) => { projectFacts: readonly { responsibilityWindowIds: readonly string[] }[] };

    const result = normalize(cycle, [
      {
        projectFacts: [fact],
        responsibilityWindows: [
          responsibilityWindow(
            endedWindowId,
            "2026-07-01T00:00:00.000Z",
            "2026-08-01T00:00:00.000Z",
          ),
          responsibilityWindow(activeWindowId, "2026-08-01T00:00:00.000Z", null),
        ],
      },
    ]);

    expect(result.projectFacts[0]?.responsibilityWindowIds).toEqual([activeWindowId]);
  });
});
