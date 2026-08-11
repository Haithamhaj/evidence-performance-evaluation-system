import { readFile } from "node:fs/promises";

const registerPath = "docs/product/ENGINE_FEATURE_REGISTER.md";
const coveragePath = "docs/product/ai-native-frontend-capabilities.json";
const handoffPath = "docs/product/AI_NATIVE_PHASE_1_3_HANDOFFS.md";

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

function parseHandoffs(markdown) {
  const headings = [...markdown.matchAll(/^## (H-\d{3}) — (.+)$/gm)];
  const requiredFields = [
    "Assistance Mode",
    "Assistance Owner",
    "Trigger/Activation",
    "Work Signal",
    "Experience Workflow Event",
    "Product Telemetry",
    "Protected visibility",
    "Freshness requirement",
    "Inspection projection",
    "Manual fallback",
    "Recovery",
  ];

  return headings.map((heading, index) => {
    const start = heading.index ?? 0;
    const end = headings[index + 1]?.index ?? markdown.length;
    const section = markdown.slice(start, end);
    const fields = Object.fromEntries(
      requiredFields.map((field) => {
        const value = section.match(new RegExp(`^- \\*\\*${field}:\\*\\* (.+)$`, "m"))?.[1]?.trim();
        if (!value) fail(`${heading[1]} is missing ${field}`);
        return [field, value];
      }),
    );
    return { handoffId: heading[1], name: heading[2].trim(), fields };
  });
}

const [registerMarkdown, coverageJson, handoffMarkdown] = await Promise.all([
  readFile(registerPath, "utf8"),
  readFile(coveragePath, "utf8"),
  readFile(handoffPath, "utf8"),
]);
const authoritative = parseRegister(registerMarkdown);
const records = JSON.parse(coverageJson);
const handoffs = parseHandoffs(handoffMarkdown);

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

const requiredHandoffIds = Array.from(
  { length: 16 },
  (_, index) => `H-${String(index + 1).padStart(3, "0")}`,
);
if (
  JSON.stringify(handoffs.map(({ handoffId }) => handoffId)) !== JSON.stringify(requiredHandoffIds)
) {
  fail("Phase 1–3 handoffs must contain the closed H-001 through H-016 set in order");
}
for (const handoff of handoffs) {
  const { fields } = handoff;
  const usesAi =
    fields["Assistance Mode"].includes("proactive_agent_assistance") ||
    fields["Assistance Mode"].includes("on_demand_ai_assistance");
  if (usesAi && !fields["Assistance Owner"].includes("agent")) {
    fail(`${handoff.handoffId} uses AI assistance without a compatible Agent owner`);
  }
  if (!fields["Trigger/Activation"].includes("`") && fields["Trigger/Activation"] !== "none") {
    fail(`${handoff.handoffId} requires a closed trigger key or none`);
  }
  const telemetryKey = fields["Product Telemetry"].match(/`([^`]+)`/)?.[1];
  if (!telemetryKey) fail(`${handoff.handoffId} requires a closed telemetry key or none`);
  if (/readiness|rating|rank|performance/i.test(telemetryKey)) {
    fail(`${handoff.handoffId} telemetry may not contain protected performance/readiness concepts`);
  }
}

console.log(
  `Validated ${records.length} AI-native frontend capability records: ` +
    `39 COMPLETE, 2 PARTIAL, 2 EXTERNAL_GATE, 1 DEFERRED_APPROVED; ` +
    `${handoffs.length} Phase 1–3 handoffs.`,
);
