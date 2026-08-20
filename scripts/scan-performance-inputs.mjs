import console from "node:console";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const forbiddenFields = [
  "commitCount",
  "pullRequestCount",
  "checkCount",
  "activityCount",
  "projectCount",
  "taskCount",
  "productivityScore",
  "employeeRank",
  "suggestedRating",
  "predictedRating",
  "recommendedRating",
];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".fixture"]);
const ignoredDirectories = new Set([".next", ".turbo", "dist", "generated", "node_modules"]);
const maintainedSchemaPaths = ["tests/ai-evals/schemas.ts"];

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return ignoredDirectories.has(entry.name) ? [] : collect(target);
      if (/\.test\.[cm]?[jt]sx?$/u.test(entry.name)) return [];
      return sourceExtensions.has(path.extname(entry.name)) ? [target] : [];
    }),
  );
  return files.flat();
}

async function main() {
  const arguments_ = process.argv.slice(2);
  const rootIndex = arguments_.indexOf("--root");
  const rootArgument = rootIndex < 0 ? undefined : arguments_[rootIndex + 1];
  if (rootIndex >= 0 && (!rootArgument || arguments_.length !== 2)) {
    throw new Error("Usage: scan-performance-inputs.mjs [files...] | --root <directory>");
  }
  const explicit =
    rootIndex < 0 ? arguments_.map((entry) => path.resolve(repositoryRoot, entry)) : [];
  const scanRoots = rootArgument
    ? [path.resolve(repositoryRoot, rootArgument)]
    : ["apps", "packages"].map((root) => path.join(repositoryRoot, root));
  const files =
    explicit.length > 0
      ? explicit
      : [
          ...(await Promise.all(scanRoots.map((root) => collect(root)))).flat(),
          ...maintainedSchemaPaths.map((entry) => path.resolve(repositoryRoot, entry)),
        ];
  const violations = [];
  for (const file of files) {
    const content = await readFile(file, "utf8");
    const performanceContext =
      explicit.length > 0 ||
      /(?:performance|rating|evaluation)/iu.test(path.relative(repositoryRoot, file)) ||
      /PerformanceRating/u.test(content) ||
      ["criterionId", "rating", "evidenceReferences"].every((field) =>
        new RegExp(`\\b${field}\\b`, "u").test(content),
      );
    if (!performanceContext) continue;
    for (const field of forbiddenFields) {
      if (new RegExp(`\\b${field}\\b`, "u").test(content)) {
        violations.push(`${path.relative(repositoryRoot, file)}:${field}`);
      }
    }
  }
  if (violations.length > 0) {
    console.error(violations.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`PERFORMANCE INPUTS VALID: ${files.length} files inspected`);
  }
}

await main();
