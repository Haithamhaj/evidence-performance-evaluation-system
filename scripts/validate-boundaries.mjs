import console from "node:console";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoots = ["apps", "packages"];
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".fixture"]);
const ignoredDirectories = new Set([".next", ".turbo", "dist", "node_modules"]);
const webForbiddenPackages = [
  "@evaluation/database",
  "@evaluation/ai-routing",
  "ioredis",
  "redis",
  "bullmq",
  "openai",
  "@anthropic-ai/sdk",
  "@google/generative-ai",
  "@google/genai",
];
const importPattern =
  /(?:\b(?:import|export)\s+(?:[^"'`;]*?\s+from\s+)?|\bimport\s*\()\s*["']([^"']+)["']/gu;
const aiProviderPackages = [
  "openai",
  "@anthropic-ai/sdk",
  "@google/generative-ai",
  "@google/genai",
  "@azure/openai",
  "cohere-ai",
];
const directProviderRoutePattern = /(?:\/chat\/completions|\/v1\/responses|\/v1\/messages)/u;

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (ignoredDirectories.has(entry.name)) {
          return [];
        }

        return collectSourceFiles(entryPath);
      }

      return sourceExtensions.has(path.extname(entry.name)) ? [entryPath] : [];
    }),
  );

  return nestedFiles.flat();
}

function workspaceDirectory(filePath) {
  const relativePath = path.relative(repositoryRoot, filePath);
  const [category, workspace] = relativePath.split(path.sep);
  return path.join(repositoryRoot, category, workspace);
}

function inspectImport(filePath, specifier) {
  const relativeFile = path.relative(repositoryRoot, filePath);
  const packageImport = /^@evaluation\/([^/]+)(\/.+)?$/u.exec(specifier);

  if (
    relativeFile.startsWith(`apps${path.sep}web${path.sep}`) &&
    webForbiddenPackages.some(
      (packageName) => specifier === packageName || specifier.startsWith(`${packageName}/`),
    )
  ) {
    return `BOUNDARY_WEB_SERVER_IMPORT:${relativeFile}:${specifier}`;
  }

  if (
    !isAiRoutingFile(relativeFile) &&
    aiProviderPackages.some(
      (packageName) => specifier === packageName || specifier.startsWith(`${packageName}/`),
    )
  ) {
    return `BOUNDARY_DIRECT_AI_PROVIDER:${relativeFile}:${specifier}`;
  }

  if (packageImport?.[2]) {
    return `BOUNDARY_DEEP_IMPORT:${relativeFile}:${specifier}`;
  }

  if (specifier.startsWith(".")) {
    const importedPath = path.resolve(path.dirname(filePath), specifier);
    if (workspaceDirectory(importedPath) !== workspaceDirectory(filePath)) {
      return `BOUNDARY_CROSS_WORKSPACE_RELATIVE:${relativeFile}:${specifier}`;
    }
  }

  return undefined;
}

function isAiRoutingFile(relativeFile) {
  const normalized = relativeFile.split(path.sep).join("/");
  return (
    normalized.startsWith("packages/ai-routing/") || normalized.includes("/packages/ai-routing/")
  );
}

const arguments_ = process.argv.slice(2);
const rootIndex = arguments_.indexOf("--root");
const rootArgument = rootIndex < 0 ? undefined : arguments_[rootIndex + 1];
if (rootIndex >= 0 && (!rootArgument || arguments_.length !== 2)) {
  throw new Error("Usage: validate-boundaries.mjs [--root <directory>]");
}

const files = (
  await Promise.all(
    (rootArgument ? [rootArgument] : sourceRoots).map((root) =>
      collectSourceFiles(path.resolve(repositoryRoot, root)),
    ),
  )
).flat();
const violations = [];

for (const filePath of files) {
  const source = await readFile(filePath, "utf8");
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    if (!specifier) {
      continue;
    }

    const violation = inspectImport(filePath, specifier);
    if (violation) {
      violations.push(violation);
    }
  }
  if (
    !isAiRoutingFile(path.relative(repositoryRoot, filePath)) &&
    directProviderRoutePattern.test(source)
  ) {
    violations.push(
      `BOUNDARY_DIRECT_AI_PROVIDER:${path.relative(repositoryRoot, filePath)}:chat/completions`,
    );
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`BOUNDARIES VALID: ${files.length} source files`);
}
