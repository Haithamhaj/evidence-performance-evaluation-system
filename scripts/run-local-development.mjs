import { spawn, spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { prepareNextGeneratedTypes } from "./prepare-next-generated-types.mjs";

const requiredRuntimeVariables = [
  "DATABASE_URL",
  "REDIS_URL",
  "OIDC_ISSUER",
  "OIDC_AUDIENCE",
  "OIDC_CLIENT_ID",
  "APP_BASE_URL",
  "INTERNAL_API_BASE_URL",
  "OIDC_SESSION_SECRET",
];

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

async function exists(filePath) {
  return access(filePath).then(
    () => true,
    () => false,
  );
}

function mainWorktreeDirectory() {
  const result = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (result.status !== 0) return undefined;
  return path.dirname(result.stdout.trim());
}

async function loadOptionalOpenAiEnvironment() {
  const mainWorktree = mainWorktreeDirectory();
  const candidates = [
    path.resolve(".env.openai.local"),
    ...(mainWorktree === undefined ? [] : [path.join(mainWorktree, ".env.openai.local")]),
  ];
  for (const candidate of new Set(candidates)) {
    if (await exists(candidate)) {
      process.loadEnvFile(candidate);
      return;
    }
  }
}

async function prepareTrackedNextFiles() {
  await Promise.all([
    prepareNextGeneratedTypes("apps/web"),
    prepareNextGeneratedTypes("apps/product-reset-prototype"),
  ]);
}

const expectedNodeVersion = (await readFile(".node-version", "utf8")).trim();
const actualNodeVersion = process.versions.node;
const envFile = path.resolve(argumentValue("--env-file") ?? ".env.local");
if (actualNodeVersion !== expectedNodeVersion) {
  process.stderr.write(
    `Unsupported Node.js version ${actualNodeVersion}; activate ${expectedNodeVersion} from .node-version.\n`,
  );
  process.exitCode = 1;
} else if (!(await exists(envFile))) {
  process.stderr.write(
    `Local environment file not found: ${envFile}\nCreate it with: cp .env.example .env.local\n`,
  );
  process.exitCode = 1;
} else {
  process.loadEnvFile(envFile);
  await loadOptionalOpenAiEnvironment();

  const missing = requiredRuntimeVariables.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    process.stderr.write(`Missing required local runtime variables: ${missing.join(", ")}\n`);
    process.exitCode = 1;
  } else if (process.argv.includes("--check")) {
    process.stdout.write("LOCAL DEVELOPMENT ENVIRONMENT VALID\n");
  } else {
    await prepareTrackedNextFiles();
    const turboExecutable = path.resolve("node_modules", ".bin", "turbo");
    const child = spawn(turboExecutable, ["run", "dev", "--parallel"], {
      env: process.env,
      stdio: "inherit",
    });
    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.on(signal, () => {
        if (!child.killed) child.kill(signal);
      });
    }
    const exitCode = await new Promise((resolve) => {
      child.once("error", (error) => {
        process.stderr.write(`Unable to start local development: ${error.message}\n`);
        resolve(1);
      });
      child.once("exit", (code, signal) => {
        resolve(signal === null ? (code ?? 1) : 128);
      });
    });
    await prepareTrackedNextFiles();
    process.exitCode = exitCode;
  }
}
