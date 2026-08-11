/* global console, process */

import { readdir, readFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const routesDirectory = "apps/web/src/app/[locale]";
const ledgerPath = "docs/product/ai-native-route-retirement-ledger.json";
const capabilityRegisterPath = "docs/product/ai-native-frontend-capabilities.json";
const requiredKeys = [
  "capabilityIds",
  "currentRoute",
  "disposition",
  "parityEvidenceRequired",
  "purpose",
  "removalApproval",
  "rollback",
  "schemaVersion",
  "targetPhase",
  "targetSurface",
];
const allowedDispositions = new Set(["RETAIN", "REPLACE_AFTER_PARITY", "PERMANENT"]);

function fail(message) {
  throw new Error(`AI-native route retirement ledger validation failed: ${message}`);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

async function collectPageFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = `${directory}/${entry.name}`;
      if (entry.isDirectory()) return collectPageFiles(entryPath);
      return entry.isFile() && entry.name === "page.tsx" ? [entryPath] : [];
    }),
  );
  return nested.flat();
}

export async function currentLocaleRoutes() {
  const pageFiles = await collectPageFiles(routesDirectory);
  return pageFiles
    .map((pageFile) => {
      const routeDirectory = dirname(relative(routesDirectory, pageFile));
      return routeDirectory === "." ? "/" : `/${routeDirectory}`;
    })
    .sort();
}

export function validateRouteRetirementLedger({ routes, capabilityIds, ledger }) {
  if (!Array.isArray(routes) || routes.some((route) => !hasText(route))) {
    fail("current routes must be non-empty route strings");
  }
  if (!(capabilityIds instanceof Set) || [...capabilityIds].some((id) => !/^CAP-\d{3}$/.test(id))) {
    fail("capability IDs must be a set of engine capability IDs");
  }
  if (!Array.isArray(ledger)) fail("ledger must be an array");

  const listedRoutes = new Set();
  for (const record of ledger) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      fail("each ledger record must be an object");
    }
    const keys = Object.keys(record).sort();
    if (JSON.stringify(keys) !== JSON.stringify(requiredKeys)) {
      fail(`ledger record has unexpected fields: ${keys.join(", ")}`);
    }
    if (record.schemaVersion !== 1) fail(`${record.currentRoute} must use schemaVersion 1`);
    if (!hasText(record.currentRoute) || !record.currentRoute.startsWith("/")) {
      fail("ledger record requires a current route");
    }
    if (listedRoutes.has(record.currentRoute)) fail(`duplicate route ${record.currentRoute}`);
    listedRoutes.add(record.currentRoute);
    for (const field of [
      "purpose",
      "targetPhase",
      "targetSurface",
      "parityEvidenceRequired",
      "removalApproval",
      "rollback",
    ]) {
      if (!hasText(record[field])) fail(`${record.currentRoute}.${field} is required`);
    }
    if (!Array.isArray(record.capabilityIds) || record.capabilityIds.length === 0) {
      fail(`${record.currentRoute} must contain a capability link`);
    }
    if (
      record.capabilityIds.some(
        (capabilityId) => !hasText(capabilityId) || !capabilityIds.has(capabilityId),
      )
    ) {
      fail(`${record.currentRoute} contains a missing capability link`);
    }
    if (record.disposition === "REMOVE") {
      fail(`${record.currentRoute} has a premature REMOVE disposition`);
    }
    if (!allowedDispositions.has(record.disposition)) {
      fail(`${record.currentRoute} has an invalid disposition`);
    }
  }

  for (const route of routes) {
    if (!listedRoutes.has(route)) fail(`unlisted current route ${route}`);
  }
  for (const route of listedRoutes) {
    if (!routes.includes(route)) fail(`ledger route ${route} is not a current route`);
  }
}

async function validateRepositoryLedger() {
  const [routes, ledgerJson, capabilityJson] = await Promise.all([
    currentLocaleRoutes(),
    readFile(ledgerPath, "utf8"),
    readFile(capabilityRegisterPath, "utf8"),
  ]);
  const ledger = JSON.parse(ledgerJson);
  const capabilities = JSON.parse(capabilityJson);
  const capabilityIds = new Set(capabilities.map(({ capabilityId }) => capabilityId));
  validateRouteRetirementLedger({ routes, capabilityIds, ledger });
  console.log(
    `Validated ${ledger.length} route retirement records for ${routes.length} current routes.`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await validateRepositoryLedger();
}
