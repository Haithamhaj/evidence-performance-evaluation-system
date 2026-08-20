/* global console */

import { readFile } from "node:fs/promises";

const path = "docs/product/ai-native-event-taxonomy.json";
const taxonomy = JSON.parse(await readFile(path, "utf8"));

function fail(message) {
  throw new Error(`AI-native event taxonomy validation failed: ${message}`);
}

if (taxonomy.schemaVersion !== 1) fail("schemaVersion must be 1");
if (taxonomy.status !== "phase_1_runtime_active") fail("taxonomy runtime status is not current");
if (taxonomy.unknownWorkSignalPolicy !== "fail_closed")
  fail("unknown Work Signals must fail closed");
if (taxonomy.telemetryCollectionEnabled !== false)
  fail("telemetry collection must remain disabled");

const workClasses = new Set(["domain", "connector", "scheduled_work_check", "user_domain_action"]);
const requiredWorkflowKeys = new Set([
  "experience.confirm",
  "experience.correct",
  "experience.dismiss",
  "experience.retry",
  "experience.submit",
  "experience.recovery",
]);
const forbiddenInteractionFragments = [
  "page.viewed",
  "drawer.opened",
  "hover",
  "scroll",
  "dwell",
  "active_time",
  "search_focus",
];
const forbiddenTelemetryFragments = [
  "rating",
  "readiness",
  "performance_score",
  "employee_rank",
  "private_source_url",
  "prompt",
  "model_output",
];
const forbiddenDestinations = new Set([
  "experience_orchestrator",
  "autonomy_policy",
  "project_progress",
  "evidence_fact",
  "evaluation",
  "manager_decision",
  "protected_command",
]);

function assertUniqueKeys(rows, label) {
  if (!Array.isArray(rows) || rows.length === 0) fail(`${label} must be a non-empty array`);
  const keys = rows.map(({ key }) => key);
  if (keys.some((key) => typeof key !== "string" || !key)) fail(`${label} contains an invalid key`);
  if (new Set(keys).size !== keys.length) fail(`${label} contains duplicate keys`);
  return keys;
}

const workSignalKeys = assertUniqueKeys(taxonomy.workSignals, "workSignals");
const workflowKeys = assertUniqueKeys(
  taxonomy.experienceWorkflowEvents,
  "experienceWorkflowEvents",
);
const telemetryKeys = assertUniqueKeys(
  taxonomy.productTelemetryEligible,
  "productTelemetryEligible",
);

for (const signal of taxonomy.workSignals) {
  if (!workClasses.has(signal.class)) fail(`${signal.key} has an invalid Work Signal class`);
  if (!signal.dedupeKey || !signal.freshness || !signal.meaning)
    fail(`${signal.key} lacks meaning/dedupe/freshness`);
}
for (const forbidden of forbiddenInteractionFragments) {
  if (workSignalKeys.some((key) => key.includes(forbidden)))
    fail(`${forbidden} cannot be a Work Signal`);
}
if (
  workflowKeys.length !== requiredWorkflowKeys.size ||
  workflowKeys.some((key) => !requiredWorkflowKeys.has(key))
) {
  fail("Experience Workflow Event registry is not the approved closed set");
}
for (const event of taxonomy.experienceWorkflowEvents) {
  if (
    !event.meaning ||
    !Array.isArray(event.mutationRequirements) ||
    event.mutationRequirements.length === 0
  ) {
    fail(`${event.key} lacks meaning or mutation requirements`);
  }
}
for (const event of taxonomy.productTelemetryEligible) {
  if (!event.purpose || !Array.isArray(event.allowedData) || event.allowedData.length === 0) {
    fail(`${event.key} lacks purpose or an allowed-data list`);
  }
  const serialized = JSON.stringify(event).toLowerCase();
  for (const forbidden of forbiddenTelemetryFragments) {
    if (serialized.includes(forbidden))
      fail(`${event.key} contains forbidden telemetry concept ${forbidden}`);
  }
}
const allKeys = [...workSignalKeys, ...workflowKeys, ...telemetryKeys];
if (new Set(allKeys).size !== allKeys.length) fail("event keys overlap across registries");

for (const destination of taxonomy.telemetryDestinations) {
  if (forbiddenDestinations.has(destination))
    fail(`telemetry destination ${destination} is forbidden`);
}
for (const destination of forbiddenDestinations) {
  if (!taxonomy.forbiddenTelemetry.destinations.includes(destination)) {
    fail(`forbidden telemetry destination ${destination} is not documented`);
  }
}

console.log(
  `Validated event separation: ${workSignalKeys.length} Work Signals, ` +
    `${workflowKeys.length} Experience Workflow Events, ${telemetryKeys.length} telemetry-eligible keys; collection disabled.`,
);
