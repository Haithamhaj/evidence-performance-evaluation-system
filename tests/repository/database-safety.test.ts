import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const guardPath = path.resolve("scripts/assert-local-database.mjs");

type GuardResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

async function runGuard(databaseUrl: string, appEnv: string): Promise<GuardResult> {
  const env = {
    APP_ENV: appEnv,
    DATABASE_URL: databaseUrl,
    PATH: process.env.PATH,
  };

  try {
    const result = await execFileAsync(process.execPath, [guardPath], { env });
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

describe("local database reset guard", () => {
  it.each(["localhost", "127.0.0.1", "postgres"])("allows the local host %s", async (host) => {
    const result = await runGuard(
      `postgresql://test-user:test-password@${host}:5432/test`,
      "local",
    );

    expect(result).toEqual({ exitCode: 0, stderr: "", stdout: "" });
  });

  it.each(["local", "test"])("allows APP_ENV=%s", async (appEnv) => {
    const result = await runGuard(
      "postgresql://test-user:test-password@localhost:5432/test",
      appEnv,
    );

    expect(result).toEqual({ exitCode: 0, stderr: "", stdout: "" });
  });

  it("rejects a non-local host without exposing credentials", async () => {
    const databaseUrl = "postgresql://private-user:private-password@database.example.com/test";
    const result = await runGuard(databaseUrl, "local");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Database reset refused: target host is not local");
    expect(`${result.stdout}${result.stderr}`).not.toContain("private-user");
    expect(`${result.stdout}${result.stderr}`).not.toContain("private-password");
  });

  it.each(["development", "staging", "production", ""])("rejects APP_ENV=%s", async (appEnv) => {
    const result = await runGuard(
      "postgresql://test-user:test-password@localhost:5432/test",
      appEnv,
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Database reset refused: APP_ENV must be local or test");
  });

  it("wires the guarded reset and migration workflow without connection strings in arguments", async () => {
    const [manifestText, databaseManifestText, publicEntry, vitestWorkspace] = await Promise.all([
      readFile("package.json", "utf8"),
      readFile("packages/database/package.json", "utf8"),
      readFile("packages/database/src/index.ts", "utf8"),
      readFile("vitest.workspace.ts", "utf8"),
    ]);
    const manifest = JSON.parse(manifestText);
    const databaseManifest = JSON.parse(databaseManifestText);

    expect(manifest.scripts).toMatchObject({
      "db:deploy": "pnpm --filter @evaluation/database db:deploy",
      "db:generate": "pnpm --filter @evaluation/database db:generate",
      "db:migrate": "pnpm --filter @evaluation/database db:migrate",
      "db:reset:local":
        "node scripts/assert-local-database.mjs && pnpm --filter @evaluation/database exec prisma migrate reset --force",
      "db:seed": "pnpm --filter @evaluation/database db:seed",
      "db:verify": "node scripts/verify-migrations.mjs",
    });
    expect(databaseManifest.dependencies).toMatchObject({
      "@prisma/adapter-pg": "7.8.0",
      "@prisma/client": "7.8.0",
      pg: "8.22.0",
    });
    expect(publicEntry).toBe(
      [
        'export { createDatabaseClient } from "./client.js";',
        "export {",
        "  PILOT_SEED_ISSUER,",
        "  seedPilot,",
        "  type PilotSubjects,",
        "  type RoleAssignmentChange,",
        '} from "./seed-pilot.js";',
        'export { withTransaction } from "./transactions.js";',
        "",
      ].join("\n"),
    );
    expect(publicEntry).not.toContain("generated");
    expect(vitestWorkspace).toContain(
      'exclude: ["**/node_modules/**", "**/*.integration.test.ts"]',
    );
    expect(vitestWorkspace).toContain('"packages/**/*.integration.test.ts"');
  });

  it("builds the previous snapshot from every migration before the latest", async () => {
    const [prismaConfig, verifier] = await Promise.all([
      readFile("packages/database/prisma.config.ts", "utf8"),
      readFile("scripts/verify-migrations.mjs", "utf8"),
    ]);

    expect(prismaConfig).toContain(
      'path: process.env.PRISMA_MIGRATIONS_PATH ?? "prisma/migrations"',
    );
    expect(verifier).toContain("migrationDirectories.slice(0, -1)");
    expect(verifier).not.toContain("migrationDirectories.length !== 1");
  });
});
