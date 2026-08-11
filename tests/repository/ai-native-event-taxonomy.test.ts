import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Taxonomy = {
  unknownWorkSignalPolicy: string;
  telemetryDestinations: string[];
  workSignals: Array<{ key: string }>;
};

describe("AI-native event taxonomy", () => {
  it("keeps work signals and product telemetry separated", () => {
    const taxonomy = JSON.parse(
      readFileSync("docs/product/ai-native-event-taxonomy.json", "utf8"),
    ) as Taxonomy;
    const workSignals = taxonomy.workSignals.map(({ key }) => key);

    expect(workSignals).not.toContain("page.viewed");
    expect(workSignals).not.toContain("drawer.opened");
    expect(taxonomy.telemetryDestinations).not.toContain("experience_orchestrator");
    expect(taxonomy.telemetryDestinations).not.toContain("protected_command");
    expect(taxonomy.unknownWorkSignalPolicy).toBe("fail_closed");
  });
});
