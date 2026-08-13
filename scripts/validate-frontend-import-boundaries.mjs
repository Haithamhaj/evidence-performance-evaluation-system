import console from "node:console";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { parseSync, traverse } from "@babel/core";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirectories = new Set([
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "storybook-static",
]);
const sourceExtensions = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const providerPackages = [
  "@anthropic-ai/sdk",
  "@azure/openai",
  "@google/generative-ai",
  "@google/genai",
  "cohere-ai",
  "groq-sdk",
  "mistralai",
  "openai",
];

function argumentValue(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

const configuredRoot = argumentValue("--root");
const scanRoot = configuredRoot ? path.resolve(repositoryRoot, configuredRoot) : repositoryRoot;

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...(await collectSourceFiles(entryPath)));
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }
  return files;
}

function normalize(value) {
  return value.split(path.sep).join("/");
}

function logicalPath(filePath) {
  return normalize(path.relative(scanRoot, filePath));
}

function resolveTarget(filePath, specifier) {
  if (specifier.startsWith("."))
    return normalize(path.relative(scanRoot, path.resolve(path.dirname(filePath), specifier)));
  if (specifier.startsWith("@/")) return `apps/web/src/${specifier.slice(2)}`;
  return specifier;
}

function literalImports(source, filePath) {
  const imports = [];
  const ast = parseSync(source, {
    filename: filePath,
    parserOpts: { plugins: ["typescript", "jsx", "dynamicImport"], sourceType: "unambiguous" },
  });

  traverse(ast, {
    CallExpression(nodePath) {
      const { node } = nodePath;
      if (node.callee.type === "Import" && node.arguments[0]?.type === "StringLiteral") {
        imports.push(node.arguments[0].value);
      }
    },
    ExportAllDeclaration(nodePath) {
      imports.push(nodePath.node.source.value);
    },
    ExportNamedDeclaration(nodePath) {
      if (nodePath.node.source) imports.push(nodePath.node.source.value);
    },
    ImportDeclaration(nodePath) {
      imports.push(nodePath.node.source.value);
    },
    ImportExpression(nodePath) {
      if (nodePath.node.source.type === "StringLiteral") imports.push(nodePath.node.source.value);
    },
  });
  return imports;
}

function featureName(filePath) {
  return filePath.match(/^apps\/web\/src\/features\/([^/]+)\//u)?.[1];
}

function isServerTarget(target) {
  return target === "apps/web/src/server" || target.startsWith("apps/web/src/server/");
}

function isTelemetryTarget(target) {
  return (
    target === "apps/web/src/platform/telemetry" ||
    target.startsWith("apps/web/src/platform/telemetry/")
  );
}

function isTelemetryContractSource(source) {
  return source.startsWith("packages/contracts/src/product-telemetry/");
}

function isProtectedExperienceContractTarget(target) {
  return (
    target.includes("packages/contracts/src/work-signals/") ||
    target.includes("packages/contracts/src/experience-events/")
  );
}

function isProtectedAuthoritySource(source) {
  return /(?:^|\/)(?:autonomy|employee-evaluation|evaluation-preparation|evaluations?|experience-orchestrator|manager|manager-evaluation|orchestration|progress|updates-evidence|evidence)(?:\/|-|$)/u.test(
    source,
  );
}

function isProtectedTelemetryTarget(specifier, target) {
  const evaluationPackage = specifier.match(/^@evaluation\/([^/]+)/u)?.[1];
  const safeTelemetryPackages = new Set(["config", "contracts", "localization", "observability"]);
  return (
    /(?:^|\/)(?:auth|credentials?|database|employee-evaluation|evaluation-preparation|manager-evaluation|permissions?|progress|secrets?|tokens?|updates-evidence)(?:\/|-|$)/u.test(
      target,
    ) ||
    (evaluationPackage !== undefined && !safeTelemetryPackages.has(evaluationPackage))
  );
}

function isProviderPackage(specifier) {
  return providerPackages.some(
    (provider) => specifier === provider || specifier.startsWith(`${provider}/`),
  );
}

function isFinalExperienceProductSource(source) {
  return /^apps\/web\/src\/(?:features|product-ui)\/(?:home|project|review|universal-capture)\//u.test(
    source,
  );
}

function isFinalExperienceProtectedTarget(specifier, target) {
  const evaluationPackage = specifier.match(/^@evaluation\/([^/]+)/u)?.[1];
  const safePackages = new Set(["contracts", "localization", "ui"]);
  return (
    /(?:^|\/)(?:auth|credentials?|database|employee-evaluation|evaluation-preparation|manager-evaluation|permissions?|persistence|prisma|repositories?|secrets?|tokens?)(?:\/|-|$)/u.test(
      target,
    ) ||
    (evaluationPackage !== undefined && !safePackages.has(evaluationPackage))
  );
}

function violationsFor(source, sourceText, specifier) {
  const target = resolveTarget(path.join(scanRoot, source), specifier);
  const violations = [];
  const sourceFeature = featureName(source);
  const targetFeature = featureName(target);

  if (sourceFeature && targetFeature && sourceFeature !== targetFeature) {
    violations.push("FRONTEND_FEATURE_INTERNAL");
  }
  if (
    source.startsWith("packages/ui/") &&
    (target.startsWith("apps/web/src/features/") ||
      target.startsWith("apps/web/src/product-ui/") ||
      (specifier.startsWith("@evaluation/") && specifier !== "@evaluation/ui"))
  ) {
    violations.push("FRONTEND_GENERIC_UI_PRODUCT");
  }
  if (source.startsWith("apps/web/src/product-ui/") && isServerTarget(target)) {
    violations.push("FRONTEND_PRODUCT_UI_SERVER");
  }
  if (/^[\s\r\n]*["']use client["'];/u.test(sourceText) && isServerTarget(target)) {
    violations.push("FRONTEND_CLIENT_SERVER");
  }
  if (
    source.startsWith("apps/web/src/app/") &&
    (specifier === "@evaluation/database" ||
      specifier.startsWith("@evaluation/database/") ||
      /(?:^|\/)(?:prisma|persistence|repositories?|database)(?:\/|$)/u.test(target))
  ) {
    violations.push("FRONTEND_ROUTE_PERSISTENCE");
  }
  if (isProtectedAuthoritySource(source) && isTelemetryTarget(target)) {
    violations.push("FRONTEND_TELEMETRY_AUTHORITY");
  }
  if (
    source.startsWith("apps/web/src/platform/telemetry/") &&
    isProtectedTelemetryTarget(specifier, target)
  ) {
    violations.push("FRONTEND_TELEMETRY_PROTECTED_IMPORT");
  }
  if (isTelemetryContractSource(source) && isProtectedExperienceContractTarget(target)) {
    violations.push("FRONTEND_TELEMETRY_PROTECTED_IMPORT");
  }
  if (!source.startsWith("packages/ai-routing/") && isProviderPackage(specifier)) {
    violations.push("BOUNDARY_DIRECT_AI_PROVIDER");
  }
  if (
    isFinalExperienceProductSource(source) &&
    isFinalExperienceProtectedTarget(specifier, target)
  ) {
    violations.push("FRONTEND_FINAL_EXPERIENCE_PROTECTED");
  }
  return violations;
}

const sourceRoots = ["apps", "packages"]
  .map((directory) => path.join(scanRoot, directory))
  .filter((directory) => directory.startsWith(scanRoot));
const files = [];
for (const sourceRoot of sourceRoots) {
  try {
    files.push(...(await collectSourceFiles(sourceRoot)));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const violations = [];
for (const filePath of files) {
  const source = logicalPath(filePath);
  const sourceText = await readFile(filePath, "utf8");
  for (const specifier of new Set(literalImports(sourceText, filePath))) {
    for (const code of violationsFor(source, sourceText, specifier)) {
      violations.push({ code, source, specifier });
    }
  }
}

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(`${violation.code}: ${violation.source} -> ${violation.specifier}`);
  }
  process.exitCode = 1;
} else {
  console.log(`FRONTEND BOUNDARIES VALID (${files.length} files)`);
}
