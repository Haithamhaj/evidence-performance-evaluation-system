import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
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
const webForbiddenPackages = [
  "@evaluation/database",
  "@evaluation/ai-routing",
  "ioredis",
  "redis",
  "bullmq",
  "openai",
  "@anthropic-ai/sdk",
  "@google/generative-ai",
  "@google/genai",
] as const;
const webForbiddenImports = webForbiddenPackages.flatMap((packageName) => [
  packageName,
  `${packageName}/internal`,
]);

describe("workspace contract", () => {
  it("never discovers dependency test suites through workspace links", async () => {
    const vitestWorkspace = await readFile("vitest.workspace.ts", "utf8");

    expect(vitestWorkspace).toContain('"**/node_modules/**"');
    expect(vitestWorkspace).toContain('"**/*.integration.test.ts"');
    expect(vitestWorkspace).toContain('"**/*.storybook.test.tsx"');
  });

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

  it("builds Web from clean state in CI without installing dependencies", async () => {
    await rm("apps/web/.next", { force: true, recursive: true });

    try {
      const { stderr, stdout } = await execFileAsync(
        "pnpm",
        ["--filter", "@evaluation/web", "build"],
        {
          env: { ...process.env, CI: "1", NEXT_TELEMETRY_DISABLED: "1" },
          maxBuffer: 10 * 1024 * 1024,
        },
      );
      const output = `${stdout}${stderr}`;

      expect(output).not.toContain("Installing dependencies");
      await expect(stat("apps/web/.next/BUILD_ID")).resolves.toBeDefined();
    } finally {
      await rm("apps/web/.next", { force: true, recursive: true });
    }
  }, 60_000);

  it("typechecks Web from clean generated state", async () => {
    await rm("apps/web/.next", { force: true, recursive: true });

    try {
      await expect(
        execFileAsync("pnpm", ["--filter", "@evaluation/web", "typecheck"], {
          env: { ...process.env, CI: "1", NEXT_TELEMETRY_DISABLED: "1" },
          maxBuffer: 10 * 1024 * 1024,
        }),
      ).resolves.toBeDefined();
    } finally {
      await rm("apps/web/.next", { force: true, recursive: true });
    }
  }, 60_000);

  it("excludes generated output from source-boundary validation", async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), "evaluation-boundary-generated-"));
    const fixtureDirectory = path.join(fixtureRoot, "apps/web/.next/generated");
    const storybookDirectory = path.join(fixtureRoot, "apps/web/storybook-static/assets");
    await mkdir(fixtureDirectory, { recursive: true });
    await mkdir(storybookDirectory, { recursive: true });
    await mkdir(path.join(fixtureRoot, "apps/web/src"), { recursive: true });
    const generatedFixture = path.join(fixtureDirectory, "forbidden.ts");
    await writeFile(
      generatedFixture,
      'import generated from "@evaluation/database/private";\nvoid generated;\n',
    );
    await writeFile(
      path.join(storybookDirectory, "forbidden.js"),
      'import generated from "@evaluation/database/private";\nvoid generated;\n',
    );
    await writeFile(
      path.join(fixtureRoot, "apps/web/src/allowed.ts"),
      "export const valid = true;\n",
    );

    try {
      const { stdout } = await execFileAsync(process.execPath, [
        "scripts/validate-boundaries.mjs",
        "--root",
        fixtureRoot,
      ]);
      expect(stdout).toContain("BOUNDARIES VALID");
    } finally {
      await rm(fixtureRoot, { force: true, recursive: true });
    }
  }, 30_000);

  it.each(webForbiddenImports)(
    "rejects Web imports of %s",
    async (specifier) => {
      const fixtureRoot = await mkdtemp(path.join(tmpdir(), "evaluation-boundary-forbidden-"));
      const fixtureDirectory = path.join(fixtureRoot, "apps/web/src");
      await mkdir(fixtureDirectory, { recursive: true });
      const forbiddenFixture = path.join(fixtureDirectory, "forbidden.ts");
      await writeFile(forbiddenFixture, `import "${specifier}";\n`);

      try {
        await expect(
          execFileAsync(process.execPath, [
            "scripts/validate-boundaries.mjs",
            "--root",
            fixtureRoot,
          ]),
        ).rejects.toMatchObject({
          stderr: expect.stringContaining("BOUNDARY_WEB_SERVER_IMPORT"),
        });
      } finally {
        await rm(fixtureRoot, { force: true, recursive: true });
      }
    },
    30_000,
  );

  it("lints ordinary TypeScript, decorator, and TSX syntax", async () => {
    const fixtureDirectory = await mkdtemp(path.join("apps/api/src", ".eslint-fixture-"));
    const lintFixture = path.join(fixtureDirectory, "typed.ts");
    const tsxFixture = path.join(fixtureDirectory, "component.tsx");
    await writeFile(
      lintFixture,
      [
        "export interface TypedRecord { value: string }",
        "export function identity<Value>(value: Value): Value { return value; }",
        "function entity(_target: object): void {}",
        "@entity",
        "export class TypedEntity {}",
        'export const record = { value: identity("ok") } satisfies TypedRecord;',
        "",
      ].join("\n"),
    );
    await writeFile(tsxFixture, "export function Component() { return <main />; }\n");

    try {
      await expect(
        execFileAsync("pnpm", ["exec", "eslint", fixtureDirectory]),
      ).resolves.toMatchObject({ stderr: "" });
    } finally {
      await rm(fixtureDirectory, { force: true, recursive: true });
    }
  });
});
