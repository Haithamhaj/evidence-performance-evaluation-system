import { readFile } from "node:fs/promises";

const registerPath = "docs/product/ENGINE_FEATURE_REGISTER.md";
const coveragePath = "docs/product/ai-native-frontend-capabilities.json";

const allowedStatuses = new Set(["COMPLETE", "PARTIAL", "EXTERNAL_GATE", "DEFERRED_APPROVED"]);
const allowedModes = new Set([
  "proactive_agent_assistance",
  "on_demand_ai_assistance",
  "deterministic_assistance",
  "contextual_status_recovery",
  "manual_only",
  "not_applicable",
]);
const requiredKeys = [
  "schemaVersion",
  "capabilityId",
  "officialName",
  "sourceStatus",
  "targetSurfaces",
  "deliveryPhases",
  "assistanceModes",
  "assistanceOwners",
  "triggers",
  "manualOrOperatorPath",
  "externalGate",
].sort();

function fail(message) {
  throw new Error(`AI-native frontend capability validation failed: ${message}`);
}

function normalizeStatus(rawStatus) {
  for (const status of allowedStatuses) {
    if (rawStatus.startsWith(status)) return status;
  }
  fail(`unknown source status ${JSON.stringify(rawStatus)}`);
}

function parseRegister(markdown) {
  const headings = [...markdown.matchAll(/^### (CAP-\d{3}) — (.+)$/gm)];
  return headings.map((heading, index) => {
    const start = heading.index ?? 0;
    const end = headings[index + 1]?.index ?? markdown.length;
    const section = markdown.slice(start, end);
    const status = section.match(/^\*\*Status:\*\* ([^|\n]+)/m)?.[1]?.trim();
    if (!status) fail(`missing source status for ${heading[1]}`);
    return {
      capabilityId: heading[1],
      officialName: heading[2].trim(),
      sourceStatus: normalizeStatus(status),
    };
  });
}

function assertUniqueStrings(row, field, { allowEmpty = false } = {}) {
  const values = row[field];
  if (!Array.isArray(values)) fail(`${row.capabilityId}.${field} must be an array`);
  if (!allowEmpty && values.length === 0) fail(`${row.capabilityId}.${field} must not be empty`);
  if (values.some((value) => typeof value !== "string" || value.trim() === "")) {
    fail(`${row.capabilityId}.${field} must contain non-empty strings`);
  }
  if (new Set(values).size !== values.length) fail(`${row.capabilityId}.${field} has duplicates`);
}

const [registerMarkdown, coverageJson] = await Promise.all([
  readFile(registerPath, "utf8"),
  readFile(coveragePath, "utf8"),
]);
const authoritative = parseRegister(registerMarkdown);
const records = JSON.parse(coverageJson);

if (!Array.isArray(records)) fail("coverage data must be an array");
if (authoritative.length !== 44)
  fail(`register contains ${authoritative.length} records, expected 44`);
if (records.length !== 44) fail(`coverage contains ${records.length} records, expected 44`);

const recordById = new Map();
for (const row of records) {
  if (!row || typeof row !== "object" || Array.isArray(row)) fail("every row must be an object");
  const keys = Object.keys(row).sort();
  if (JSON.stringify(keys) !== JSON.stringify(requiredKeys)) {
    fail(`${row.capabilityId ?? "unknown"} has unexpected fields: ${keys.join(", ")}`);
  }
  if (row.schemaVersion !== 1) fail(`${row.capabilityId}.schemaVersion must be 1`);
  if (!/^CAP-\d{3}$/.test(row.capabilityId)) fail(`invalid capabilityId ${row.capabilityId}`);
  if (recordById.has(row.capabilityId)) fail(`duplicate capabilityId ${row.capabilityId}`);
  if (typeof row.officialName !== "string" || row.officialName.trim() === "") {
    fail(`${row.capabilityId}.officialName is required`);
  }
  if (!allowedStatuses.has(row.sourceStatus)) fail(`${row.capabilityId} has invalid sourceStatus`);
  assertUniqueStrings(row, "targetSurfaces", { allowEmpty: row.capabilityId === "CAP-034" });
  assertUniqueStrings(row, "deliveryPhases");
  assertUniqueStrings(row, "assistanceModes");
  assertUniqueStrings(row, "assistanceOwners");
  assertUniqueStrings(row, "triggers");
  if (row.assistanceModes.some((mode) => !allowedModes.has(mode))) {
    fail(`${row.capabilityId} has an unapproved assistance mode`);
  }
  if (typeof row.manualOrOperatorPath !== "string" || row.manualOrOperatorPath.trim() === "") {
    fail(`${row.capabilityId}.manualOrOperatorPath is required`);
  }
  if (
    row.externalGate !== null &&
    (typeof row.externalGate !== "string" || !row.externalGate.trim())
  ) {
    fail(`${row.capabilityId}.externalGate must be null or a non-empty string`);
  }
  if (row.sourceStatus === "EXTERNAL_GATE" && !row.externalGate) {
    fail(`${row.capabilityId} requires an external gate`);
  }
  recordById.set(row.capabilityId, row);
}

for (const source of authoritative) {
  const row = recordById.get(source.capabilityId);
  if (!row) fail(`missing ${source.capabilityId}`);
  for (const field of ["officialName", "sourceStatus"]) {
    if (row[field] !== source[field]) {
      fail(`${source.capabilityId}.${field} does not match the engine register`);
    }
  }
}

const deferred = recordById.get("CAP-034");
if (
  deferred.targetSurfaces.length !== 0 ||
  JSON.stringify(deferred.triggers) !== JSON.stringify(["none"]) ||
  JSON.stringify(deferred.assistanceModes) !== JSON.stringify(["not_applicable"])
) {
  fail("CAP-034 must have no pilot surface/trigger and must remain not applicable");
}

const counts = Object.fromEntries([...allowedStatuses].map((status) => [status, 0]));
for (const row of records) counts[row.sourceStatus] += 1;
const expectedCounts = { COMPLETE: 39, PARTIAL: 2, EXTERNAL_GATE: 2, DEFERRED_APPROVED: 1 };
if (JSON.stringify(counts) !== JSON.stringify(expectedCounts)) {
  fail(`status counts ${JSON.stringify(counts)} do not match ${JSON.stringify(expectedCounts)}`);
}
if (coverageJson.includes('"PLANNED"')) fail("PLANNED records are prohibited");

console.log(
  `Validated ${records.length} AI-native frontend capability records: ` +
    `39 COMPLETE, 2 PARTIAL, 2 EXTERNAL_GATE, 1 DEFERRED_APPROVED.`,
);
