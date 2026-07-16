import console from "node:console";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { parseSync, traverse } from "@babel/core";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let scanRoot = repositoryRoot;
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
const aiProviderPackages = [
  "openai",
  "@anthropic-ai/sdk",
  "@google/generative-ai",
  "@google/genai",
  "@azure/openai",
  "cohere-ai",
];
const directProviderRoutePattern = /(?:\/chat\/completions|\/v1\/responses|\/v1\/messages)/u;
const restrictedAiComposition = "@evaluation/ai-routing/admin-composition";
const protectedAiCompositionFile = "apps/api/src/ai-routing/ai-routing.module.ts";
const providerEnvironmentPattern =
  /(?:^|_)(?:AI|OPENAI|ANTHROPIC|AZURE_OPENAI|COHERE|MODEL_PROVIDER)(?:_|$)/u;
const maxResolvedValues = 32;
const invocationAnalysisByBindingWrites = new WeakMap();

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
  const relativePath = path.relative(scanRoot, filePath);
  const [category, workspace] = relativePath.split(path.sep);
  return path.join(scanRoot, category, workspace);
}

function logicalSourcePath(filePath) {
  const normalized = path.relative(scanRoot, filePath).split(path.sep).join("/");
  return normalized.endsWith(".fixture") ? normalized.slice(0, -".fixture".length) : normalized;
}

function moduleStem(filePath) {
  return logicalSourcePath(filePath).replace(/\.(?:[cm]?[jt]sx?)$/u, "");
}

function protectedGovernanceTarget(filePath, specifier) {
  if (!specifier.startsWith(".")) return undefined;
  const target = moduleStem(path.resolve(path.dirname(filePath), specifier));
  if (target.endsWith("/ai-routing/admin-composition")) return "admin-composition";
  if (target.endsWith("/ai-routing/route-config")) return "route-config";
  return undefined;
}

function inspectImport(filePath, specifier) {
  const relativeFile = path.relative(repositoryRoot, filePath);
  const normalizedFile = logicalSourcePath(filePath);
  const packageImport = /^@evaluation\/([^/]+)(\/.+)?$/u.exec(specifier);

  if (specifier === restrictedAiComposition) {
    return normalizedFile === protectedAiCompositionFile
      ? undefined
      : `BOUNDARY_RESTRICTED_AI_COMPOSITION:${relativeFile}:${specifier}`;
  }

  const governanceTarget = protectedGovernanceTarget(filePath, specifier);
  if (governanceTarget !== undefined) {
    const allowedFile =
      governanceTarget === "route-config"
        ? "apps/api/src/ai-routing/admin-composition.ts"
        : protectedAiCompositionFile;
    return normalizedFile === allowedFile
      ? undefined
      : `BOUNDARY_RESTRICTED_AI_COMPOSITION:${relativeFile}:${specifier}`;
  }

  if (
    normalizedFile.startsWith("apps/web/") &&
    webForbiddenPackages.some(
      (packageName) => specifier === packageName || specifier.startsWith(`${packageName}/`),
    )
  ) {
    return `BOUNDARY_WEB_SERVER_IMPORT:${relativeFile}:${specifier}`;
  }

  if (
    !isAiRoutingFile(filePath) &&
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

function bindingWritePosition(node) {
  return node?.end ?? node?.start ?? Number.POSITIVE_INFINITY;
}

function hasAmbiguousControlFlow(node, pathByNode) {
  let current = pathByNode.get(node)?.parentPath;
  while (current) {
    if (
      [
        "CatchClause",
        "ConditionalExpression",
        "DoWhileStatement",
        "ForInStatement",
        "ForOfStatement",
        "ForStatement",
        "IfStatement",
        "LogicalExpression",
        "SwitchCase",
        "TryStatement",
        "WhileStatement",
      ].includes(current.node.type)
    ) {
      return true;
    }
    if (
      [
        "ArrowFunctionExpression",
        "FunctionDeclaration",
        "FunctionExpression",
        "ObjectMethod",
        "ClassMethod",
        "ClassPrivateMethod",
        "Program",
      ].includes(current.node.type)
    ) {
      return false;
    }
    current = current.parentPath;
  }
  return false;
}

function executionBoundary(nodePath) {
  let current = nodePath;
  while (current) {
    if (
      [
        "ArrowFunctionExpression",
        "FunctionDeclaration",
        "FunctionExpression",
        "ObjectMethod",
        "ClassMethod",
        "ClassPrivateMethod",
        "Program",
      ].includes(current.node.type)
    ) {
      return current.node;
    }
    current = current.parentPath;
  }
  return undefined;
}

function crossesExecutionBoundary(binding, writeNode, pathByNode) {
  return executionBoundary(binding?.path) !== executionBoundary(pathByNode.get(writeNode));
}

function addBindingWrite(writes, binding, writeNode, expression, pathByNode, selection = []) {
  if (binding === undefined) return;
  const write = {
    ambiguous:
      hasAmbiguousControlFlow(writeNode, pathByNode) ||
      (writeNode?.type === "AssignmentExpression" && writeNode.operator !== "=") ||
      crossesExecutionBoundary(binding, writeNode, pathByNode),
    boundary: executionBoundary(pathByNode.get(writeNode)),
    expression,
    position: bindingWritePosition(writeNode),
    selection,
  };
  const existing = writes.get(binding);
  if (existing) existing.push(write);
  else writes.set(binding, [write]);
}

function collectSelectedBindingWrites(
  pattern,
  source,
  writeNode,
  writes,
  pathByNode,
  selection = [],
) {
  if (pattern?.type === "Identifier") {
    addBindingWrite(
      writes,
      lexicalBinding(pattern, pathByNode),
      writeNode,
      source,
      pathByNode,
      selection,
    );
    return;
  }
  if (pattern?.type === "AssignmentPattern") {
    collectSelectedBindingWrites(pattern.left, source, writeNode, writes, pathByNode, selection);
    return;
  }
  if (pattern?.type === "RestElement") {
    collectUnknownBindingWrites(pattern.argument, writeNode, writes, pathByNode);
    return;
  }
  if (pattern?.type === "ObjectPattern") {
    for (const property of pattern.properties) {
      if (property.type === "RestElement") {
        collectUnknownBindingWrites(property.argument, writeNode, writes, pathByNode);
        continue;
      }
      collectSelectedBindingWrites(property.value, source, writeNode, writes, pathByNode, [
        ...selection,
        {
          computed: property.computed,
          key: property.key,
          type: "property",
        },
      ]);
    }
    return;
  }
  if (pattern?.type === "ArrayPattern") {
    for (const [index, element] of pattern.elements.entries()) {
      if (element) {
        collectSelectedBindingWrites(element, source, writeNode, writes, pathByNode, [
          ...selection,
          { index, type: "index" },
        ]);
      }
    }
  }
}

function collectUnknownBindingWrites(pattern, writeNode, writes, pathByNode) {
  if (pattern?.type === "Identifier") {
    addBindingWrite(writes, lexicalBinding(pattern, pathByNode), writeNode, undefined, pathByNode);
    return;
  }
  if (pattern?.type === "AssignmentPattern") {
    collectUnknownBindingWrites(pattern.left, writeNode, writes, pathByNode);
    return;
  }
  if (pattern?.type === "RestElement") {
    collectUnknownBindingWrites(pattern.argument, writeNode, writes, pathByNode);
    return;
  }
  if (pattern?.type === "ObjectPattern") {
    for (const property of pattern.properties) {
      collectUnknownBindingWrites(
        property.type === "RestElement" ? property.argument : property.value,
        writeNode,
        writes,
        pathByNode,
      );
    }
    return;
  }
  if (pattern?.type === "ArrayPattern") {
    for (const element of pattern.elements) {
      if (element) collectUnknownBindingWrites(element, writeNode, writes, pathByNode);
    }
  }
}

function addBounded(target, value) {
  if (target.has(value)) return true;
  if (target.size >= maxResolvedValues) return false;
  target.add(value);
  return true;
}

function unionResolved(target, source) {
  for (const value of source.values) {
    if (target.values.size >= maxResolvedValues && !target.values.has(value)) {
      target.truncated = true;
    } else target.values.add(value);
  }
  target.unknown ||= source.unknown;
  target.truncated ||= source.truncated;
  return target;
}

function bindingStateAt(binding, ownerBoundary, position, bindingWrites) {
  const state = { values: new Set(), unknown: false, truncated: false };
  const writes = bindingWrites.get(binding) ?? [];

  for (const write of writes) {
    if (write.boundary !== ownerBoundary || write.position > position) continue;
    if (!write.ambiguous) {
      state.values.clear();
      state.unknown = write.expression === undefined;
      state.truncated = false;
    }
    if (write.expression === undefined) state.unknown = true;
    else if (!addBounded(state.values, write)) state.truncated = true;
  }

  // Mutations from another execution boundary may run before any nested reference.
  // They never dominate the owner boundary's definite state, but remain possible.
  for (const write of writes) {
    if (write.boundary === ownerBoundary) continue;
    if (write.expression === undefined) state.unknown = true;
    else if (!addBounded(state.values, write)) state.truncated = true;
  }

  return state;
}

function possibleBindingWrites(identifier, bindingWrites, pathByNode) {
  const binding = lexicalBinding(identifier, pathByNode);
  if (binding === undefined) return { values: new Set(), unknown: true, truncated: false };
  const ownerBoundary = executionBoundary(binding.path);
  const referenceBoundary = executionBoundary(pathByNode.get(identifier));
  if (ownerBoundary === undefined || referenceBoundary === undefined) {
    return { values: new Set(), unknown: true, truncated: false };
  }

  if (ownerBoundary === referenceBoundary) {
    return bindingStateAt(
      binding,
      ownerBoundary,
      identifier?.start ?? Number.POSITIVE_INFINITY,
      bindingWrites,
    );
  }

  // A nested reference observes outer state when its function is invoked, not when
  // the function body appears in source. Direct local calls cover reviewed runtime
  // order; end-of-owner-boundary represents later/external invocation after init.
  const invocationAnalysis = invocationAnalysisByBindingWrites.get(bindingWrites);
  const invocationPositions = invocationAnalysis?.positions
    .get(referenceBoundary)
    ?.get(ownerBoundary);
  const invocationPositionsTruncated =
    invocationAnalysis?.truncated.get(referenceBoundary)?.has(ownerBoundary) ?? false;
  const observationPositions = [...(invocationPositions ?? []), Number.POSITIVE_INFINITY];
  const result = {
    values: new Set(),
    unknown: false,
    truncated: invocationPositionsTruncated,
  };
  for (const position of observationPositions) {
    unionResolved(result, bindingStateAt(binding, ownerBoundary, position, bindingWrites));
  }
  return result;
}

function possibleStaticStrings(node, bindingWrites, pathByNode, resolvingWrites = new Set()) {
  if (node?.type === "StringLiteral") {
    return { values: new Set([node.value]), unknown: false, truncated: false };
  }
  if (node?.type === "Identifier") {
    const possibleWrites = possibleBindingWrites(node, bindingWrites, pathByNode);
    const result = {
      values: new Set(),
      unknown: possibleWrites.unknown,
      truncated: possibleWrites.truncated,
    };
    for (const write of possibleWrites.values) {
      if (write.expression === undefined || resolvingWrites.has(write)) {
        result.unknown = true;
        continue;
      }
      const nextResolvingWrites = new Set(resolvingWrites);
      nextResolvingWrites.add(write);
      unionResolved(
        result,
        possibleStaticStrings(write.expression, bindingWrites, pathByNode, nextResolvingWrites),
      );
    }
    return result;
  }
  if (node?.type === "ParenthesizedExpression") {
    return possibleStaticStrings(node.expression, bindingWrites, pathByNode, resolvingWrites);
  }
  if (node?.type === "BinaryExpression" && node.operator === "+") {
    const left = possibleStaticStrings(node.left, bindingWrites, pathByNode, resolvingWrites);
    const right = possibleStaticStrings(node.right, bindingWrites, pathByNode, resolvingWrites);
    const result = {
      values: new Set(),
      unknown: left.unknown || right.unknown,
      truncated: left.truncated || right.truncated,
    };
    for (const leftValue of left.values) {
      for (const rightValue of right.values) {
        if (!addBounded(result.values, `${leftValue}${rightValue}`)) result.truncated = true;
      }
    }
    if (left.values.size * right.values.size > maxResolvedValues) result.unknown = true;
    return result;
  }
  if (node?.type === "TemplateLiteral") {
    let result = {
      values: new Set([node.quasis[0]?.value.cooked ?? ""]),
      unknown: false,
      truncated: false,
    };
    for (let index = 0; index < node.expressions.length; index += 1) {
      const expression = possibleStaticStrings(
        node.expressions[index],
        bindingWrites,
        pathByNode,
        resolvingWrites,
      );
      const suffix = node.quasis[index + 1]?.value.cooked ?? "";
      const next = {
        values: new Set(),
        unknown: result.unknown || expression.unknown,
        truncated: result.truncated || expression.truncated,
      };
      for (const prefix of result.values) {
        for (const value of expression.values) {
          if (!addBounded(next.values, `${prefix}${value}${suffix}`)) next.truncated = true;
        }
      }
      if (result.values.size * expression.values.size > maxResolvedValues) next.unknown = true;
      result = next;
    }
    return result;
  }
  if (
    node?.type === "CallExpression" &&
    node.callee?.type === "MemberExpression" &&
    propertyName(node.callee, bindingWrites, pathByNode) === "join" &&
    node.callee.object?.type === "ArrayExpression"
  ) {
    const separator = node.arguments[0]
      ? possibleStaticStrings(node.arguments[0], bindingWrites, pathByNode, resolvingWrites)
      : { values: new Set([","]), unknown: false, truncated: false };
    let joined = {
      values: new Set([""]),
      unknown: separator.unknown,
      truncated: separator.truncated,
    };
    for (const element of node.callee.object.elements) {
      const item = possibleStaticStrings(element, bindingWrites, pathByNode, resolvingWrites);
      const next = {
        values: new Set(),
        unknown: joined.unknown || item.unknown,
        truncated: joined.truncated || item.truncated,
      };
      for (const prefix of joined.values) {
        for (const itemValue of item.values) {
          for (const separatorValue of separator.values) {
            if (
              !addBounded(
                next.values,
                prefix === "" ? itemValue : `${prefix}${separatorValue}${itemValue}`,
              )
            ) {
              next.truncated = true;
            }
          }
        }
      }
      joined = next;
    }
    return joined;
  }
  return { values: new Set(), unknown: true, truncated: false };
}

function staticString(node, bindingWrites, pathByNode, resolvingWrites = new Set()) {
  const resolved = possibleStaticStrings(node, bindingWrites, pathByNode, resolvingWrites);
  return !resolved.unknown && !resolved.truncated && resolved.values.size === 1
    ? [...resolved.values][0]
    : undefined;
}

function hasPossibleStaticString(node, expected, bindingWrites, pathByNode) {
  const resolved = possibleStaticStrings(node, bindingWrites, pathByNode);
  return resolved.values.has(expected) || resolved.truncated;
}

function propertyName(expression, bindings, pathByNode) {
  if (!["MemberExpression", "OptionalMemberExpression"].includes(expression?.type)) {
    return undefined;
  }
  if (!expression.computed && expression.property?.type === "Identifier") {
    return expression.property.name;
  }
  return staticString(expression.property, bindings, pathByNode);
}

function hasPossiblePropertyName(expression, expected, bindings, pathByNode) {
  if (!["MemberExpression", "OptionalMemberExpression"].includes(expression?.type)) return false;
  if (!expression.computed && expression.property?.type === "Identifier") {
    return expression.property.name === expected;
  }
  const resolved = possibleStaticStrings(expression.property, bindings, pathByNode);
  return resolved.values.has(expected) || resolved.truncated;
}

function patternExtractsGenerate(pattern, bindings, pathByNode) {
  if (pattern?.type === "AssignmentPattern") {
    return patternExtractsGenerate(pattern.left, bindings, pathByNode);
  }
  if (pattern?.type === "RestElement") {
    return patternExtractsGenerate(pattern.argument, bindings, pathByNode);
  }
  if (pattern?.type !== "ObjectPattern") return false;
  return pattern.properties.some((property) => {
    if (property.type === "RestElement") {
      return patternExtractsGenerate(property.argument, bindings, pathByNode);
    }
    if (property.type !== "ObjectProperty") return false;
    return (
      (property.computed
        ? hasPossibleStaticString(property.key, "generate", bindings, pathByNode)
        : propertyKeyName(property, bindings, pathByNode) === "generate") ||
      patternExtractsGenerate(property.value, bindings, pathByNode)
    );
  });
}

function propertyKeyName(property, bindings, pathByNode) {
  const key = property?.key;
  if (!property?.computed && key?.type === "Identifier") return key.name;
  if (key?.type === "StringLiteral") return key.value;
  return property?.computed ? staticString(key, bindings, pathByNode) : undefined;
}

function classDefinesLocalGenerate(node, bindings, pathByNode) {
  return node?.body?.body?.some(
    (member) =>
      (member.type === "ClassMethod" || member.type === "ClassPrivateMethod") &&
      propertyKeyName(member, bindings, pathByNode) === "generate",
  );
}

function unwrapTransparentExpression(node) {
  let current = node;
  while (current) {
    if (current.type === "SequenceExpression") {
      current = current.expressions.at(-1);
      continue;
    }
    if (
      [
        "ParenthesizedExpression",
        "TSAsExpression",
        "TSTypeAssertion",
        "TSNonNullExpression",
        "TSSatisfiesExpression",
        "TSInstantiationExpression",
        "TypeCastExpression",
        "ChainExpression",
      ].includes(current.type)
    ) {
      current = current.expression;
      continue;
    }
    return current;
  }
  return current;
}

function lexicalBinding(node, pathByNode) {
  if (node?.type !== "Identifier") return undefined;
  return pathByNode.get(node)?.scope.getBinding(node.name);
}

function directFunctionTarget(node) {
  const expression = unwrapTransparentExpression(node);
  return ["ArrowFunctionExpression", "FunctionExpression", "ObjectMethod"].includes(
    expression?.type,
  )
    ? expression
    : undefined;
}

function addFunctionTarget(functionTargets, binding, target) {
  if (binding === undefined || target === undefined) return false;
  let targets = functionTargets.get(binding);
  if (targets === undefined) {
    targets = new Set();
    functionTargets.set(binding, targets);
  }
  const previousSize = targets.size;
  targets.add(target);
  return targets.size !== previousSize;
}

function staticSelectionKeys(selector, bindingWrites, pathByNode) {
  if (selector.type === "index") {
    return { truncated: false, values: new Set([selector.index]) };
  }
  if (!selector.computed && selector.key?.type === "Identifier") {
    return { truncated: false, values: new Set([selector.key.name]) };
  }
  if (!selector.computed && selector.key?.type === "StringLiteral") {
    return { truncated: false, values: new Set([selector.key.value]) };
  }
  if (!selector.computed && selector.key?.type === "NumericLiteral") {
    return { truncated: false, values: new Set([selector.key.value]) };
  }
  if (selector.computed && selector.key?.type === "NumericLiteral") {
    return { truncated: false, values: new Set([selector.key.value]) };
  }
  const resolved = possibleStaticStrings(selector.key, bindingWrites, pathByNode);
  return { truncated: resolved.truncated || resolved.unknown, values: resolved.values };
}

function possibleFunctionTargets(
  node,
  declaredFunctionTargets,
  bindingWrites,
  pathByNode,
  options = {},
) {
  const result = { targets: new Set(), truncated: false };
  const resolvingWrites = options.resolvingWrites ?? new Set();
  const selection = options.selection ?? [];
  const contained = options.contained ?? false;
  const depth = options.depth ?? 0;
  if (depth > maxResolvedValues) {
    result.truncated = true;
    return result;
  }

  const merge = (nested) => {
    for (const target of nested.targets) {
      if (!addBounded(result.targets, target)) result.truncated = true;
    }
    result.truncated ||= nested.truncated;
  };
  const recurse = (candidate, nextOptions = {}) => {
    merge(
      possibleFunctionTargets(candidate, declaredFunctionTargets, bindingWrites, pathByNode, {
        contained: nextOptions.contained ?? contained,
        depth: depth + 1,
        resolvingWrites: nextOptions.resolvingWrites ?? resolvingWrites,
        selection: nextOptions.selection ?? [],
      }),
    );
  };

  const expression = unwrapTransparentExpression(node);
  if (expression == null) return result;

  if (selection.length > 0) {
    const [selector, ...remaining] = selection;
    if (expression.type === "Identifier") {
      const writes = possibleBindingWrites(expression, bindingWrites, pathByNode);
      result.truncated ||= writes.truncated;
      for (const write of writes.values) {
        if (resolvingWrites.has(write)) {
          result.truncated = true;
          continue;
        }
        const nextResolvingWrites = new Set(resolvingWrites);
        nextResolvingWrites.add(write);
        recurse(write.expression, {
          resolvingWrites: nextResolvingWrites,
          selection: [...(write.selection ?? []), selector, ...remaining],
        });
      }
      return result;
    }
    if (["MemberExpression", "OptionalMemberExpression"].includes(expression.type)) {
      recurse(expression.object, {
        selection: [
          {
            computed: expression.computed,
            key: expression.property,
            type: "property",
          },
          selector,
          ...remaining,
        ],
      });
      return result;
    }

    const keys = staticSelectionKeys(selector, bindingWrites, pathByNode);
    result.truncated ||= keys.truncated;
    if (expression.type === "ObjectExpression") {
      for (const property of expression.properties) {
        if (property.type === "SpreadElement") {
          recurse(property.argument, { selection: [selector, ...remaining] });
          continue;
        }
        const propertyKey = propertyKeyName(property, bindingWrites, pathByNode);
        if (![...keys.values].some((key) => String(key) === String(propertyKey))) continue;
        recurse(property.type === "ObjectMethod" ? property : property.value, {
          selection: remaining,
        });
      }
      return result;
    }
    if (expression.type === "ArrayExpression") {
      for (const key of keys.values) {
        const index = typeof key === "number" ? key : Number(key);
        const element = Number.isInteger(index) ? expression.elements[index] : undefined;
        if (element?.type === "SpreadElement") recurse(element.argument, { contained: true });
        else if (element) recurse(element, { selection: remaining });
      }
      return result;
    }
    if (expression.type === "ConditionalExpression") {
      recurse(expression.consequent, { selection });
      recurse(expression.alternate, { selection });
      return result;
    }
    if (expression.type === "LogicalExpression") {
      recurse(expression.left, { selection });
      recurse(expression.right, { selection });
      return result;
    }
    return result;
  }

  const direct = directFunctionTarget(expression);
  if (direct !== undefined) {
    addBounded(result.targets, direct);
    return result;
  }
  if (expression.type === "Identifier") {
    for (const target of declaredFunctionTargets.get(lexicalBinding(expression, pathByNode)) ??
      []) {
      if (!addBounded(result.targets, target)) result.truncated = true;
    }
    const writes = possibleBindingWrites(expression, bindingWrites, pathByNode);
    result.truncated ||= writes.truncated;
    for (const write of writes.values) {
      if (resolvingWrites.has(write)) {
        result.truncated = true;
        continue;
      }
      const nextResolvingWrites = new Set(resolvingWrites);
      nextResolvingWrites.add(write);
      recurse(write.expression, {
        resolvingWrites: nextResolvingWrites,
        selection: write.selection ?? [],
      });
    }
    return result;
  }
  if (["MemberExpression", "OptionalMemberExpression"].includes(expression.type)) {
    const memberName = propertyName(expression, bindingWrites, pathByNode);
    if (memberName === "bind") return result;
    if (["call", "apply"].includes(memberName)) {
      recurse(expression.object);
      return result;
    }
    recurse(expression.object, {
      selection: [
        {
          computed: expression.computed,
          key: expression.property,
          type: "property",
        },
      ],
    });
    return result;
  }
  if (
    expression.type === "CallExpression" &&
    ["MemberExpression", "OptionalMemberExpression"].includes(expression.callee?.type) &&
    propertyName(expression.callee, bindingWrites, pathByNode) === "bind"
  ) {
    recurse(expression.callee.object);
    return result;
  }
  if (expression.type === "ConditionalExpression") {
    recurse(expression.consequent);
    recurse(expression.alternate);
    return result;
  }
  if (expression.type === "LogicalExpression") {
    recurse(expression.left);
    recurse(expression.right);
    return result;
  }
  if (contained && expression.type === "ObjectExpression") {
    for (const property of expression.properties) {
      if (property.type === "SpreadElement") recurse(property.argument, { contained: true });
      else
        recurse(property.type === "ObjectMethod" ? property : property.value, { contained: true });
    }
    return result;
  }
  if (contained && expression.type === "ArrayExpression") {
    for (const element of expression.elements) {
      if (element?.type === "SpreadElement") recurse(element.argument, { contained: true });
      else if (element) recurse(element, { contained: true });
    }
  }
  return result;
}

function addInvocationPosition(analysis, target, observedBoundary, position) {
  let byBoundary = analysis.positions.get(target);
  if (byBoundary === undefined) {
    byBoundary = new Map();
    analysis.positions.set(target, byBoundary);
  }
  let positions = byBoundary.get(observedBoundary);
  if (positions === undefined) {
    positions = new Set();
    byBoundary.set(observedBoundary, positions);
  }
  if (positions.has(position)) return false;
  if (positions.size >= maxResolvedValues) {
    let truncatedBoundaries = analysis.truncated.get(target);
    if (truncatedBoundaries === undefined) {
      truncatedBoundaries = new Set();
      analysis.truncated.set(target, truncatedBoundaries);
    }
    const wasTruncated = truncatedBoundaries.has(observedBoundary);
    truncatedBoundaries.add(observedBoundary);
    return !wasTruncated;
  }
  positions.add(position);
  return true;
}

function propagateInvocationTruncation(analysis, target, observedBoundary) {
  let truncatedBoundaries = analysis.truncated.get(target);
  if (truncatedBoundaries === undefined) {
    truncatedBoundaries = new Set();
    analysis.truncated.set(target, truncatedBoundaries);
  }
  const wasTruncated = truncatedBoundaries.has(observedBoundary);
  truncatedBoundaries.add(observedBoundary);
  return !wasTruncated;
}

function isDirectLocalGeneratorExpression(node, localGeneratorClasses, bindings, pathByNode) {
  const expression = unwrapTransparentExpression(node);
  if (expression?.type === "ObjectExpression") {
    return expression.properties.some((property) => {
      if (propertyKeyName(property, bindings, pathByNode) !== "generate") return false;
      if (property.type === "ObjectMethod") return true;
      return (
        property.type === "ObjectProperty" &&
        ["ArrowFunctionExpression", "FunctionExpression"].includes(property.value?.type)
      );
    });
  }
  return (
    expression?.type === "NewExpression" &&
    expression.callee?.type === "Identifier" &&
    localGeneratorClasses.has(lexicalBinding(expression.callee, pathByNode))
  );
}

function isLocalGeneratorExpression(
  node,
  neutralGeneratorBindings,
  localGeneratorClasses,
  bindings,
  pathByNode,
) {
  const expression = unwrapTransparentExpression(node);
  if (expression?.type === "Identifier") {
    return neutralGeneratorBindings.has(lexicalBinding(expression, pathByNode));
  }
  return isDirectLocalGeneratorExpression(expression, localGeneratorClasses, bindings, pathByNode);
}

function addGeneratorWrite(writes, binding, expression) {
  if (binding === undefined) return;
  const existing = writes.get(binding);
  if (existing) existing.push(expression);
  else writes.set(binding, [expression]);
}

function collectPatternGeneratorWrites(pattern, source, writes, pathByNode, nested = false) {
  if (pattern?.type === "Identifier") {
    addGeneratorWrite(writes, lexicalBinding(pattern, pathByNode), undefined);
    return;
  }
  if (pattern?.type === "AssignmentPattern") {
    collectPatternGeneratorWrites(pattern.left, undefined, writes, pathByNode, true);
    return;
  }
  if (pattern?.type === "RestElement") {
    if (pattern.argument?.type === "Identifier" && !nested) {
      addGeneratorWrite(writes, lexicalBinding(pattern.argument, pathByNode), source);
    } else {
      collectPatternGeneratorWrites(pattern.argument, undefined, writes, pathByNode, true);
    }
    return;
  }
  if (pattern?.type === "ObjectPattern") {
    for (const property of pattern.properties) {
      if (property.type === "RestElement") {
        if (property.argument?.type === "Identifier" && !nested) {
          addGeneratorWrite(writes, lexicalBinding(property.argument, pathByNode), source);
        } else {
          collectPatternGeneratorWrites(property.argument, undefined, writes, pathByNode, true);
        }
        continue;
      }
      if (property.type === "ObjectProperty") {
        collectPatternGeneratorWrites(property.value, undefined, writes, pathByNode, true);
      }
    }
    return;
  }
  if (pattern?.type === "ArrayPattern") {
    for (const element of pattern.elements) {
      if (element) collectPatternGeneratorWrites(element, undefined, writes, pathByNode, true);
    }
  }
}

function collectOpaquePatternWrites(pattern, writes, pathByNode) {
  if (pattern?.type === "Identifier") {
    addGeneratorWrite(writes, lexicalBinding(pattern, pathByNode), undefined);
    return;
  }
  if (pattern?.type === "AssignmentPattern") {
    collectOpaquePatternWrites(pattern.left, writes, pathByNode);
    return;
  }
  if (pattern?.type === "RestElement") {
    collectOpaquePatternWrites(pattern.argument, writes, pathByNode);
    return;
  }
  if (pattern?.type === "ObjectPattern") {
    for (const property of pattern.properties) {
      collectOpaquePatternWrites(
        property.type === "RestElement" ? property.argument : property.value,
        writes,
        pathByNode,
      );
    }
    return;
  }
  if (pattern?.type === "ArrayPattern") {
    for (const element of pattern.elements) {
      if (element) collectOpaquePatternWrites(element, writes, pathByNode);
    }
  }
}

function possibleStaticUrls(node, bindings, pathByNode) {
  const direct = possibleStaticStrings(node, bindings, pathByNode);
  if (direct.values.size > 0) return direct;
  if (
    node?.type === "NewExpression" &&
    node.callee?.type === "Identifier" &&
    node.callee.name === "URL"
  ) {
    const relatives = node.arguments[0]
      ? possibleStaticStrings(node.arguments[0], bindings, pathByNode)
      : { values: new Set(), unknown: true, truncated: false };
    const bases = node.arguments[1]
      ? possibleStaticStrings(node.arguments[1], bindings, pathByNode)
      : { values: new Set(), unknown: true, truncated: false };
    const result = {
      values: new Set(),
      unknown: relatives.unknown || bases.unknown,
      truncated: relatives.truncated || bases.truncated,
    };
    for (const relative of relatives.values) {
      for (const base of bases.values) {
        try {
          if (!addBounded(result.values, new URL(relative, base).toString())) {
            result.truncated = true;
          }
        } catch {
          result.unknown = true;
        }
      }
    }
    return result;
  }
  return { values: new Set(), unknown: true, truncated: false };
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

function containsProviderEnvironment(node, bindingWrites, pathByNode, resolvingWrites = new Set()) {
  let found = false;
  walk(node, (candidate) => {
    if (candidate.type === "Identifier") {
      const possibleWrites = possibleBindingWrites(candidate, bindingWrites, pathByNode);
      if (possibleWrites.truncated) found = true;
      for (const write of possibleWrites.values) {
        if (write.expression === undefined || resolvingWrites.has(write)) continue;
        const nextResolvingWrites = new Set(resolvingWrites);
        nextResolvingWrites.add(write);
        if (
          containsProviderEnvironment(
            write.expression,
            bindingWrites,
            pathByNode,
            nextResolvingWrites,
          )
        ) {
          found = true;
        }
      }
    }
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
  const aiRoutingFile = isAiRoutingFile(filePath);
  const sourceFile = parseSync(source, {
    filename: filePath,
    configFile: false,
    babelrc: false,
    parserOpts: { sourceType: "module", plugins: ["typescript", "jsx"] },
  });
  if (sourceFile === null) return [];
  const bindingWrites = new Map();
  const neutralGeneratorBindings = new Set();
  const localGeneratorClasses = new Set();
  const pathByNode = new WeakMap();
  const allBindings = new Set();
  const declarations = [];
  const assignments = [];
  const iterationWrites = [];
  const updateWrites = [];
  const opaqueBindingPatterns = [];
  const localGeneratorClassNodes = [];
  const functionNodes = [];
  const callNodes = [];

  traverse(sourceFile, {
    enter(nodePath) {
      pathByNode.set(nodePath.node, nodePath);
      if (nodePath.isIdentifier()) {
        const binding = nodePath.scope.getBinding(nodePath.node.name);
        if (binding) allBindings.add(binding);
      }
      const { node } = nodePath;
      if (node.type === "VariableDeclarator") declarations.push(node);
      if (node.type === "AssignmentExpression") assignments.push(node);
      if (node.type === "CallExpression") callNodes.push(node);
      if (node.type === "ForOfStatement" || node.type === "ForInStatement") {
        iterationWrites.push(node.left);
      }
      if (node.type === "UpdateExpression") updateWrites.push(node.argument);
      if (
        (node.type === "ClassDeclaration" || node.type === "ClassExpression") &&
        node.id?.type === "Identifier"
      ) {
        localGeneratorClassNodes.push(node.id);
      }
      if (
        [
          "FunctionDeclaration",
          "FunctionExpression",
          "ArrowFunctionExpression",
          "ObjectMethod",
          "ClassMethod",
          "ClassPrivateMethod",
        ].includes(node.type)
      ) {
        opaqueBindingPatterns.push(...node.params);
        functionNodes.push(node);
      }
      if (node.type === "CatchClause" && node.param) {
        opaqueBindingPatterns.push(node.param);
      }
    },
  });

  for (const declaration of declarations) {
    if (declaration.id?.type === "Identifier") {
      // `var name;` is not a runtime write and must not erase a prior initializer.
      if (declaration.init === null) continue;
      addBindingWrite(
        bindingWrites,
        lexicalBinding(declaration.id, pathByNode),
        declaration,
        declaration.init,
        pathByNode,
      );
    } else {
      collectSelectedBindingWrites(
        declaration.id,
        declaration.init,
        declaration,
        bindingWrites,
        pathByNode,
      );
    }
  }
  for (const assignment of assignments) {
    if (assignment.left?.type === "Identifier") {
      addBindingWrite(
        bindingWrites,
        lexicalBinding(assignment.left, pathByNode),
        assignment,
        assignment.operator === "=" || ["&&=", "||=", "??="].includes(assignment.operator)
          ? assignment.right
          : undefined,
        pathByNode,
      );
    } else {
      if (assignment.operator === "=") {
        collectSelectedBindingWrites(
          assignment.left,
          assignment.right,
          assignment,
          bindingWrites,
          pathByNode,
        );
      } else {
        collectUnknownBindingWrites(assignment.left, assignment, bindingWrites, pathByNode);
      }
    }
  }
  for (const pattern of opaqueBindingPatterns) {
    collectUnknownBindingWrites(pattern, pattern, bindingWrites, pathByNode);
  }
  for (const pattern of iterationWrites) {
    if (pattern.type === "VariableDeclaration") {
      for (const declaration of pattern.declarations) {
        collectUnknownBindingWrites(declaration.id, pattern, bindingWrites, pathByNode);
      }
    } else {
      collectUnknownBindingWrites(pattern, pattern, bindingWrites, pathByNode);
    }
  }
  for (const pattern of updateWrites) {
    collectUnknownBindingWrites(pattern, pattern, bindingWrites, pathByNode);
  }
  for (const writes of bindingWrites.values()) {
    writes.sort((left, right) => left.position - right.position);
  }

  // Resolve locally-declared function values through exact lexical aliases. Every
  // possible target is retained: an unknown value or reassignment cannot erase a
  // function that the binding may still invoke along another runtime path.
  const declaredFunctionTargets = new Map();
  for (const functionNode of functionNodes) {
    if (functionNode.type === "FunctionDeclaration") {
      addFunctionTarget(
        declaredFunctionTargets,
        lexicalBinding(functionNode.id, pathByNode),
        functionNode,
      );
    }
  }

  // Each call edge records the call's real position in its lexical caller. A
  // function-valued argument is conservatively treated as a synchronous callback.
  // Propagating the caller's runtime observations through these edges gives nested
  // wrappers the external position at which their captured outer state is observed.
  const invocationEdges = [];
  let truncatedFunctionTargetResolution = false;
  for (const callNode of callNodes) {
    const callerBoundary = executionBoundary(pathByNode.get(callNode));
    if (callerBoundary === undefined) continue;
    const calleeTargets = possibleFunctionTargets(
      callNode.callee,
      declaredFunctionTargets,
      bindingWrites,
      pathByNode,
    );
    truncatedFunctionTargetResolution ||= calleeTargets.truncated;
    const targets = new Set(calleeTargets.targets);
    for (const argument of callNode.arguments) {
      const callbackTargets = possibleFunctionTargets(
        argument?.type === "SpreadElement" ? argument.argument : argument,
        declaredFunctionTargets,
        bindingWrites,
        pathByNode,
        { contained: true },
      );
      truncatedFunctionTargetResolution ||= callbackTargets.truncated;
      for (const target of callbackTargets.targets) targets.add(target);
    }
    for (const target of targets) {
      invocationEdges.push({
        callerBoundary,
        position: bindingWritePosition(callNode),
        target,
      });
    }
  }
  const invocationAnalysis = { positions: new Map(), truncated: new Map() };
  for (const edge of invocationEdges) {
    addInvocationPosition(invocationAnalysis, edge.target, edge.callerBoundary, edge.position);
  }
  for (let pass = 0; pass < functionNodes.length + 1; pass += 1) {
    let changed = false;
    for (const edge of invocationEdges) {
      const callerObservations = invocationAnalysis.positions.get(edge.callerBoundary);
      for (const [observedBoundary, positions] of callerObservations ?? []) {
        for (const position of positions) {
          changed =
            addInvocationPosition(invocationAnalysis, edge.target, observedBoundary, position) ||
            changed;
        }
      }
      for (const observedBoundary of invocationAnalysis.truncated.get(edge.callerBoundary) ?? []) {
        changed =
          propagateInvocationTruncation(invocationAnalysis, edge.target, observedBoundary) ||
          changed;
      }
    }
    if (!changed) break;
  }
  invocationAnalysisByBindingWrites.set(bindingWrites, invocationAnalysis);

  for (const classNode of localGeneratorClassNodes) {
    const classPath = pathByNode.get(classNode)?.parentPath?.node;
    if (classDefinesLocalGenerate(classPath, bindingWrites, pathByNode)) {
      const binding = lexicalBinding(classNode, pathByNode);
      if (binding) localGeneratorClasses.add(binding);
    }
  }

  const generatorWrites = new Map();
  for (const declaration of declarations) {
    if (!declaration.init) continue;
    if (declaration.id?.type === "Identifier") {
      addGeneratorWrite(
        generatorWrites,
        lexicalBinding(declaration.id, pathByNode),
        declaration.init,
      );
    } else {
      collectPatternGeneratorWrites(declaration.id, declaration.init, generatorWrites, pathByNode);
    }
  }
  for (const assignment of assignments) {
    if (assignment.left?.type === "Identifier") {
      addGeneratorWrite(
        generatorWrites,
        lexicalBinding(assignment.left, pathByNode),
        assignment.operator === "=" ? assignment.right : undefined,
      );
    } else if (assignment.operator === "=") {
      collectPatternGeneratorWrites(assignment.left, assignment.right, generatorWrites, pathByNode);
    } else {
      collectOpaquePatternWrites(assignment.left, generatorWrites, pathByNode);
    }
  }
  for (const pattern of opaqueBindingPatterns) {
    collectOpaquePatternWrites(pattern, generatorWrites, pathByNode);
  }
  for (const pattern of iterationWrites) {
    if (pattern.type === "VariableDeclaration") {
      for (const declaration of pattern.declarations) {
        collectOpaquePatternWrites(declaration.id, generatorWrites, pathByNode);
      }
    } else {
      collectOpaquePatternWrites(pattern, generatorWrites, pathByNode);
    }
  }
  for (const pattern of updateWrites) {
    collectOpaquePatternWrites(pattern, generatorWrites, pathByNode);
  }
  for (const binding of allBindings) {
    for (const violation of binding.constantViolations) {
      if (
        !["AssignmentExpression", "UpdateExpression", "ForOfStatement", "ForInStatement"].includes(
          violation.node.type,
        )
      ) {
        addGeneratorWrite(generatorWrites, binding, undefined);
      }
    }
  }

  for (let pass = 0; pass < generatorWrites.size + 1; pass += 1) {
    let changed = false;
    for (const [binding, writes] of generatorWrites) {
      if (neutralGeneratorBindings.has(binding)) continue;
      const everyWriteIsLocal = writes.every((write) => {
        if (write === undefined) return false;
        const expression = unwrapTransparentExpression(write);
        return (
          isDirectLocalGeneratorExpression(
            expression,
            localGeneratorClasses,
            bindingWrites,
            pathByNode,
          ) ||
          (expression?.type === "Identifier" &&
            neutralGeneratorBindings.has(lexicalBinding(expression, pathByNode)))
        );
      });
      if (everyWriteIsLocal) {
        neutralGeneratorBindings.add(binding);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const findings = [];
  if (!aiRoutingFile && truncatedFunctionTargetResolution) {
    findings.push(`BOUNDARY_DIRECT_AI_PROVIDER:${relativeFile}:dynamic-provider-execution`);
  }
  const visit = (node) => {
    if (
      (node.type === "ImportDeclaration" ||
        node.type === "ExportNamedDeclaration" ||
        node.type === "ExportAllDeclaration") &&
      node.source?.type === "StringLiteral"
    ) {
      const violation = inspectImport(filePath, node.source.value);
      if (violation) findings.push(violation);
    }
    if (
      !aiRoutingFile &&
      ["MemberExpression", "OptionalMemberExpression"].includes(node.type) &&
      hasPossiblePropertyName(node, "generate", bindingWrites, pathByNode) &&
      !isLocalGeneratorExpression(
        node.object,
        neutralGeneratorBindings,
        localGeneratorClasses,
        bindingWrites,
        pathByNode,
      )
    ) {
      findings.push(`BOUNDARY_DIRECT_AI_PROVIDER:${relativeFile}:opaque.generate`);
    }
    if (
      !aiRoutingFile &&
      node.type === "VariableDeclarator" &&
      patternExtractsGenerate(node.id, bindingWrites, pathByNode) &&
      !isLocalGeneratorExpression(
        node.init,
        neutralGeneratorBindings,
        localGeneratorClasses,
        bindingWrites,
        pathByNode,
      )
    ) {
      findings.push(`BOUNDARY_DIRECT_AI_PROVIDER:${relativeFile}:opaque.generate`);
    }
    if (
      !aiRoutingFile &&
      node.type === "AssignmentExpression" &&
      patternExtractsGenerate(node.left, bindingWrites, pathByNode) &&
      !isLocalGeneratorExpression(
        node.right,
        neutralGeneratorBindings,
        localGeneratorClasses,
        bindingWrites,
        pathByNode,
      )
    ) {
      findings.push(`BOUNDARY_DIRECT_AI_PROVIDER:${relativeFile}:opaque.generate`);
    }
    if (
      !aiRoutingFile &&
      Array.isArray(node.params) &&
      node.params.some((parameter) => patternExtractsGenerate(parameter, bindingWrites, pathByNode))
    ) {
      findings.push(`BOUNDARY_DIRECT_AI_PROVIDER:${relativeFile}:opaque.generate`);
    }
    if (node.type === "CallExpression" || node.type === "ImportExpression") {
      const callee = node.type === "CallExpression" ? node.callee : undefined;
      const arguments_ = node.type === "CallExpression" ? node.arguments : [node.source];
      const directImport = node.type === "ImportExpression" || callee?.type === "Import";
      const directRequire = callee?.type === "Identifier" && callee.name === "require";
      if (directImport || directRequire) {
        const resolvedSpecifiers = arguments_[0]
          ? possibleStaticStrings(arguments_[0], bindingWrites, pathByNode)
          : { values: new Set(), unknown: true, truncated: false };
        for (const specifier of resolvedSpecifiers.values) {
          const violation = inspectImport(filePath, specifier);
          if (violation) findings.push(violation);
        }
        if (!aiRoutingFile && resolvedSpecifiers.truncated) {
          findings.push(`BOUNDARY_DIRECT_AI_PROVIDER:${relativeFile}:dynamic-provider-import`);
        }
      }
      if (
        !aiRoutingFile &&
        callee?.type === "MemberExpression" &&
        memberPath(callee) === "Reflect.get" &&
        arguments_[1] !== undefined &&
        hasPossibleStaticString(arguments_[1], "generate", bindingWrites, pathByNode) &&
        !isLocalGeneratorExpression(
          arguments_[0],
          neutralGeneratorBindings,
          localGeneratorClasses,
          bindingWrites,
          pathByNode,
        )
      ) {
        findings.push(`BOUNDARY_DIRECT_AI_PROVIDER:${relativeFile}:opaque.generate`);
      }
      if (
        !aiRoutingFile &&
        hasPossiblePropertyName(callee, "generate", bindingWrites, pathByNode) &&
        !isLocalGeneratorExpression(
          callee?.object,
          neutralGeneratorBindings,
          localGeneratorClasses,
          bindingWrites,
          pathByNode,
        )
      ) {
        findings.push(`BOUNDARY_DIRECT_AI_PROVIDER:${relativeFile}:adapter.generate`);
      }
      if (!aiRoutingFile && callee?.type === "Identifier" && callee.name === "fetch") {
        const target = arguments_[0];
        const resolvedTargets = target
          ? possibleStaticUrls(target, bindingWrites, pathByNode)
          : { values: new Set(), unknown: true, truncated: false };
        const providerTarget = [...resolvedTargets.values].find((value) =>
          directProviderRoutePattern.test(value),
        );
        if (
          target &&
          (containsProviderEnvironment(target, bindingWrites, pathByNode) ||
            providerTarget !== undefined ||
            resolvedTargets.truncated)
        ) {
          findings.push(
            `BOUNDARY_DIRECT_AI_PROVIDER:${relativeFile}:${providerTarget ?? "dynamic-provider-http"}`,
          );
        }
      }
    }
    if (!aiRoutingFile && node.type === "ImportDeclaration") {
      for (const specifier of node.specifiers) {
        const imported = specifier.type === "ImportSpecifier" ? specifier.imported : undefined;
        const importedName =
          imported?.type === "Identifier"
            ? imported.name
            : imported?.type === "StringLiteral"
              ? imported.value
              : undefined;
        if (["FakeAiProviderAdapter", "OpenAiCompatibleAdapter"].includes(importedName)) {
          findings.push(`BOUNDARY_DIRECT_AI_PROVIDER:${relativeFile}:public-adapter`);
        }
      }
    }
  };
  walk(sourceFile, visit);
  return findings;
}

function isAiRoutingFile(filePath) {
  const normalized = logicalSourcePath(filePath);
  return normalized === "packages/ai-routing" || normalized.startsWith("packages/ai-routing/");
}

const arguments_ = process.argv.slice(2);
const rootIndex = arguments_.indexOf("--root");
const rootArgument = rootIndex < 0 ? undefined : arguments_[rootIndex + 1];
if (rootIndex >= 0 && (!rootArgument || arguments_.length !== 2)) {
  throw new Error("Usage: validate-boundaries.mjs [--root <directory>]");
}
scanRoot = rootArgument ? path.resolve(repositoryRoot, rootArgument) : repositoryRoot;

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
  violations.push(...inspectAst(filePath, source));
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`BOUNDARIES VALID: ${files.length} source files`);
}
