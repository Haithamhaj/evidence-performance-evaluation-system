import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const PROTECTED_API_MATRIX = Object.freeze([
  publicRow("health", "bounded liveness/readiness only"),
  protectedRow("audit", "tests/integration/audit-authorization.integration.test.ts", "audit.query"),
  protectedRow("api/v1", "tests/integration/auth.integration.test.ts", "identity/session policy"),
  protectedRow(
    "api/v1/projects",
    "apps/api/src/projects/projects.e2e.integration.test.ts",
    "projects.*",
  ),
  protectedRow(
    "api/v1/documents",
    "apps/api/src/documents/documents.e2e.integration.test.ts",
    "documents.*",
  ),
  protectedRow(
    "api/v1/document-templates",
    "apps/api/src/documents/document-templates.controller.test.ts",
    "document_templates.*",
  ),
  protectedRow(
    "api/v1/dynamic-criteria",
    "apps/api/src/analysis-criteria/analysis-criteria.e2e.integration.test.ts",
    "criteria.*",
  ),
  protectedRow(
    "api/v1/work-items",
    "apps/api/src/work-items/work-items.controller.test.ts",
    "work_items.*",
  ),
  protectedRow(
    "api/v1/private-inbox",
    "apps/api/src/work-items/private-inbox.controller.test.ts",
    "private_inbox.*",
  ),
  protectedRow(
    "api/v1/connected-work",
    "apps/api/src/connected-work-context/connected-work-context.e2e.integration.test.ts",
    "connected_work.*",
  ),
  protectedRow(
    "api/v1/context",
    "apps/api/src/context-intelligence/context-intelligence.e2e.integration.test.ts",
    "context_intelligence.*",
  ),
  protectedRow(
    "api/v1/updates",
    "apps/api/src/updates-evidence/updates-evidence.e2e.integration.test.ts",
    "updates.*",
  ),
  protectedRow(
    "api/v1/timeline",
    "apps/api/src/updates-evidence/updates-evidence.e2e.integration.test.ts",
    "timeline.read",
  ),
  protectedRow(
    "api/v1/evidence",
    "apps/api/src/updates-evidence/updates-evidence.e2e.integration.test.ts",
    "evidence.*",
  ),
  protectedRow(
    "api/v1/voice-updates",
    "apps/api/src/updates-evidence/voice.controller.test.ts",
    "voice_updates.*",
  ),
  signedRow(
    "api/v1/github",
    "apps/api/src/github-integration/github-integration.e2e.integration.test.ts",
    "github.webhook.received",
  ),
  protectedRow(
    "api/v1/daily-work",
    "apps/api/src/daily-work/daily-work.e2e.integration.test.ts",
    "daily_work.*",
  ),
  protectedRow(
    "api/v1/evaluation-cycles",
    "apps/api/src/evaluation-preparation/evaluation-fact-view.e2e.integration.test.ts",
    "evaluation_facts.read",
  ),
  protectedRow(
    "api/v1/employee-evaluation",
    "tests/integration/employee-evaluation-api.integration.test.ts",
    "employee_evaluation.*",
  ),
  protectedRow(
    "api/v1/manager-evaluation",
    "tests/integration/manager-evaluation-api.integration.test.ts",
    "manager_evaluation.*",
  ),
  protectedRow(
    "api/v1/coaching",
    "tests/integration/coaching-development-api.integration.test.ts",
    "coaching.*",
  ),
  protectedRow(
    "api/v1/research",
    "apps/api/src/research-experiments/research-experiments.e2e.integration.test.ts",
    "research.*",
  ),
  protectedRow(
    "api/v1/experiments",
    "apps/api/src/research-experiments/research-experiments.e2e.integration.test.ts",
    "experiments.*",
  ),
  protectedRow(
    "api/v1/continuity",
    "tests/integration/continuity-api.integration.test.ts",
    "continuity.*",
  ),
  protectedRow(
    "api/v1/operations",
    "tests/integration/operations-api.integration.test.ts",
    "operations.*",
  ),
]);

function protectedRow(routePrefix, evidence, auditRule) {
  return Object.freeze({
    routePrefix,
    classification: "PROTECTED",
    allowTest: evidence,
    denyTest: evidence,
    auditRule,
  });
}

function signedRow(routePrefix, evidence, auditRule) {
  return Object.freeze({
    routePrefix,
    classification: "SIGNED_EXTERNAL",
    allowTest: evidence,
    denyTest: evidence,
    auditRule,
  });
}

function publicRow(routePrefix, auditRule) {
  return Object.freeze({
    routePrefix,
    classification: "PUBLIC_BOUNDED",
    allowTest: "apps/api/src/platform/health.controller.test.ts",
    denyTest: "apps/api/src/platform/health.controller.test.ts",
    auditRule,
  });
}

async function walk(directory) {
  const entries = await readdir(directory);
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry);
    if ((await stat(path)).isDirectory()) files.push(...(await walk(path)));
    else if (entry.endsWith(".controller.ts") && !entry.endsWith(".test.ts")) files.push(path);
  }
  return files;
}

async function registeredControllerRoutes(root) {
  const controllerRoot = join(root, "apps/api/src");
  const routes = [];
  for (const file of await walk(controllerRoot)) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(/Controller\(\s*["']([^"']+)["']\s*\)/gu)) {
      routes.push({ route: match[1], file: relative(root, file) });
    }
  }
  return routes;
}

function matchesPrefix(route, prefix) {
  if (prefix === "api/v1") return route === prefix;
  return route === prefix || route.startsWith(`${prefix}/`);
}

export async function validateProtectedApiMatrix(root) {
  const routes = await registeredControllerRoutes(root);
  const uncoveredProtectedRoutes = routes.filter(
    ({ route }) =>
      !PROTECTED_API_MATRIX.some(({ routePrefix }) => matchesPrefix(route, routePrefix)),
  );
  const missingEvidence = [];
  for (const row of PROTECTED_API_MATRIX) {
    for (const field of ["allowTest", "denyTest"]) {
      if (!row[field]) {
        missingEvidence.push(`${row.routePrefix}:${field}`);
        continue;
      }
      try {
        await stat(join(root, row[field]));
      } catch {
        missingEvidence.push(`${row.routePrefix}:${field}:${row[field]}`);
      }
    }
    if (!row.auditRule) missingEvidence.push(`${row.routePrefix}:auditRule`);
  }
  return {
    matrix: PROTECTED_API_MATRIX,
    routes,
    uncoveredProtectedRoutes,
    missingEvidence,
  };
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const result = await validateProtectedApiMatrix(root);
  if (result.uncoveredProtectedRoutes.length || result.missingEvidence.length) {
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `Protected API matrix valid: ${result.routes.length} controllers, ${result.matrix.length} policy rows.\n`,
    );
  }
}
