import { describe, expect, it } from "vitest";

import { matchProgressConditions } from "./progress-condition-matcher.js";

const contractId = "00000000-0000-4000-8000-000000000101";
const sourceEventId = "00000000-0000-4000-8000-000000000202";

const source = {
  eventId: sourceEventId,
  installationId: "installation-7",
  repositoryId: "repository-42",
  sourceId: "PR_42",
  acceptanceState: "merged" as const,
};

describe("matchProgressConditions", () => {
  it("matches one condition only when its source identity, accepted state, and active contract version agree", () => {
    const result = matchProgressConditions({
      source,
      activeContract: { id: contractId, version: 3, state: "active" },
      conditions: [
        {
          id: "release-gate",
          contractId,
          contractVersion: 3,
          componentId: "00000000-0000-4000-8000-000000000303",
          sourceIdentity: {
            installationId: "installation-7",
            repositoryId: "repository-42",
            sourceId: "PR_42",
          },
          acceptanceState: "merged",
        },
      ],
    });

    expect(result).toEqual({
      state: "matched",
      conditionId: "release-gate",
      componentId: "00000000-0000-4000-8000-000000000303",
      sourceEventId,
      contractId,
      contractVersion: 3,
    });
  });

  it.each([
    [
      "different source identity",
      { ...source, sourceId: "PR_43" },
      { id: contractId, version: 3, state: "active" as const },
    ],
    [
      "unaccepted source state",
      { ...source, acceptanceState: "open" as const },
      { id: contractId, version: 3, state: "active" as const },
    ],
    [
      "superseded contract version",
      source,
      { id: contractId, version: 4, state: "active" as const },
    ],
  ])("does not match a %s", (_name, candidateSource, activeContract) => {
    expect(
      matchProgressConditions({
        source: candidateSource,
        activeContract,
        conditions: [
          {
            id: "release-gate",
            contractId,
            contractVersion: 3,
            componentId: "00000000-0000-4000-8000-000000000303",
            sourceIdentity: {
              installationId: "installation-7",
              repositoryId: "repository-42",
              sourceId: "PR_42",
            },
            acceptanceState: "merged",
          },
        ],
      }),
    ).toEqual({ state: "no_match", sourceEventId });
  });

  it("routes more than one deterministic match to Project-owner review", () => {
    const result = matchProgressConditions({
      source,
      activeContract: { id: contractId, version: 3, state: "active" },
      conditions: ["alpha", "beta"].map((id) => ({
        id,
        contractId,
        contractVersion: 3,
        componentId: crypto.randomUUID(),
        sourceIdentity: {
          installationId: "installation-7",
          repositoryId: "repository-42",
          sourceId: "PR_42",
        },
        acceptanceState: "merged" as const,
      })),
    });

    expect(result).toEqual({
      state: "owner_review_required",
      sourceEventId,
      contractId,
      contractVersion: 3,
      conditionIds: ["alpha", "beta"],
    });
  });

  it.each(["commit_count", "changed_lines", "changed_files", "commit_frequency", "author_volume"])(
    "rejects %s as a condition field",
    (prohibitedField) => {
      expect(() =>
        matchProgressConditions({
          source,
          activeContract: { id: contractId, version: 3, state: "active" },
          conditions: [
            {
              id: "invalid",
              contractId,
              contractVersion: 3,
              componentId: "00000000-0000-4000-8000-000000000303",
              sourceIdentity: {
                installationId: "installation-7",
                repositoryId: "repository-42",
                sourceId: "PR_42",
              },
              acceptanceState: "merged",
              [prohibitedField]: 1,
            },
          ],
        }),
      ).toThrow();
    },
  );
});
