import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseEnv } from "node:util";

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

function forwardedArguments() {
  const forwarded = [];
  for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (argument === "--" || argument === "--check") continue;
    if (argument === "--env-file") {
      index += 1;
      continue;
    }
    forwarded.push(argument);
  }
  return forwarded;
}

async function exists(filePath) {
  return access(filePath).then(
    () => true,
    () => false,
  );
}

async function run(command, arguments_, environment) {
  const child = spawn(command, arguments_, { env: environment, stdio: "inherit" });
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve(signal === null ? (code ?? 1) : 128));
  });
}

const requestedEnvFile = argumentValue("--env-file");
const defaultEnvFile = (await exists(".env.test")) ? ".env.test" : ".env.test.example";
const envFile = path.resolve(requestedEnvFile ?? defaultEnvFile);
const localServiceDefaults = path.resolve(".env.example");
if (!(await exists(localServiceDefaults))) {
  process.stderr.write(`Local service defaults not found: ${localServiceDefaults}\n`);
  process.exitCode = 1;
} else if (!(await exists(envFile))) {
  process.stderr.write(
    `Integration environment file not found: ${envFile}\nCreate it with: cp .env.test.example .env.test\n`,
  );
  process.exitCode = 1;
} else {
  const testEnvironment = parseEnv(await readFile(envFile, "utf8"));
  const testDatabaseUrl = testEnvironment.TEST_DATABASE_URL?.trim();
  if (!testDatabaseUrl) {
    process.stderr.write("TEST_DATABASE_URL is required in the integration environment file.\n");
    process.exitCode = 1;
  } else {
    process.loadEnvFile(localServiceDefaults);
    process.loadEnvFile(envFile);
    if (process.argv.includes("--check")) {
      process.stdout.write("INTEGRATION TEST ENVIRONMENT VALID\n");
    } else {
      const environment = { ...process.env, APP_ENV: "test", DATABASE_URL: testDatabaseUrl };
      const generateExit = await run("pnpm", ["db:generate"], environment);
      if (generateExit !== 0) {
        process.exitCode = generateExit;
      } else {
        const migrationExit = await run("pnpm", ["db:deploy"], environment);
        if (migrationExit !== 0) {
          process.exitCode = migrationExit;
          process.exit();
        }
        process.exitCode = await run(
          process.execPath,
          [
            "node_modules/vitest/vitest.mjs",
            "run",
            "--project",
            "integration",
            ...forwardedArguments(),
          ],
          environment,
        );
      }
    }
  }
}
