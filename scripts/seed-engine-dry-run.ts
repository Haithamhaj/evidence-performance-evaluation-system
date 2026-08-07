import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";

import { createDatabaseClient } from "@evaluation/database";

import { seedCoachingDevelopmentAcceptance } from "./seed-coaching-development-acceptance.js";
import { seedContinuityAcceptance } from "./seed-continuity-acceptance.js";
import { seedEmployeeEvaluationAcceptance } from "./seed-employee-evaluation-acceptance.js";
import { seedManagerEvaluationAcceptance } from "./seed-manager-evaluation-acceptance.js";
import { seedOperationsAcceptance } from "./seed-operations-acceptance.js";

const execFile = promisify(execFileCallback);

export const ENGINE_DRY_RUN_STAGES = Object.freeze([
  { id: "daily-work", purpose: "Project, Tasks, private Inbox, sources, progress and manual path" },
  {
    id: "research-experiments",
    purpose: "Source-backed Research, Experiments and Applied Learning",
  },
  { id: "employee-evaluation", purpose: "English Calibration cycle and final human judgment" },
  {
    id: "identified-manager-feedback",
    purpose: "Identified upward feedback and leave-aware completion",
  },
  { id: "coaching-development", purpose: "Employee-controlled coaching and development" },
  { id: "continuity", purpose: "Leave, delegation, deactivation and reassignment" },
  { id: "operations", purpose: "Notifications, retry, export revocation and administration" },
  { id: "backup-restore", purpose: "Encrypted backup and protected isolated restore" },
] as const);

type StageId = (typeof ENGINE_DRY_RUN_STAGES)[number]["id"];

export async function runEngineDryRun(
  input: Readonly<{
    execute: boolean;
    executeStage: (id: StageId) => Promise<void>;
  }>,
) {
  if (!input.execute) return { status: "PLAN_ONLY" as const, stages: ENGINE_DRY_RUN_STAGES };
  const results: Array<{ id: StageId; status: "PASSED" }> = [];
  for (const stage of ENGINE_DRY_RUN_STAGES) {
    try {
      await input.executeStage(stage.id);
      results.push({ id: stage.id, status: "PASSED" });
    } catch (error) {
      throw new Error(`engine dry run failed at ${stage.id}`, { cause: error });
    }
  }
  return { status: "PASSED" as const, stages: results };
}

function assertLocalExecution() {
  if (process.env.APP_ENV !== "local") throw new Error("engine dry run requires APP_ENV=local");
  const databaseUrl = required("DATABASE_URL");
  const target = new URL(databaseUrl);
  if (target.protocol !== "postgresql:" || !["127.0.0.1", "localhost"].includes(target.hostname)) {
    throw new Error("engine dry run requires an explicit local PostgreSQL database");
  }
  return databaseUrl;
}

async function runQuiet(command: string, args: readonly string[]) {
  try {
    await execFile(command, [...args], {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 2_000_000,
    });
  } catch (error) {
    throw new Error(`bounded command failed: ${path.basename(command)}`, { cause: error });
  }
}

async function executeLocalStage(id: StageId, databaseUrl: string) {
  if (id === "daily-work") {
    await runQuiet("pnpm", ["dogfood:seed"]);
    return;
  }
  if (id === "research-experiments") {
    await runQuiet("pnpm", ["research:seed"]);
    return;
  }
  if (id === "backup-restore") {
    await runBackupRestoreDrill();
    return;
  }
  if (id === "operations") {
    await seedOperationsAcceptance();
    return;
  }

  const database = createDatabaseClient(databaseUrl);
  try {
    if (id === "employee-evaluation") await seedEmployeeEvaluationAcceptance();
    if (id === "identified-manager-feedback") {
      await seedManagerEvaluationAcceptance(database, {
        managerSubject: required("PILOT_MANAGER_OIDC_SUBJECT"),
        adminSubject: required("PILOT_ADMIN_OIDC_SUBJECT"),
        oidcIssuer: required("OIDC_ISSUER"),
      });
    }
    if (id === "coaching-development") await seedCoachingDevelopmentAcceptance(database);
    if (id === "continuity") await seedContinuityAcceptance(database);
  } finally {
    await database.$disconnect();
  }
}

async function runBackupRestoreDrill() {
  const root = await mkdtemp(path.join(tmpdir(), "ebpes-engine-dry-run-"));
  try {
    const database = path.join(root, "database.dump");
    const objects = path.join(root, "objects.json");
    const config = path.join(root, "config.json");
    const key = path.join(root, "backup.key");
    const backup = path.join(root, "backup");
    const restored = path.join(root, "restored");
    await Promise.all([
      writeFile(database, "synthetic engine recovery record\n"),
      writeFile(objects, JSON.stringify([{ key: "private/evidence", version: "v1" }])),
      writeFile(
        config,
        JSON.stringify({
          schemaVersion: 37,
          integrityInventory: {
            auditChain: 1,
            foreignKeys: 1,
            closedEvaluations: 1,
            upwardResponses: 1,
            evidenceSources: 1,
            responsibilityWindows: 1,
            delegationWindows: 1,
          },
        }),
      ),
      writeFile(key, randomBytes(32), { mode: 0o600 }),
    ]);
    const now = new Date().toISOString();
    await runQuiet(process.execPath, [
      "scripts/backup/create-engine-backup.mjs",
      "--target-dir",
      backup,
      "--database-dump",
      database,
      "--object-inventory",
      objects,
      "--config-inventory",
      config,
      "--key-file",
      key,
      "--key-reference",
      "ephemeral-local-dry-run-key",
      "--created-at",
      now,
    ]);
    await runQuiet(process.execPath, [
      "scripts/backup/restore-engine-backup.mjs",
      "--environment",
      "local-isolated",
      "--manifest",
      path.join(backup, "manifest.json"),
      "--key-file",
      key,
      "--target-dir",
      restored,
      "--approval-reference",
      "e6c-local-technical-dry-run",
      "--maintenance-mode",
      "enabled",
      "--safety-backup-reference",
      "ephemeral-local-safety-copy",
      "--connectors",
      "disabled",
      "--queue-replay",
      "disabled",
      "--expected-schema-version",
      "37",
      "--max-age-hours",
      "24",
    ]);
    await runQuiet(process.execPath, [
      "scripts/backup/verify-restored-engine.mjs",
      "--target-dir",
      restored,
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const execute = process.argv.includes("--execute");
  const databaseUrl = execute ? assertLocalExecution() : "";
  const result = await runEngineDryRun({
    execute,
    executeStage: (id) => executeLocalStage(id, databaseUrl),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const isDirect =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirect) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "engine dry run failed"}\n`);
    process.exitCode = 1;
  });
}
