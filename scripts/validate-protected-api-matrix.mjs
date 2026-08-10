import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const PROTECTED_API_MATRIX = Object.freeze([
  publicRow("health", "bounded liveness/readiness only"),
  protectedRow("audit", "tests/integration/audit-authorization.integration.test.ts", "audit.query"),
  protectedRow("api/v1", "tests/integration/auth.integration.test.ts", "identity/session policy", {
    auditMode: "POLICY_DECISION",
  }),
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
    { auditTest: "packages/documents/src/template-service.integration.test.ts" },
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
    { auditTest: "packages/work-items/src/service.integration.test.ts" },
  ),
  protectedRow(
    "api/v1/private-inbox",
    "apps/api/src/work-items/private-inbox.controller.test.ts",
    "private_inbox.*",
    { auditTest: "packages/work-items/src/inbox-service.integration.test.ts" },
  ),
  protectedRow(
    "api/v1/connected-work",
    "apps/api/src/connected-work-context/connected-work-context.e2e.integration.test.ts",
    "connected_work.*",
    { auditTest: "packages/connected-work-context/src/connection-service.integration.test.ts" },
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
    { auditTest: "packages/updates-evidence/src/update-service.integration.test.ts" },
  ),
  protectedRow(
    "api/v1/timeline",
    "apps/api/src/updates-evidence/updates-evidence.e2e.integration.test.ts",
    "timeline.read",
    { auditMode: "POLICY_DECISION" },
  ),
  protectedRow(
    "api/v1/evidence",
    "apps/api/src/updates-evidence/updates-evidence.e2e.integration.test.ts",
    "evidence.*",
    { auditTest: "packages/updates-evidence/src/evidence-service.integration.test.ts" },
  ),
  protectedRow(
    "api/v1/voice-updates",
    "apps/api/src/updates-evidence/voice.controller.test.ts",
    "voice_updates.*",
    { auditTest: "packages/updates-evidence/src/voice-update-service.integration.test.ts" },
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
    { auditMode: "POLICY_DECISION" },
  ),
  protectedRow(
    "api/v1/evaluation-cycles",
    "apps/api/src/evaluation-preparation/evaluation-fact-view.e2e.integration.test.ts",
    "evaluation_facts.read",
    { auditMode: "POLICY_DECISION" },
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
    "packages/coaching-development/src/action-service.test.ts",
    "coaching.*",
    {
      denyTest: "tests/integration/coaching-development-api.integration.test.ts",
      auditTest: "packages/coaching-development/src/action-service.test.ts",
    },
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
    { auditTest: "packages/continuity/src/delegation-service.integration.test.ts" },
  ),
  protectedRow(
    "api/v1/operations",
    "tests/integration/operations-api.integration.test.ts",
    "operations.*",
  ),
]);

function protectedRow(routePrefix, evidence, auditRule, options = {}) {
  return Object.freeze({
    routePrefix,
    classification: "PROTECTED",
    allowTest: options.allowTest ?? evidence,
    denyTest: options.denyTest ?? evidence,
    auditTest: options.auditTest ?? evidence,
    auditMode: options.auditMode ?? "PERSISTED_EVENT",
    auditRule,
  });
}

function signedRow(routePrefix, evidence, auditRule) {
  return Object.freeze({
    routePrefix,
    classification: "SIGNED_EXTERNAL",
    allowTest: evidence,
    denyTest: evidence,
    auditTest: evidence,
    auditMode: "SIGNED_RECEIPT",
    auditRule,
  });
}

function publicRow(routePrefix, auditRule) {
  return Object.freeze({
    routePrefix,
    classification: "PUBLIC_BOUNDED",
    allowTest: "apps/api/src/platform/health.controller.test.ts",
    denyTest: "apps/api/src/platform/health.controller.test.ts",
    auditTest: "apps/api/src/platform/health.controller.test.ts",
    auditMode: "PUBLIC_BOUNDED",
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
  const invalidEvidence = [];
  const sourceCache = new Map();
  async function evidenceSource(path) {
    if (!sourceCache.has(path)) sourceCache.set(path, await readFile(join(root, path), "utf8"));
    return sourceCache.get(path);
  }
  for (const row of PROTECTED_API_MATRIX) {
    for (const field of ["allowTest", "denyTest", "auditTest"]) {
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
    if (missingEvidence.some((entry) => entry.startsWith(`${row.routePrefix}:`))) continue;
    const allowSource = await evidenceSource(row.allowTest);
    const denySource = await evidenceSource(row.denyTest);
    const auditSource = await evidenceSource(row.auditTest);
    if (
      !/\b(allows?|authoriz\w*|authenticat\w*|binds?|derives?|passes?|returns?|creates?|completes?|executes?|exposes?|propagates?|accepted)\b/iu.test(
        allowSource,
      )
    ) {
      invalidEvidence.push(`${row.routePrefix}:allow:${row.allowTest}`);
    }
    if (
      !/\b(denies?|rejects?|unauthenticated|inactive|forbidden|cross-[a-z]+|unsigned|does not let|does not acknowledge|never accepts)\b/iu.test(
        denySource,
      )
    ) {
      invalidEvidence.push(`${row.routePrefix}:deny:${row.denyTest}`);
    }
    const auditPattern =
      row.auditMode === "PERSISTED_EVENT"
        ? /\b(audit\w*|append(?:-only|s|ed)?|history|idempoten\w*|rolls? back)\b/iu
        : row.auditMode === "SIGNED_RECEIPT"
          ? /\b(unsigned|signed|durabl\w*|idempoten\w*)\b/iu
          : /\b(authoriz\w*|authenticat\w*|denies?|rejects?|bounded)\b/iu;
    if (!auditPattern.test(auditSource)) {
      invalidEvidence.push(`${row.routePrefix}:audit:${row.auditTest}:${row.auditMode}`);
    }
  }
  return {
    matrix: PROTECTED_API_MATRIX,
    routes,
    uncoveredProtectedRoutes,
    missingEvidence,
    invalidEvidence,
  };
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const result = await validateProtectedApiMatrix(root);
  if (
    result.uncoveredProtectedRoutes.length ||
    result.missingEvidence.length ||
    result.invalidEvidence.length
  ) {
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `Protected API matrix valid: ${result.routes.length} controllers, ${result.matrix.length} policy rows.\n`,
    );
  }
}
