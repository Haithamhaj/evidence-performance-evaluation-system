import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import { URL } from "node:url";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const ISOLATED_DATABASE_PREFIX = "ebpes_restore_";

export function parseLocalDatabaseUrl(value, options = {}) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("database URL must be valid");
  }
  if (!new Set(["postgres:", "postgresql:"]).has(url.protocol)) {
    throw new Error("database URL must use PostgreSQL");
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error("local restore database must use a loopback host");
  }
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (!/^[a-z][a-z0-9_]{0,62}$/u.test(databaseName)) {
    throw new Error("database name is invalid");
  }
  if (options.requireIsolatedPrefix && !databaseName.startsWith(ISOLATED_DATABASE_PREFIX)) {
    throw new Error(`restore database name must start with ${ISOLATED_DATABASE_PREFIX}`);
  }
  return { databaseName, url };
}

function assertContainerName(value) {
  if (!/^[A-Za-z0-9_.-]+$/u.test(value)) throw new Error("PostgreSQL container name is invalid");
  return value;
}

export async function runContainerPostgres(container, command, input = null) {
  const safeContainer = assertContainerName(container);
  return new Promise((resolve, reject) => {
    const child = spawn(
      "docker",
      ["exec", ...(input === null ? [] : ["-i"]), "-u", "postgres", safeContainer, ...command],
      { stdio: [input === null ? "ignore" : "pipe", "pipe", "pipe"] },
    );
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      const errorText = Buffer.concat(stderr).toString("utf8").trim();
      if (code !== 0) {
        reject(new Error(`${command[0]} failed${errorText ? `: ${errorText}` : ""}`));
        return;
      }
      resolve(Buffer.concat(stdout));
    });
    if (input !== null) child.stdin.end(input);
  });
}

export async function readProtectedIntegrity(databaseUrl, postgresContainer) {
  const { databaseName } = parseLocalDatabaseUrl(databaseUrl);
  const sql = `
    SELECT json_build_object(
      'schemaVersion', 1,
      'auditEvents', (SELECT count(*)::int FROM "AuditEvent"),
      'foreignKeys', (SELECT count(*)::int FROM pg_constraint WHERE contype = 'f'),
      'unvalidatedForeignKeys', (
        SELECT count(*)::int FROM pg_constraint WHERE contype = 'f' AND NOT convalidated
      ),
      'closedEvaluations', (SELECT count(*)::int FROM "FinalEvaluationSnapshot"),
      'upwardResponses', (SELECT count(*)::int FROM "ManagerEvaluationResponse"),
      'evidenceSources', (SELECT count(*)::int FROM "EvidenceRecord"),
      'responsibilityWindows', (SELECT count(*)::int FROM "ResponsibilityWindow"),
      'delegationWindows', (SELECT count(*)::int FROM "DelegationPeriod"),
      'auditAppendOnly', EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'AuditEvent_append_only' AND NOT tgisinternal
      ),
      'closedEvaluationAppendOnly', EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'FinalEvaluationSnapshot_append_only' AND NOT tgisinternal
      ),
      'upwardResponseAppendOnly', EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'ManagerEvaluationResponse_append_only' AND NOT tgisinternal
      ),
      'evidenceAppendOnly', EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'EvidenceRevision_append_only' AND NOT tgisinternal
      )
    );
  `;
  const output = await runContainerPostgres(postgresContainer, [
    "psql",
    "--dbname",
    databaseName,
    "--set",
    "ON_ERROR_STOP=1",
    "--tuples-only",
    "--no-align",
    "--command",
    sql,
  ]);
  try {
    return JSON.parse(output.toString("utf8").trim());
  } catch {
    throw new Error("protected integrity query did not return valid JSON");
  }
}

export async function validateCustomDatabaseDump(databaseDump, postgresContainer) {
  await runContainerPostgres(postgresContainer, ["pg_restore", "--list"], databaseDump);
}

export async function createIsolatedDatabase({
  adminDatabaseUrl,
  targetDatabaseUrl,
  postgresContainer,
}) {
  const { databaseName: adminDatabaseName } = parseLocalDatabaseUrl(adminDatabaseUrl);
  const { databaseName: targetDatabaseName } = parseLocalDatabaseUrl(targetDatabaseUrl, {
    requireIsolatedPrefix: true,
  });
  const escaped = targetDatabaseName.replaceAll("'", "''");
  const existing = await runContainerPostgres(postgresContainer, [
    "psql",
    "--dbname",
    adminDatabaseName,
    "--set",
    "ON_ERROR_STOP=1",
    "--tuples-only",
    "--no-align",
    "--command",
    `SELECT count(*) FROM pg_database WHERE datname = '${escaped}';`,
  ]);
  if (existing.toString("utf8").trim() !== "0") {
    throw new Error("restore database must not already exist");
  }
  await runContainerPostgres(postgresContainer, [
    "createdb",
    "--maintenance-db",
    adminDatabaseName,
    "--template",
    "template0",
    targetDatabaseName,
  ]);
  return targetDatabaseName;
}

export async function restoreDatabaseDump({ databaseDump, targetDatabaseUrl, postgresContainer }) {
  const { databaseName } = parseLocalDatabaseUrl(targetDatabaseUrl, {
    requireIsolatedPrefix: true,
  });
  for (const section of ["pre-data", "data", "post-data"]) {
    await runContainerPostgres(
      postgresContainer,
      [
        "pg_restore",
        "--exit-on-error",
        "--no-owner",
        "--no-privileges",
        "--section",
        section,
        "--dbname",
        databaseName,
      ],
      databaseDump,
    );
  }
}
