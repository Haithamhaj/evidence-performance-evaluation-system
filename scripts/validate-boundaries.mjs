import console from "node:console";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseSync } from "@babel/core";

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
  /(?:\b(?:import|export)\s+(?:[^"'`;]*?\s+from\s+)?|\bimport\s*\(|\brequire\s*\()\s*["']([^"']+)["']/gu;
const aiProviderPackages = [
  "openai",
  "@anthropic-ai/sdk",
  "@google/generative-ai",
  "@google/genai",
  "@azure/openai",
  "cohere-ai",
];
const directProviderRoutePattern = /(?:\/chat\/completions|\/v1\/responses|\/v1\/messages)/u;
const splitProviderRoutePattern =
  /(?:["']chat["'][\s\S]{0,100}["']completions["']|["']v1["'][\s\S]{0,100}["'](?:responses|messages)["'])/u;
const directAdapterGeneratePattern = /\.\s*generate\s*\(/u;
const publicAdapterPattern = /\b(?:FakeAiProviderAdapter|OpenAiCompatibleAdapter)\b/u;
const restrictedAiComposition = "@evaluation/ai-routing/admin-composition";
const protectedAiCompositionFile = "apps/api/src/ai-routing/ai-routing.module.ts";
const providerEnvironmentPattern =
  /(?:^|_)(?:AI|OPENAI|ANTHROPIC|AZURE_OPENAI|COHERE|MODEL_PROVIDER)(?:_|$)/u;

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
  const normalizedFile = relativeFile.split(path.sep).join("/");
  const packageImport = /^@evaluation\/([^/]+)(\/.+)?$/u.exec(specifier);

  if (specifier === restrictedAiComposition) {
    return normalizedFile === protectedAiCompositionFile
      ? undefined
      : `BOUNDARY_RESTRICTED_AI_COMPOSITION:${relativeFile}:${specifier}`;
  }

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

function staticString(node, bindings) {
  if (node?.type === "StringLiteral") return node.value;
  if (node?.type === "Identifier") return bindings.get(node.name);
  if (node?.type === "ParenthesizedExpression") return staticString(node.expression, bindings);
  if (node?.type === "BinaryExpression" && node.operator === "+") {
    const left = staticString(node.left, bindings);
    const right = staticString(node.right, bindings);
    return left === undefined || right === undefined ? undefined : `${left}${right}`;
  }
  if (node?.type === "TemplateLiteral") {
    let value = node.quasis[0]?.value.cooked ?? "";
    for (let index = 0; index < node.expressions.length; index += 1) {
      const expression = staticString(node.expressions[index], bindings);
      if (expression === undefined) return undefined;
      value += expression + (node.quasis[index + 1]?.value.cooked ?? "");
    }
    return value;
  }
  if (
    node?.type === "CallExpression" &&
    node.callee?.type === "MemberExpression" &&
    propertyName(node.callee, bindings) === "join" &&
    node.callee.object?.type === "ArrayExpression"
  ) {
    const separator = node.arguments[0] ? staticString(node.arguments[0], bindings) : ",";
    const items = node.callee.object.elements.map((element) => staticString(element, bindings));
    if (separator === undefined || items.some((item) => item === undefined)) return undefined;
    return items.join(separator);
  }
  return undefined;
}

function propertyName(expression, bindings) {
  if (expression?.type !== "MemberExpression") return undefined;
  if (!expression.computed && expression.property?.type === "Identifier") {
    return expression.property.name;
  }
  return staticString(expression.property, bindings);
}

function memberPath(node) {
  if (node?.type === "Identifier") return node.name;
  if (node?.type !== "MemberExpression") return undefined;
  const parent = memberPath(node.object);
  const child = !node.computed
    ? node.property?.name
    : node.property?.type === "StringLiteral"
      ? node.property.value
      : undefined;
  return parent === undefined || child === undefined ? undefined : `${parent}.${child}`;
}

function childrenOf(node) {
  if (node === null || typeof node !== "object") return [];
  return Object.entries(node)
    .filter(
      ([key]) => !["loc", "start", "end", "leadingComments", "trailingComments"].includes(key),
    )
    .flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
    .filter((value) => value !== null && typeof value === "object");
}

function walk(node, visit) {
  if (node === null || typeof node !== "object") return;
  visit(node);
  for (const child of childrenOf(node)) walk(child, visit);
}

function containsProviderEnvironment(node, taintedBindings) {
  let found = false;
  walk(node, (candidate) => {
    if (candidate.type === "Identifier" && taintedBindings.has(candidate.name)) found = true;
    const pathValue = memberPath(candidate);
    if (pathValue?.startsWith("process.env.")) {
      const name = pathValue.slice("process.env.".length);
      if (providerEnvironmentPattern.test(name)) found = true;
    }
  });
  return found;
}

function inspectAst(filePath, source) {
  const relativeFile = path.relative(repositoryRoot, filePath);
  if (isAiRoutingFile(relativeFile)) return [];
  const sourceFile = parseSync(source, {
    filename: filePath,
    configFile: false,
    babelrc: false,
    parserOpts: { sourceType: "module", plugins: ["typescript", "jsx"] },
  });
  if (sourceFile === null) return [];
  const bindings = new Map();
  const taintedBindings = new Set();
  const generateAliases = new Set();
  const declarations = [];

  walk(sourceFile, (node) => {
    if (node.type === "VariableDeclarator") declarations.push(node);
  });

  for (let pass = 0; pass < declarations.length + 1; pass += 1) {
    let changed = false;
    for (const declaration of declarations) {
      if (declaration.id?.type !== "Identifier" || !declaration.init) continue;
      const value = staticString(declaration.init, bindings);
      if (value !== undefined && bindings.get(declaration.id.name) !== value) {
        bindings.set(declaration.id.name, value);
        changed = true;
      }
      if (
        containsProviderEnvironment(declaration.init, taintedBindings) &&
        !taintedBindings.has(declaration.id.name)
      ) {
        taintedBindings.add(declaration.id.name);
        changed = true;
      }
      if (
        declaration.init.type === "MemberExpression" &&
        propertyName(declaration.init, bindings) === "generate"
      ) {
        generateAliases.add(declaration.id.name);
      }
    }
    if (!changed) break;
  }

  const findings = [];
  const visit = (node) => {
    if (node.type === "CallExpression" || node.type === "ImportExpression") {
      const callee = node.type === "CallExpression" ? node.callee : undefined;
      const arguments_ = node.type === "CallExpression" ? node.arguments : [node.source];
      const calledName = propertyName(callee, bindings);
      const directImport = node.type === "ImportExpression" || callee?.type === "Import";
      const directRequire = callee?.type === "Identifier" && callee.name === "require";
      if (directImport || directRequire) {
        const specifier = arguments_[0] ? staticString(arguments_[0], bindings) : undefined;
        if (
          specifier !== undefined &&
          aiProviderPackages.some(
            (packageName) => specifier === packageName || specifier.startsWith(`${packageName}/`),
          )
        ) {
          findings.push(`BOUNDARY_DIRECT_AI_PROVIDER:${relativeFile}:${specifier}`);
        }
      }
      if (
        calledName === "generate" ||
        (callee?.type === "Identifier" && generateAliases.has(callee.name))
      ) {
        findings.push(`BOUNDARY_DIRECT_AI_PROVIDER:${relativeFile}:adapter.generate`);
      }
      if (callee?.type === "Identifier" && callee.name === "fetch") {
        const target = arguments_[0];
        const staticTarget = target ? staticString(target, bindings) : undefined;
        if (
          target &&
          (containsProviderEnvironment(target, taintedBindings) ||
            (staticTarget !== undefined && directProviderRoutePattern.test(staticTarget)))
        ) {
          findings.push(`BOUNDARY_DIRECT_AI_PROVIDER:${relativeFile}:dynamic-provider-http`);
        }
      }
    }
  };
  walk(sourceFile, visit);
  return findings;
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
  violations.push(...inspectAst(filePath, source));
  if (
    !isAiRoutingFile(path.relative(repositoryRoot, filePath)) &&
    (directProviderRoutePattern.test(source) ||
      splitProviderRoutePattern.test(source) ||
      directAdapterGeneratePattern.test(source) ||
      publicAdapterPattern.test(source))
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
