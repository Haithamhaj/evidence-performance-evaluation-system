import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

function job(workflow: string, name: string): string {
  const jobs = workflow.slice(workflow.indexOf("jobs:\n") + "jobs:\n".length);
  const start = jobs.indexOf(`  ${name}:\n`);
  if (start === -1) return "";
  const remainder = jobs.slice(start + `  ${name}:\n`.length);
  const nextJob = remainder.search(/^  [a-z][a-z0-9-]*:\n/m);
  return nextJob === -1 ? remainder : remainder.slice(0, nextJob);
}

describe("CI contract", () => {
  it("pins actions and defines distinct least-privilege Phase 0 gates", async () => {
    const workflow = await readFile(".github/workflows/ci.yml", "utf8");
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain("actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0");
    expect(workflow).toContain("actions/setup-node@820762786026740c76f36085b0efc47a31fe5020");
    expect(workflow).toContain("pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271");

    const definedJobs = [
      ...workflow.slice(workflow.indexOf("jobs:\n")).matchAll(/^  ([a-z][a-z0-9-]*):\n/gm),
    ].map(([, name]) => name);
    expect(definedJobs).toEqual(["integrity", "quality", "build", "integration"]);

    for (const action of workflow.matchAll(/uses:\s+([^\s]+)/g)) {
      expect(action[1]).toMatch(/@[0-9a-f]{40}$/);
    }

    expect(job(workflow, "integrity")).toContain("node scripts/scan-secrets.mjs");
    for (const command of ["validate:task-graph", "lint", "typecheck", "test"]) {
      expect(job(workflow, "quality")).toContain(`pnpm ${command}`);
    }
    expect(job(workflow, "quality")).not.toContain("pnpm build");
    expect(job(workflow, "build")).toContain("pnpm build");
    expect(job(workflow, "integration")).toContain("needs: [quality, build]");
    expect(job(workflow, "integration")).toContain("pnpm test:integration --passWithNoTests");
    expect(job(workflow, "integration")).toContain("pnpm test:ai --passWithNoTests");
    expect(job(workflow, "integration")).toContain("pnpm test:e2e --pass-with-no-tests");
    expect(workflow).not.toContain("pull_request_target");
    expect(workflow).not.toContain("${{ secrets.");
  });

  it("keeps repository integrity checks in the local verification command", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8"));

    expect(manifest.scripts?.["scan:secrets"]).toBe("node scripts/scan-secrets.mjs");
    expect(manifest.scripts?.["test:e2e"]).toBe("playwright test tests/e2e");
    expect(manifest.scripts?.verify).toContain("pnpm validate:task-graph");
    expect(manifest.scripts?.verify).toContain("pnpm scan:secrets");
  });

  it("rejects a high-confidence secret without printing its value", async () => {
    const fixtureDirectory = await mkdtemp(path.join(tmpdir(), "secret-scan-"));
    const fixturePath = path.join(fixtureDirectory, "fixture.txt");
    const fakeSecret = ["github", "pat", "11", "A".repeat(82)].join("_");
    await writeFile(fixturePath, `${fakeSecret}\n`);

    try {
      await expect(
        execFileAsync(process.execPath, ["scripts/scan-secrets.mjs", fixturePath]),
      ).rejects.toMatchObject({
        stderr: expect.stringContaining("GitHub token"),
      });
      await expect(
        execFileAsync(process.execPath, ["scripts/scan-secrets.mjs", fixturePath]),
      ).rejects.not.toMatchObject({
        stderr: expect.stringContaining(fakeSecret),
      });
    } finally {
      await rm(fixtureDirectory, { force: true, recursive: true });
    }
  });
});
