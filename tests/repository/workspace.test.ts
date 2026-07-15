import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const requiredApps = ["web", "api", "worker"] as const;
const requiredPackages = [
  "contracts",
  "config",
  "database",
  "auth",
  "permissions",
  "audit",
  "ai-routing",
  "localization",
  "observability",
  "ui",
  "test-utils",
] as const;

describe("workspace contract", () => {
  it("declares every Phase 0 workspace with one public entry point", async () => {
    for (const app of requiredApps) {
      const manifest = JSON.parse(await readFile(`apps/${app}/package.json`, "utf8"));
      expect(manifest.name).toBe(`@evaluation/${app}`);
      expect(manifest.private).toBe(true);
    }

    for (const pkg of requiredPackages) {
      const manifest = JSON.parse(await readFile(`packages/${pkg}/package.json`, "utf8"));
      expect(manifest.name).toBe(`@evaluation/${pkg}`);
      expect(manifest.exports).toEqual({ ".": "./src/index.ts" });
    }
  });

  it("typechecks Web before applying the Next.js TypeScript 7 compatibility bypass", async () => {
    const manifest = JSON.parse(await readFile("apps/web/package.json", "utf8"));
    expect(manifest.scripts.build).toBe("tsc -p tsconfig.json --noEmit && next build");

    const nextConfig = await readFile("apps/web/next.config.mjs", "utf8");
    expect(nextConfig).toContain("ignoreBuildErrors: true");
  });

  it("excludes generated output from source-boundary validation", async () => {
    const generatedFixture = "apps/web/.next/boundary-generated-fixture.ts";
    await mkdir("apps/web/.next", { recursive: true });
    await writeFile(
      generatedFixture,
      'import generated from "@evaluation/database/private";\nvoid generated;\n',
    );

    try {
      const { stdout } = await execFileAsync(process.execPath, ["scripts/validate-boundaries.mjs"]);
      expect(stdout).toContain("BOUNDARIES VALID");
    } finally {
      await rm(generatedFixture, { force: true });
    }
  });

  it("rejects side-effect imports of server-only packages from Web", async () => {
    const forbiddenFixture = "apps/web/src/boundary-forbidden-fixture.ts";
    await writeFile(forbiddenFixture, 'import "@evaluation/database";\n');

    try {
      await expect(
        execFileAsync(process.execPath, ["scripts/validate-boundaries.mjs"]),
      ).rejects.toMatchObject({
        stderr: expect.stringContaining("BOUNDARY_WEB_SERVER_IMPORT"),
      });
    } finally {
      await rm(forbiddenFixture, { force: true });
    }
  });
});
