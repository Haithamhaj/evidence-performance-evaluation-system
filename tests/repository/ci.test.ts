import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const scannerPath = path.resolve("scripts/scan-secrets.mjs");

type CommandResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

const secretCases = [
  {
    label: "private key",
    name: "private keys",
    value: () => ["-----BEGIN", "PRIVATE KEY-----"].join(" "),
  },
  {
    label: "GitHub token",
    name: "GitHub tokens",
    value: () => ["github", "pat", "11", "A".repeat(82)].join("_"),
  },
  {
    label: "AWS access key",
    name: "AWS access keys",
    value: () => `AKIA${"A".repeat(16)}`,
  },
  {
    label: "OpenAI API key",
    name: "OpenAI API keys",
    value: () => ["sk", "A".repeat(32)].join("-"),
  },
  {
    label: "Slack token",
    name: "Slack tokens",
    value: () => ["xoxb", "A".repeat(24)].join("-"),
  },
] as const;

const minimumReleaseAgeExceptions = [
  "@aws-sdk/checksums@3.1000.17",
  "@aws-sdk/client-s3@3.1087.0",
  "@aws-sdk/core@3.975.2",
  "@aws-sdk/credential-provider-env@3.972.58",
  "@aws-sdk/credential-provider-http@3.972.60",
  "@aws-sdk/credential-provider-ini@3.973.2",
  "@aws-sdk/credential-provider-login@3.972.64",
  "@aws-sdk/credential-provider-node@3.972.68",
  "@aws-sdk/credential-provider-process@3.972.58",
  "@aws-sdk/credential-provider-sso@3.973.2",
  "@aws-sdk/credential-provider-web-identity@3.972.64",
  "@aws-sdk/middleware-sdk-s3@3.972.63",
  "@aws-sdk/nested-clients@3.997.32",
  "@aws-sdk/s3-request-presigner@3.1087.0",
  "@aws-sdk/signature-v4-multi-region@3.996.40",
  "@aws-sdk/token-providers@3.1087.0",
  "@aws-sdk/types@3.974.1",
  "@aws-sdk/xml-builder@3.972.35",
] as const;

async function runScanner(files: string[] = [], cwd = process.cwd()): Promise<CommandResult> {
  try {
    const result = await execFileAsync(process.execPath, [scannerPath, ...files], { cwd });
    return { exitCode: 0, stderr: result.stderr, stdout: result.stdout };
  } catch (error) {
    const failure = error as Error & { code?: number; stderr?: string; stdout?: string };
    return {
      exitCode: typeof failure.code === "number" ? failure.code : -1,
      stderr: failure.stderr ?? "",
      stdout: failure.stdout ?? "",
    };
  }
}

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
    for (const command of [
      "validate:task-graph",
      "format:check",
      "lint",
      "typecheck",
      "test:coverage",
    ]) {
      expect(job(workflow, "quality")).toContain(`pnpm ${command}`);
    }
    expect(job(workflow, "quality")).not.toMatch(/- run: pnpm test\s*$/m);
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

    expect(manifest.scripts?.["format:check"]).toBe(
      "prettier --check package.json pnpm-workspace.yaml turbo.json tsconfig.base.json eslint.config.mjs prettier.config.mjs vitest.config.ts vitest.workspace.ts .github apps packages scripts tests",
    );
    expect(manifest.scripts?.["scan:secrets"]).toBe("node scripts/scan-secrets.mjs");
    expect(manifest.scripts?.["test:coverage"]).toBe(
      "vitest run --project unit --coverage --coverage.provider=v8 --coverage.reporter=text --coverage.include='apps/**/src/**/*.{ts,tsx}' --coverage.include='packages/**/src/**/*.ts' --coverage.include='scripts/**/*.mjs'",
    );
    expect(manifest.scripts?.["test:e2e"]).toBe("playwright test tests/e2e");
    expect(manifest.devDependencies?.["@vitest/coverage-v8"]).toBe("4.1.10");
    expect(manifest.scripts?.verify).toContain("pnpm validate:task-graph");
    expect(manifest.scripts?.verify).toContain("pnpm format:check");
    expect(manifest.scripts?.verify).toContain("pnpm scan:secrets");
  });

  it("pins only the hosted release-age exceptions while retaining pnpm 11 protection", async () => {
    const [manifestText, workspace] = await Promise.all([
      readFile("package.json", "utf8"),
      readFile("pnpm-workspace.yaml", "utf8"),
    ]);
    const manifest = JSON.parse(manifestText);
    const exclusionBlock = workspace.match(
      /^minimumReleaseAgeExclude:\n((?:  - ["'][^"']+["'](?:\n|$))+)/m,
    );
    expect(exclusionBlock).not.toBeNull();

    const exceptions = [...(exclusionBlock?.[1] ?? "").matchAll(/^  - ["']([^"']+)["']$/gm)].map(
      ([, selector]) => selector,
    );
    expect(exceptions).toEqual(minimumReleaseAgeExceptions);
    for (const selector of exceptions) {
      expect(selector).toMatch(
        /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
      );
      expect(selector).not.toContain("*");
      expect(selector).not.toContain("||");
    }

    const configuredAge = workspace.match(/^minimumReleaseAge:\s*(\d+)$/m)?.[1];
    expect(configuredAge ?? "1440").toBe("1440");
    expect(manifest.packageManager).toBe("pnpm@11.13.0");
    expect(manifest.engines?.pnpm).toBe("11.13.0");
    expect(workspace).not.toMatch(/^trustLockfile:/m);
    expect(workspace).not.toMatch(/^minimumReleaseAgeStrict:\s*false$/m);
  });

  it.each(secretCases)(
    "rejects $name without printing the matched value",
    async ({ label, value }) => {
      const fixtureDirectory = await mkdtemp(path.join(tmpdir(), "secret-scan-"));
      const fixturePath = path.join(fixtureDirectory, "fixture.txt");
      const fakeSecret = value();
      await writeFile(fixturePath, `safe prefix\n${fakeSecret}\n`);

      try {
        const result = await runScanner([fixturePath]);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain(`${fixturePath}:2: possible ${label}`);
        expect(result.stderr).not.toContain(fakeSecret);
      } finally {
        await rm(fixtureDirectory, { force: true, recursive: true });
      }
    },
  );

  it("allows safe placeholders and approved environment examples", async () => {
    const fixtureDirectory = await mkdtemp(path.join(tmpdir(), "secret-scan-safe-"));
    const examplePaths = [".env.example", ".env.test.example"].map((name) =>
      path.join(fixtureDirectory, name),
    );
    const safePlaceholders = [
      "-----BEGIN PUBLIC KEY-----",
      "github_pat_example",
      "AKIAEXAMPLE",
      "sk-example",
      "xoxb-example",
    ].join("\n");
    await Promise.all(examplePaths.map((filePath) => writeFile(filePath, safePlaceholders)));

    try {
      const result = await runScanner(examplePaths);
      expect(result).toMatchObject({ exitCode: 0, stderr: "" });
      expect(result.stdout).toContain("SECRET SCAN VALID: 2 files checked");
    } finally {
      await rm(fixtureDirectory, { force: true, recursive: true });
    }
  });

  it.each([".env.production", "server.key", "credentials-prod.json", "secrets-ci.json"])(
    "rejects sensitive filename %s",
    async (filename) => {
      const fixtureDirectory = await mkdtemp(path.join(tmpdir(), "secret-scan-name-"));
      const fixturePath = path.join(fixtureDirectory, filename);
      const harmlessContent = "placeholder only";
      await writeFile(fixturePath, harmlessContent);

      try {
        const result = await runScanner([fixturePath]);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain(`${fixturePath}:1: possible sensitive filename`);
        expect(result.stderr).not.toContain(harmlessContent);
      } finally {
        await rm(fixtureDirectory, { force: true, recursive: true });
      }
    },
  );

  it("discovers tracked and non-ignored untracked files while excluding ignored files", async () => {
    const repository = await mkdtemp(path.join(tmpdir(), "secret-scan-repository-"));
    const trackedSecret = ["sk", "T".repeat(32)].join("-");
    const untrackedSecret = `ASIA${"U".repeat(16)}`;
    const ignoredSecret = ["xoxb", "I".repeat(24)].join("-");

    try {
      await Promise.all([
        writeFile(path.join(repository, ".gitignore"), ".env.local\n"),
        writeFile(path.join(repository, "tracked.txt"), trackedSecret),
        writeFile(path.join(repository, "untracked.txt"), untrackedSecret),
        writeFile(path.join(repository, ".env.local"), ignoredSecret),
      ]);
      await execFileAsync("git", ["init", "--quiet"], { cwd: repository });
      await execFileAsync("git", ["add", ".gitignore", "tracked.txt"], { cwd: repository });

      const result = await runScanner([], repository);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("tracked.txt:1: possible OpenAI API key");
      expect(result.stderr).toContain("untracked.txt:1: possible AWS access key");
      expect(result.stderr).not.toContain(".env.local");
      for (const value of [trackedSecret, untrackedSecret, ignoredSecret]) {
        expect(result.stderr).not.toContain(value);
      }
    } finally {
      await rm(repository, { force: true, recursive: true });
    }
  });
});
