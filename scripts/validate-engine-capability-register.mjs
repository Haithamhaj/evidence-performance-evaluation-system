import console from "node:console";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { URL } from "node:url";

const registerPath = new URL("../docs/product/ENGINE_FEATURE_REGISTER.md", import.meta.url);
const source = await readFile(registerPath, "utf8");
const blocks = source.split(/^### (?=CAP-\d{3} — )/m).slice(1);
const allowedStates = ["COMPLETE", "PARTIAL", "EXTERNAL_GATE", "DEFERRED_APPROVED", "SUPERSEDED"];
const requiredFields = [
  "**ID:**",
  "**Authoritative sources:**",
  "**Owner module:**",
  "**Human gate:**",
  "**Public API/events:**",
  "**Authorization/privacy:**",
  "**Audit/history:**",
  "**Failure/recovery:**",
  "**Tests:**",
  "**Status:**",
  "**Frontend implications:**",
];

const errors = [];
if (blocks.length !== 44) {
  errors.push(`expected 44 capability records, found ${blocks.length}`);
}

const ids = new Set();
const counts = new Map(allowedStates.map((state) => [state, 0]));

for (const block of blocks) {
  const id = block.match(/^(CAP-\d{3}) — /)?.[1] ?? "UNKNOWN";
  if (ids.has(id)) errors.push(`${id}: duplicate capability ID`);
  ids.add(id);

  for (const field of requiredFields) {
    if (!block.includes(field)) errors.push(`${id}: missing ${field}`);
  }

  const statusText = block.match(/\*\*Status:\*\* ([^|\n]+)/)?.[1]?.trim() ?? "";
  const state = allowedStates.find(
    (candidate) => statusText === candidate || statusText.startsWith(`${candidate} `),
  );
  if (!state) errors.push(`${id}: invalid or missing final state '${statusText}'`);
  else counts.set(state, (counts.get(state) ?? 0) + 1);

  if (statusText.startsWith("PLANNED")) errors.push(`${id}: PLANNED is not an E7 exit state`);
  if (state === "PARTIAL" && !/approved|T016|frontend|launch/i.test(block)) {
    errors.push(`${id}: PARTIAL requires an explicit approved gate or exclusion`);
  }
  if (state === "EXTERNAL_GATE" && /\*\*External gate:\*\* none\b/i.test(block)) {
    errors.push(`${id}: EXTERNAL_GATE requires a named external dependency`);
  }
}

if (errors.length > 0) {
  console.error(`ENGINE CAPABILITY REGISTER INVALID\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log(
  `ENGINE CAPABILITY REGISTER VALID: ${blocks.length} capabilities; ${allowedStates
    .map((state) => `${state}=${counts.get(state) ?? 0}`)
    .join(", ")}`,
);
