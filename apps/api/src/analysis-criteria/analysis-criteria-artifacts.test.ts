import { describe, expect, it } from "vitest";

import { ANALYSIS_CRITERIA_ARTIFACTS } from "./analysis-criteria-artifacts.js";

describe("analysis criteria AI artifacts", () => {
  it("publishes four exact route-bound schema and prompt hashes", () => {
    expect(ANALYSIS_CRITERIA_ARTIFACTS.map(({ routeKey }) => routeKey)).toEqual([
      "document.analyze",
      "document.compare",
      "criteria.generate.project",
      "criteria.generate.workstream",
    ]);
    for (const artifact of ANALYSIS_CRITERIA_ARTIFACTS) {
      expect(artifact.outputSchemaVersion).toMatch(/\.v2$/u);
      expect(artifact.prompt.version).toMatch(/\.v2$/u);
      expect(artifact.outputSchemaDescriptor.routeKey).toBe(artifact.routeKey);
      expect(artifact.outputSchemaDescriptor.schemaHash).toMatch(/^[a-f0-9]{64}$/u);
      expect(artifact.prompt.sha256).toMatch(/^[a-f0-9]{64}$/u);
    }
    expect(ANALYSIS_CRITERIA_ARTIFACTS[2].prompt.sha256).toBe(
      ANALYSIS_CRITERIA_ARTIFACTS[3].prompt.sha256,
    );
  });
});
