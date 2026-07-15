import console from "node:console";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cp, copyFile, mkdtemp, readdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databasePackage = path.join(repositoryRoot, "packages/database");
const migrationsPath = path.join(databasePackage, "prisma/migrations");
const requireFromDatabase = createRequire(path.join(databasePackage, "package.json"));
const { Client } = requireFromDatabase("pg");

const testDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const superuserPassword = requiredEnvironment("POSTGRES_SUPERUSER_PASSWORD");
const testTarget = parsePostgresUrl(testDatabaseUrl, "TEST_DATABASE_URL");
const owner = decodeURIComponent(testTarget.username);

if (owner.length === 0) {
  fail("Migration verification requires a database owner in TEST_DATABASE_URL");
}

const suffix = randomBytes(6).toString("hex");
const disposableNames = [
  `evaluation_verify_empty_${suffix}`,
  `evaluation_verify_previous_${suffix}`,
  `evaluation_verify_rebuild_${suffix}`,
];
const [emptyDatabase, previousDatabase, rebuildDatabase] = disposableNames;
const adminTarget = new URL(testTarget);
adminTarget.username = process.env.POSTGRES_SUPERUSER_USERNAME ?? "postgres";
adminTarget.password = superuserPassword;
adminTarget.pathname = "/postgres";
adminTarget.search = "";

const admin = new Client({ connectionString: adminTarget.toString() });
let connected = false;
let previousMigrationsPath;

try {
  const migrationDirectories = (await readdir(migrationsPath, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (migrationDirectories.length === 0) {
    fail("Migration verification requires at least one migration");
  }

  await admin.connect();
  connected = true;
  for (const databaseName of disposableNames) {
    await admin.query(
      `CREATE DATABASE ${quoteIdentifier(databaseName)} OWNER ${quoteIdentifier(owner)}`,
    );
  }

  const emptyTarget = databaseUrlFor(emptyDatabase);
  const previousTarget = databaseUrlFor(previousDatabase);
  const rebuildTarget = databaseUrlFor(rebuildDatabase);

  await deployMigrations(emptyTarget);
  await assertNoDrift(emptyTarget);
  await runIntegrationTest(emptyTarget);

  const previousMigrationDirectories = migrationDirectories.slice(0, -1);
  if (previousMigrationDirectories.length === 0) {
    if ((await readSchema(previousTarget)) !== serializedEmptySchema()) {
      fail("The previous snapshot for the first migration must be empty");
    }
    console.log("Previous snapshot verified as empty: 0001 is the first migration.");
  } else {
    previousMigrationsPath = await buildPreviousMigrations(previousMigrationDirectories);
    await deployMigrations(previousTarget, previousMigrationsPath);
    console.log(
      `Previous snapshot applied through ${previousMigrationDirectories.at(-1) ?? "unknown"}.`,
    );
  }
  await deployMigrations(previousTarget);
  await assertNoDrift(previousTarget);

  await deployMigrations(rebuildTarget);
  await assertNoDrift(rebuildTarget);

  const [emptySchemaState, previousSchema, rebuildSchema] = await Promise.all([
    readSchema(emptyTarget),
    readSchema(previousTarget),
    readSchema(rebuildTarget),
  ]);
  if (emptySchemaState !== previousSchema || emptySchemaState !== rebuildSchema) {
    fail("Migration rebuilds did not produce equivalent PostgreSQL schemas");
  }

  console.log("MIGRATIONS VERIFIED: empty database, previous snapshot, drift, rebuild equivalence");
} finally {
  if (!connected) {
    try {
      await admin.connect();
      connected = true;
    } catch {
      // The original connection failure is more useful than a cleanup connection failure.
    }
  }

  if (connected) {
    for (const databaseName of disposableNames) {
      await admin.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
        [databaseName],
      );
      await admin.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`);
    }
    await admin.end();
  }
  if (previousMigrationsPath) {
    await rm(previousMigrationsPath, { force: true, recursive: true });
  }
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    fail(`Migration verification requires ${name}`);
  }
  return value;
}

function parsePostgresUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`Migration verification requires a valid ${label}`);
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    fail(`Migration verification requires a PostgreSQL ${label}`);
  }
  return url;
}

function databaseUrlFor(databaseName) {
  const target = new URL(testTarget);
  target.pathname = `/${databaseName}`;
  target.searchParams.delete("schema");
  return target.toString();
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function run(command, args, environment) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repositoryRoot,
      env: { ...process.env, ...environment },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Verification command failed (${signal ?? `exit ${code ?? "unknown"}`})`));
      }
    });
  });
}

async function deployMigrations(connectionString, migrationDirectory = migrationsPath) {
  await run("pnpm", ["--filter", "@evaluation/database", "exec", "prisma", "migrate", "deploy"], {
    DATABASE_URL: connectionString,
    PRISMA_MIGRATIONS_PATH: migrationDirectory,
  });
}

async function assertNoDrift(connectionString) {
  await run(
    "pnpm",
    [
      "--filter",
      "@evaluation/database",
      "exec",
      "prisma",
      "migrate",
      "diff",
      "--from-config-datasource",
      "--to-schema",
      "prisma/schema.prisma",
      "--exit-code",
    ],
    { DATABASE_URL: connectionString, PRISMA_MIGRATIONS_PATH: migrationsPath },
  );
}

async function runIntegrationTest(connectionString) {
  await run("pnpm", ["--filter", "@evaluation/database", "test:integration"], {
    DATABASE_URL: connectionString,
    PRISMA_MIGRATIONS_PATH: migrationsPath,
    TEST_DATABASE_URL: connectionString,
  });
}

async function readSchema(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const columns = await client.query(`
      SELECT table_name, column_name, ordinal_position, data_type, udt_name,
             is_nullable, column_default, datetime_precision
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);
    const constraints = await client.query(`
      SELECT relation.relname AS table_name, constraint_record.conname AS constraint_name,
             constraint_record.contype AS constraint_type,
             pg_get_constraintdef(constraint_record.oid, true) AS definition
      FROM pg_constraint AS constraint_record
      JOIN pg_class AS relation ON relation.oid = constraint_record.conrelid
      JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
      ORDER BY relation.relname, constraint_record.conname
    `);
    const indexes = await client.query(`
      SELECT tablename AS table_name, indexname AS index_name, indexdef AS definition
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);
    return JSON.stringify({
      columns: columns.rows,
      constraints: constraints.rows,
      indexes: indexes.rows,
    });
  } finally {
    await client.end();
  }
}

async function buildPreviousMigrations(previousMigrationDirectories) {
  const target = await mkdtemp(path.join(tmpdir(), "evaluation-previous-migrations-"));
  await copyFile(
    path.join(migrationsPath, "migration_lock.toml"),
    path.join(target, "migration_lock.toml"),
  );
  for (const migrationDirectory of previousMigrationDirectories) {
    await cp(path.join(migrationsPath, migrationDirectory), path.join(target, migrationDirectory), {
      recursive: true,
    });
  }
  return target;
}

function serializedEmptySchema() {
  return JSON.stringify({ columns: [], constraints: [], indexes: [] });
}

function fail(message) {
  throw new Error(message);
}
