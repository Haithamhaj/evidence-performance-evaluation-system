import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { parse } from "@babel/eslint-parser";

const featureRoots = ["apps/web/src", "packages/ui/src"];
const accessibleStringAttributes = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "placeholder",
  "title",
]);
const englishWordPattern = /[A-Za-z]{2,}/u;

async function collectFeatureFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFeatureFiles(fullPath)));
    } else if (/\.(?:ts|tsx)$/u.test(entry.name) && !/\.(?:test|spec)\./u.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function normalizeVisibleText(value) {
  return value.replace(/\s+/gu, " ").trim();
}

function lineAndColumn(source, position) {
  const before = source.slice(0, position);
  const lines = before.split("\n");
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

function inspectFile(source, filePath) {
  const findings = [];

  function report(position, value) {
    const text = normalizeVisibleText(value);
    if (text.length === 0 || !englishWordPattern.test(text)) {
      return;
    }

    findings.push({ file: filePath, text, ...lineAndColumn(source, position) });
  }

  const program = parse(source, {
    requireConfigFile: false,
    filePath,
    babelOptions: {
      parserOpts: { plugins: ["jsx"] },
      presets: ["@babel/preset-typescript"],
    },
  });

  function directStaticString(node) {
    if (
      node !== null &&
      typeof node === "object" &&
      ["Literal", "StringLiteral"].includes(node.type) &&
      typeof node.value === "string"
    ) {
      return node.value;
    }

    if (
      node?.type === "TemplateLiteral" &&
      node.expressions.length === 0 &&
      node.quasis.length === 1
    ) {
      return node.quasis[0]?.value?.cooked;
    }

    return undefined;
  }

  const scopeByNode = new WeakMap();

  function createScope(parent, kind) {
    return { bindings: new Map(), kind, parent };
  }

  const programScope = createScope(undefined, "program");
  scopeByNode.set(program, programScope);

  function isFunction(node) {
    return ["ArrowFunctionExpression", "FunctionDeclaration", "FunctionExpression"].includes(
      node?.type,
    );
  }

  function declarePattern(pattern, scope, value) {
    if (pattern?.type === "Identifier") {
      scope.bindings.set(pattern.name, { value });
      return;
    }
    if (pattern?.type === "AssignmentPattern") {
      declarePattern(pattern.left, scope, value);
      return;
    }
    if (pattern?.type === "RestElement") {
      declarePattern(pattern.argument, scope, value);
      return;
    }
    if (pattern?.type === "ArrayPattern") {
      for (const element of pattern.elements) declarePattern(element, scope, value);
      return;
    }
    if (pattern?.type === "ObjectPattern") {
      for (const property of pattern.properties) {
        if (property.type === "RestElement") {
          declarePattern(property.argument, scope, value);
        } else {
          declarePattern(property.value, scope, value);
        }
      }
    }
  }

  function nearestFunctionOrProgramScope(scope) {
    let current = scope;
    while (current.kind === "block") current = current.parent;
    return current;
  }

  function collectBindings(node, inheritedScope) {
    if (node === null || typeof node !== "object") return;

    let scope = inheritedScope;
    if (node !== program && isFunction(node)) {
      if (node.type === "FunctionDeclaration") {
        declarePattern(node.id, scope, undefined);
      }
      scope = createScope(scope, "function");
      scopeByNode.set(node, scope);
      if (node.type === "FunctionExpression") declarePattern(node.id, scope, undefined);
      for (const parameter of node.params) declarePattern(parameter, scope, undefined);
    } else if (node.type === "BlockStatement") {
      scope = createScope(scope, "block");
      scopeByNode.set(node, scope);
    }

    if (node.type === "VariableDeclaration") {
      const declarationScope = node.kind === "var" ? nearestFunctionOrProgramScope(scope) : scope;
      for (const declaration of node.declarations) {
        const value = node.kind === "const" ? directStaticString(declaration.init) : undefined;
        declarePattern(declaration.id, declarationScope, value);
      }
    } else if (node.type === "ClassDeclaration") {
      declarePattern(node.id, scope, undefined);
    } else if (node.type === "ImportDeclaration") {
      for (const specifier of node.specifiers) declarePattern(specifier.local, scope, undefined);
    }

    for (const [key, value] of Object.entries(node)) {
      if (["comments", "errors", "loc", "tokens"].includes(key)) continue;
      if (Array.isArray(value)) {
        for (const child of value) collectBindings(child, scope);
      } else if (value !== null && typeof value === "object" && "type" in value) {
        collectBindings(value, scope);
      }
    }
  }

  collectBindings(program, programScope);

  function staticString(node, scope) {
    const direct = directStaticString(node);
    if (direct !== undefined) return direct;
    if (node?.type === "Identifier") {
      let current = scope;
      while (current !== undefined) {
        if (current.bindings.has(node.name)) return current.bindings.get(node.name).value;
        current = current.parent;
      }
    }
    return undefined;
  }

  function propertyName(node) {
    if (node?.computed) return undefined;
    if (node?.key?.type === "Identifier") return node.key.name;
    return directStaticString(node?.key);
  }

  function isCreateElement(node) {
    if (node?.type === "Identifier") return node.name === "createElement";
    return (
      node?.type === "MemberExpression" &&
      !node.computed &&
      node.object?.type === "Identifier" &&
      node.object.name === "React" &&
      node.property?.type === "Identifier" &&
      node.property.name === "createElement"
    );
  }

  function visit(node, parent, inheritedScope) {
    if (node === null || typeof node !== "object") {
      return;
    }

    const scope = scopeByNode.get(node) ?? inheritedScope;

    if (node.type === "JSXText") {
      report(node.start ?? 0, node.value ?? "");
    } else if (node.type === "JSXExpressionContainer" && parent?.type !== "JSXAttribute") {
      const value = staticString(node.expression, scope);
      if (value !== undefined) {
        report(node.start ?? 0, value);
      }
    } else if (node.type === "JSXAttribute" && accessibleStringAttributes.has(node.name?.name)) {
      const value =
        node.value?.type === "JSXExpressionContainer"
          ? staticString(node.value.expression, scope)
          : staticString(node.value, scope);
      if (value !== undefined) {
        report(node.start ?? 0, value);
      }
    } else if (node.type === "CallExpression" && isCreateElement(node.callee)) {
      const properties =
        node.arguments[1]?.type === "ObjectExpression" ? node.arguments[1].properties : [];
      for (const property of properties) {
        if (property.type !== "ObjectProperty" && property.type !== "Property") continue;
        const name = propertyName(property);
        if (name !== "children" && !accessibleStringAttributes.has(name)) continue;
        const value = staticString(property.value, scope);
        if (value !== undefined) report(property.start ?? node.start ?? 0, value);
      }

      for (const child of node.arguments.slice(2)) {
        const value = staticString(child, scope);
        if (value !== undefined) report(child.start ?? node.start ?? 0, value);
      }
    }

    for (const [key, value] of Object.entries(node)) {
      if (["comments", "errors", "loc", "tokens"].includes(key)) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const child of value) {
          visit(child, node, scope);
        }
      } else if (value !== null && typeof value === "object" && "type" in value) {
        visit(value, node, scope);
      }
    }
  }

  visit(program, undefined, programScope);
  return findings;
}

export async function findHardcodedUserVisibleCopy(repositoryRoot = process.cwd()) {
  const files = (
    await Promise.all(
      featureRoots.map((root) => collectFeatureFiles(path.join(repositoryRoot, root))),
    )
  ).flat();
  const findings = [];

  for (const filePath of files.sort()) {
    const source = await readFile(filePath, "utf8");
    findings.push(...inspectFile(source, path.relative(repositoryRoot, filePath)));
  }

  return findings;
}

async function main() {
  const findings = await findHardcodedUserVisibleCopy();
  if (findings.length === 0) {
    process.stdout.write("User-visible copy check passed.\n");
    return;
  }

  for (const finding of findings) {
    process.stderr.write(
      `${finding.file}:${finding.line}:${finding.column} hardcoded user-visible copy: ${finding.text}\n`,
    );
  }
  process.exitCode = 1;
}

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
