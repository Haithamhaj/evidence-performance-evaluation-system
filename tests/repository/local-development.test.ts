import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

async function pathExists(filePath: string) {
  return access(filePath).then(
    () => true,
    () => false,
  );
}

describe("local development entry point", () => {
  it("loads the required runtime variables without printing their values", async () => {
    const fixtureDirectory = await mkdtemp(path.join(os.tmpdir(), "evaluation-local-env-"));
    const envFile = path.join(fixtureDirectory, ".env.local");
    const secretMarker = "must-never-appear-in-command-output";

    await writeFile(
      envFile,
      [
        `DATABASE_URL=postgresql://evaluation:${secretMarker}@127.0.0.1:5432/evaluation`,
        "REDIS_URL=redis://127.0.0.1:6379",
        "OIDC_ISSUER=http://127.0.0.1:8081/realms/evaluation",
        "OIDC_AUDIENCE=evaluation-api",
        "OIDC_CLIENT_ID=evaluation-web",
        "APP_BASE_URL=http://localhost:3000",
        "INTERNAL_API_BASE_URL=http://127.0.0.1:3001",
        "OIDC_SESSION_SECRET=local-test-session-secret",
        "",
      ].join("\n"),
    );

    try {
      const { stderr, stdout } = await execFileAsync(
        process.execPath,
        ["scripts/run-local-development.mjs", "--check", "--env-file", envFile],
        { env: {} },
      );
      const output = `${stdout}${stderr}`;

      expect(output).toContain("LOCAL DEVELOPMENT ENVIRONMENT VALID");
      expect(output).not.toContain(secretMarker);
    } finally {
      await rm(fixtureDirectory, { force: true, recursive: true });
    }
  });

  it("fails clearly when a required runtime variable is missing", async () => {
    const fixtureDirectory = await mkdtemp(path.join(os.tmpdir(), "evaluation-local-env-"));
    const envFile = path.join(fixtureDirectory, ".env.local");
    await writeFile(envFile, "REDIS_URL=redis://127.0.0.1:6379\n");

    try {
      await expect(
        execFileAsync(
          process.execPath,
          ["scripts/run-local-development.mjs", "--check", "--env-file", envFile],
          { env: {} },
        ),
      ).rejects.toMatchObject({
        stderr: expect.stringContaining("DATABASE_URL"),
      });
    } finally {
      await rm(fixtureDirectory, { force: true, recursive: true });
    }
  });

  it("exposes the provider key only to the API and worker development processes", async () => {
    const { stdout } = await execFileAsync("pnpm", ["exec", "turbo", "run", "dev", "--dry=json"], {
      maxBuffer: 10 * 1024 * 1024,
    });
    const tasks = JSON.parse(stdout).tasks as Array<{
      package: string;
      resolvedTaskDefinition: { env: string[] };
    }>;
    const environmentFor = (packageName: string) =>
      tasks.find((task) => task.package === packageName)?.resolvedTaskDefinition.env ?? [];

    expect(environmentFor("@evaluation/api")).toEqual(
      expect.arrayContaining(["DATABASE_URL", "OPENAI_API_KEY"]),
    );
    expect(environmentFor("@evaluation/worker")).toEqual(
      expect.arrayContaining(["DATABASE_URL", "OPENAI_API_KEY"]),
    );
    expect(environmentFor("@evaluation/web")).not.toContain("OPENAI_API_KEY");
    expect(environmentFor("@evaluation/product-reset-prototype")).not.toContain("OPENAI_API_KEY");
  });
});

describe("Next generated type preparation", () => {
  it("removes development-only route types and restores the stable next-env file", async () => {
    const fixtureDirectory = await mkdtemp(path.join(os.tmpdir(), "evaluation-next-types-"));
    const devMarker = path.join(fixtureDirectory, ".next", "dev", "types", "routes.d.ts");
    const nextEnv = path.join(fixtureDirectory, "next-env.d.ts");

    await mkdir(path.dirname(devMarker), { recursive: true });
    await writeFile(devMarker, "export {};\n");
    await writeFile(
      nextEnv,
      '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\nimport "./.next/dev/types/routes.d.ts";\n',
    );

    try {
      await execFileAsync(process.execPath, [
        "scripts/prepare-next-generated-types.mjs",
        fixtureDirectory,
      ]);

      await expect(pathExists(devMarker)).resolves.toBe(false);
      await expect(readFile(nextEnv, "utf8")).resolves.toBe(
        [
          '/// <reference types="next" />',
          '/// <reference types="next/image-types/global" />',
          'import "./.next/types/routes.d.ts";',
          "",
          "// NOTE: This file should not be edited",
          "// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.",
          "",
        ].join("\n"),
      );
    } finally {
      await rm(fixtureDirectory, { force: true, recursive: true });
    }
  });
});

describe("integration test entry point", () => {
  it("loads an isolated test database without printing its value", async () => {
    const fixtureDirectory = await mkdtemp(path.join(os.tmpdir(), "evaluation-test-env-"));
    const envFile = path.join(fixtureDirectory, ".env.test");
    const secretMarker = "integration-database-secret-marker";
    await writeFile(
      envFile,
      `TEST_DATABASE_URL=postgresql://evaluation:${secretMarker}@127.0.0.1:5432/evaluation_test\n`,
    );

    try {
      const { stderr, stdout } = await execFileAsync(
        process.execPath,
        ["scripts/run-integration-tests.mjs", "--check", "--env-file", envFile],
        { env: {} },
      );
      const output = `${stdout}${stderr}`;

      expect(output).toContain("INTEGRATION TEST ENVIRONMENT VALID");
      expect(output).not.toContain(secretMarker);
    } finally {
      await rm(fixtureDirectory, { force: true, recursive: true });
    }
  });

  it("rejects an integration environment without a test database", async () => {
    const fixtureDirectory = await mkdtemp(path.join(os.tmpdir(), "evaluation-test-env-"));
    const envFile = path.join(fixtureDirectory, ".env.test");
    await writeFile(envFile, "REDIS_URL=redis://127.0.0.1:6379\n");

    try {
      await expect(
        execFileAsync(
          process.execPath,
          ["scripts/run-integration-tests.mjs", "--check", "--env-file", envFile],
          { env: {} },
        ),
      ).rejects.toMatchObject({
        stderr: expect.stringContaining("TEST_DATABASE_URL"),
      });
    } finally {
      await rm(fixtureDirectory, { force: true, recursive: true });
    }
  });
});
