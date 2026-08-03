import { describe, expect, it } from "vitest";

import { timelineSourceProvenance } from "./source-provenance.js";

describe("timelineSourceProvenance", () => {
  it.each([
    [["pasted_text"], "employee_text"],
    [["voice_transcript"], "employee_voice"],
    [["file"], "employee_file"],
    [["image"], "employee_file"],
    [["pasted_code"], "employee_code"],
    [["cli_snapshot"], "employee_code"],
    [["url"], "employee_url"],
    [["github_snapshot"], "employee_github_snapshot"],
    [["pasted_text", "file", "pasted_code"], "employee_mixed"],
    [["github_automated"], "github_automated"],
    [["human_decision"], "human_decision"],
  ] as const)("maps immutable source kinds %j to %s", (sourceKinds, expected) => {
    expect(timelineSourceProvenance(sourceKinds)).toBe(expected);
  });

  it("rejects a Timeline row that has no governed source kind", () => {
    expect(() => timelineSourceProvenance([])).toThrow();
  });
});
