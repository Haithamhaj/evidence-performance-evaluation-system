import { describe, expect, it, vi } from "vitest";

import { ENGINE_DRY_RUN_STAGES, runEngineDryRun } from "./seed-engine-dry-run.js";

describe("engine technical dry-run orchestrator", () => {
  it("publishes the complete non-mutating plan by default", async () => {
    const executeStage = vi.fn();
    const result = await runEngineDryRun({ execute: false, executeStage });

    expect(result.status).toBe("PLAN_ONLY");
    expect(result.stages.map(({ id }) => id)).toEqual(ENGINE_DRY_RUN_STAGES.map(({ id }) => id));
    expect(result.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "daily-work" }),
        expect.objectContaining({ id: "research-experiments" }),
        expect.objectContaining({ id: "employee-evaluation" }),
        expect.objectContaining({ id: "identified-manager-feedback" }),
        expect.objectContaining({ id: "continuity" }),
        expect.objectContaining({ id: "backup-restore" }),
      ]),
    );
    expect(executeStage).not.toHaveBeenCalled();
  });

  it("stops immediately when a stage fails", async () => {
    const executeStage = vi.fn(async (id: string) => {
      if (id === "research-experiments") throw new Error("synthetic failure");
    });

    await expect(runEngineDryRun({ execute: true, executeStage })).rejects.toThrow(
      "engine dry run failed at research-experiments",
    );
    expect(executeStage).toHaveBeenCalledTimes(2);
  });
});
