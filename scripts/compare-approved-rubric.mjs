import console from "node:console";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { extractApprovedRubric } from "./extract-approved-rubric.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function compareApprovedRubric() {
  const [source, committed] = await Promise.all([
    readFile(path.join(repositoryRoot, "docs/EVALUATION_RUBRIC.md"), "utf8"),
    readFile(path.join(repositoryRoot, "packages/localization/src/rubric/v1.en.json"), "utf8"),
  ]);
  const expected = extractApprovedRubric(source);
  const actual = JSON.parse(committed);
  return JSON.stringify(expected) === JSON.stringify(actual)
    ? []
    : ["packages/localization/src/rubric/v1.en.json differs from the approved source"];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const differences = await compareApprovedRubric();
  if (differences.length > 0) {
    console.error(differences.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("APPROVED RUBRIC MATCH: zero differences");
  }
}
