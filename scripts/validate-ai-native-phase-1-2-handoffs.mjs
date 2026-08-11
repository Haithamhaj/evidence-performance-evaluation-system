/* global console */

import { access, readFile } from "node:fs/promises";
import process from "node:process";

const handoffPath = process.argv[2] ?? "docs/product/ai-native-phase-1-2-handoffs.json";
const capabilityPath = process.argv[3] ?? "docs/product/ai-native-frontend-capabilities.json";
const taxonomyPath = "docs/product/ai-native-event-taxonomy.json";
const [records, capabilities, taxonomy] = await Promise.all(
  [handoffPath, capabilityPath, taxonomyPath].map(async (path) =>
    JSON.parse(await readFile(path, "utf8")),
  ),
);

const allowedModes = new Set([
  "proactive_agent_assistance",
  "on_demand_ai_assistance",
  "deterministic_assistance",
  "contextual_status_recovery",
  "manual_only",
  "not_applicable",
]);
const allowedStates = new Set([
  "loading",
  "ready",
  "empty",
  "draft",
  "pending",
  "confirmed",
  "stale",
  "error",
  "blocked",
  "completed",
]);
const allowedSseDispositions = new Set(["NONE", "PHASE_1", "PHASE_2"]);
const forbiddenOutput = /rating|rank|productivity|readiness(?:percentage|percent|value|score)/iu;
const expectedStatusCounts = {
  COMPLETE: 39,
  PARTIAL: 2,
  EXTERNAL_GATE: 2,
  DEFERRED_APPROVED: 1,
};
const authoritativeApiPaths = new Map([
  ["ConnectedWorkContextQueryService.review", "GET /api/v1/connected-work/items"],
  [
    "ConnectedWorkConnectionService.linkProject",
    "PUT /api/v1/connected-work/items/:id/project-link",
  ],
  [
    "ConnectedWorkConnectionService.unlinkProject",
    "DELETE /api/v1/connected-work/items/:id/project-link",
  ],
]);

function fail(message) {
  throw new Error(`AI-native Phase 1–2 handoff validation failed: ${message}`);
}

function nonEmptyStrings(value, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    fail(`${label} must be ${allowEmpty ? "an" : "a non-empty"} array`);
  }
  if (value.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
    fail(`${label} must contain non-empty strings`);
  }
  if (new Set(value).size !== value.length) fail(`${label} contains duplicates`);
  return value;
}

if (!Array.isArray(records) || records.length === 0) {
  fail("handoffs must be a non-empty array");
}
if (!Array.isArray(capabilities) || capabilities.length !== 44) {
  fail("capability register must contain exactly 44 rows");
}

const statusCounts = Object.fromEntries(Object.keys(expectedStatusCounts).map((key) => [key, 0]));
const capabilityIds = new Set();
for (const capability of capabilities) {
  if (capabilityIds.has(capability.capabilityId))
    fail(`duplicate capability ${capability.capabilityId}`);
  capabilityIds.add(capability.capabilityId);
  if (!(capability.sourceStatus in statusCounts))
    fail(`unknown capability status ${capability.sourceStatus}`);
  statusCounts[capability.sourceStatus] += 1;
}
if (JSON.stringify(statusCounts) !== JSON.stringify(expectedStatusCounts)) {
  fail(
    `status counts ${JSON.stringify(statusCounts)} do not match ${JSON.stringify(expectedStatusCounts)}`,
  );
}

const workSignalKeys = new Set(taxonomy.workSignals.map(({ key }) => key));
const workflowEventKeys = new Set(taxonomy.experienceWorkflowEvents.map(({ key }) => key));
const handoffIds = new Set();

for (const record of records) {
  if (record.schemaVersion !== 1) fail(`${record.handoffId ?? "unknown"}.schemaVersion must be 1`);
  if (typeof record.handoffId !== "string" || !/^P[12]-[A-Z0-9-]+$/u.test(record.handoffId)) {
    fail(`invalid handoffId ${record.handoffId}`);
  }
  if (handoffIds.has(record.handoffId)) fail(`duplicate handoffId ${record.handoffId}`);
  handoffIds.add(record.handoffId);
  if (!new Set(["P1", "P2"]).has(record.phase)) fail(`${record.handoffId} must target P1 or P2`);
  if (typeof record.surface !== "string" || record.surface.trim() === "") {
    fail(`${record.handoffId}.surface is required`);
  }
  for (const capabilityId of nonEmptyStrings(
    record.capabilityIds,
    `${record.handoffId}.capabilityIds`,
  )) {
    if (!capabilityIds.has(capabilityId))
      fail(`${record.handoffId} has unknown capability ${capabilityId}`);
  }
  for (const mode of nonEmptyStrings(
    record.assistanceModes,
    `${record.handoffId}.assistanceModes`,
  )) {
    if (!allowedModes.has(mode)) fail(`${record.handoffId} has unapproved assistance mode ${mode}`);
  }

  if (!record.reader || !new Set(["EXISTING", "NONE"]).has(record.reader.kind)) {
    fail(`${record.handoffId}.reader requires EXISTING or NONE disposition`);
  }
  if (record.reader.kind === "EXISTING") {
    for (const field of ["owner", "symbol", "path", "apiPath"]) {
      if (typeof record.reader[field] !== "string" || record.reader[field].trim() === "") {
        fail(`${record.handoffId}.reader.${field} is required`);
      }
    }
    await access(record.reader.path);
    const authoritativePath = authoritativeApiPaths.get(record.reader.symbol);
    if (authoritativePath !== undefined && record.reader.apiPath !== authoritativePath) {
      fail(`${record.handoffId}.reader.apiPath must be ${authoritativePath}`);
    }
  } else if (
    typeof record.reader.reason !== "string" ||
    !record.reader.reason.trim() ||
    typeof record.reader.requiredDelta !== "string" ||
    !record.reader.requiredDelta.trim()
  ) {
    fail(`${record.handoffId}.reader NONE disposition requires reason and requiredDelta`);
  }

  if (!Array.isArray(record.commands)) fail(`${record.handoffId}.commands must be an array`);
  for (const [index, command] of record.commands.entries()) {
    const label = `${record.handoffId}.commands[${index}]`;
    for (const field of ["owner", "symbol", "path", "apiPath"]) {
      if (typeof command[field] !== "string" || command[field].trim() === "") {
        fail(`${label}.${field} is required`);
      }
    }
    if (
      typeof command.permission !== "string" ||
      !command.permission.trim() ||
      !Array.isArray(command.negativeTests) ||
      command.negativeTests.length === 0
    ) {
      fail(`${label} requires permission and negative tests`);
    }
    nonEmptyStrings(command.positiveTests, `${label}.positiveTests`);
    nonEmptyStrings(command.negativeTests, `${label}.negativeTests`);
    await access(command.path);
    const authoritativePath = authoritativeApiPaths.get(command.symbol);
    if (authoritativePath !== undefined && command.apiPath !== authoritativePath) {
      fail(`${label}.apiPath must be ${authoritativePath}`);
    }
    for (const testPath of [...command.positiveTests, ...command.negativeTests])
      await access(testPath);
  }

  for (const state of nonEmptyStrings(record.states, `${record.handoffId}.states`)) {
    if (!allowedStates.has(state)) fail(`${record.handoffId} has unknown state ${state}`);
  }
  for (const key of nonEmptyStrings(record.workSignals, `${record.handoffId}.workSignals`, {
    allowEmpty: true,
  })) {
    if (!workSignalKeys.has(key)) fail(`${record.handoffId} has unknown Work Signal ${key}`);
  }
  for (const key of nonEmptyStrings(
    record.experienceEvents,
    `${record.handoffId}.experienceEvents`,
    {
      allowEmpty: true,
    },
  )) {
    if (!workflowEventKeys.has(key))
      fail(`${record.handoffId} has unknown Experience Event ${key}`);
  }
  if (!record.sse || !allowedSseDispositions.has(record.sse.disposition)) {
    fail(`${record.handoffId} cannot implement production SSE in Phase 0B`);
  }
  if (typeof record.sse.reason !== "string" || !record.sse.reason.trim()) {
    fail(`${record.handoffId}.sse requires a reason`);
  }
  for (const field of nonEmptyStrings(record.outputFields, `${record.handoffId}.outputFields`)) {
    if (forbiddenOutput.test(field))
      fail(`${record.handoffId} has protected output field ${field}`);
  }
  if (!record.tests || typeof record.tests !== "object")
    fail(`${record.handoffId}.tests is required`);
  const positiveTests = nonEmptyStrings(
    record.tests.positive,
    `${record.handoffId}.tests.positive`,
  );
  const negativeTests = nonEmptyStrings(
    record.tests.negative,
    `${record.handoffId}.tests.negative`,
  );
  for (const testPath of [...positiveTests, ...negativeTests]) {
    await access(testPath);
  }
  if (typeof record.rollback !== "string" || record.rollback.trim() === "") {
    fail(`${record.handoffId}.rollback is required`);
  }
}

console.log(`Validated ${records.length} exact AI-native Phase 1–2 implementation handoffs.`);
