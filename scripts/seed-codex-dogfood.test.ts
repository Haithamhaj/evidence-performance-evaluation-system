import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createInMemoryCodexDogfoodSeedServices, seedCodexDogfood } from "./seed-codex-dogfood.js";

const projectReference = "# Project reference\nApproved source.";
const tasks = "# Tasks\nBundle 2 remains.";
const INPUT: import("./seed-codex-dogfood.js").CodexDogfoodSeedInput = {
  acceptanceMode: true,
  appEnv: "local",
  databaseUrl: "postgresql://evaluation_app@127.0.0.1:5432/evaluation",
  repository: {
    commitSha: "b73c8e9049abdee72c7702074766e1e8b4b998d4",
    pullRequestRef: "https://github.com/Haithamhaj/evidence-performance-evaluation-system/pull/5",
    sources: [
      {
        path: "docs/PROJECT_REFERENCE.md",
        sha256: createHash("sha256").update(projectReference).digest("hex"),
        content: projectReference,
      },
      {
        path: "TASKS.md",
        sha256: createHash("sha256").update(tasks).digest("hex"),
        content: tasks,
      },
    ],
  },
};

describe("Codex dogfood acceptance seed", () => {
  it("is rerunnable without rewriting approved history", async () => {
    const services = createInMemoryCodexDogfoodSeedServices();

    await seedCodexDogfood(INPUT, services);
    const before = services.approvedHistory();
    await seedCodexDogfood(INPUT, services);

    expect(services.approvedHistory()).toEqual(before);
    expect(before).toHaveLength(1);
  });

  it("creates no employee score or raw-activity progress rule", async () => {
    const services = createInMemoryCodexDogfoodSeedServices();

    await seedCodexDogfood(INPUT, services);

    expect(services.forbiddenPerformanceRows()).toEqual([]);
    expect(services.rawActivityRules()).toEqual([]);
  });

  it("refuses to run outside the explicit local acceptance environment", async () => {
    const services = createInMemoryCodexDogfoodSeedServices();

    await expect(seedCodexDogfood({ ...INPUT, appEnv: "production" }, services)).rejects.toThrow(
      "local acceptance",
    );
    await expect(seedCodexDogfood({ ...INPUT, acceptanceMode: false }, services)).rejects.toThrow(
      "local acceptance",
    );
    await expect(
      seedCodexDogfood(
        {
          ...INPUT,
          databaseUrl: "postgresql://evaluation_app@database.example.com/evaluation",
        },
        services,
      ),
    ).rejects.toThrow("local database");
  });

  it("appends a new approved source version when repository lineage changes", async () => {
    const services = createInMemoryCodexDogfoodSeedServices();
    await seedCodexDogfood(INPUT, services);

    await seedCodexDogfood(
      {
        ...INPUT,
        repository: {
          ...INPUT.repository,
          commitSha: "c".repeat(40),
        },
      },
      services,
    );

    expect(services.approvedHistory().map(({ commitSha }) => commitSha)).toEqual([
      INPUT.repository.commitSha,
      "c".repeat(40),
    ]);
  });
});
