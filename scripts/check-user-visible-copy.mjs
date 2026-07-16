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
  const staticBindings = new Map();

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

  function collectStaticBindings(node) {
    if (node === null || typeof node !== "object") {
      return;
    }

    if (node.type === "VariableDeclaration" && node.kind === "const") {
      for (const declaration of node.declarations) {
        if (declaration.id?.type !== "Identifier") continue;
        const value = directStaticString(declaration.init);
        if (value === undefined) continue;
        const existing = staticBindings.get(declaration.id.name);
        staticBindings.set(
          declaration.id.name,
          existing === undefined ? { position: declaration.init?.start ?? 0, value } : null,
        );
      }
    }

    for (const [key, value] of Object.entries(node)) {
      if (["comments", "errors", "loc", "tokens"].includes(key)) continue;
      if (Array.isArray(value)) {
        for (const child of value) collectStaticBindings(child);
      } else if (value !== null && typeof value === "object" && "type" in value) {
        collectStaticBindings(value);
      }
    }
  }

  collectStaticBindings(program);

  function staticString(node) {
    const direct = directStaticString(node);
    if (direct !== undefined) return direct;
    if (node?.type === "Identifier") return staticBindings.get(node.name)?.value;
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

  function visit(node, parent) {
    if (node === null || typeof node !== "object") {
      return;
    }

    if (node.type === "JSXText") {
      report(node.start ?? 0, node.value ?? "");
    } else if (node.type === "JSXExpressionContainer" && parent?.type !== "JSXAttribute") {
      const value = staticString(node.expression);
      if (value !== undefined) {
        report(node.start ?? 0, value);
      }
    } else if (node.type === "JSXAttribute" && accessibleStringAttributes.has(node.name?.name)) {
      const value =
        node.value?.type === "JSXExpressionContainer"
          ? staticString(node.value.expression)
          : staticString(node.value);
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
        const value = staticString(property.value);
        if (value !== undefined) report(property.start ?? node.start ?? 0, value);
      }

      for (const child of node.arguments.slice(2)) {
        const value = staticString(child);
        if (value !== undefined) report(child.start ?? node.start ?? 0, value);
      }
    }

    for (const [key, value] of Object.entries(node)) {
      if (["comments", "errors", "loc", "tokens"].includes(key)) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const child of value) {
          visit(child, node);
        }
      } else if (value !== null && typeof value === "object" && "type" in value) {
        visit(value, node);
      }
    }
  }

  visit(program, undefined);
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
