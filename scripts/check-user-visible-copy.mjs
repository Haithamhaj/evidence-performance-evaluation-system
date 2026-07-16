import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { parse } from "@babel/eslint-parser";

const featureRoots = ["apps/web/src", "packages/ui/src"];
const accessibleStringAttributes = new Set(["alt", "aria-label", "placeholder", "title"]);
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

  function literalString(node) {
    if (
      node !== null &&
      typeof node === "object" &&
      ["Literal", "StringLiteral"].includes(node.type) &&
      typeof node.value === "string"
    ) {
      return node.value;
    }
    return undefined;
  }

  function visit(node, parent) {
    if (node === null || typeof node !== "object") {
      return;
    }

    if (node.type === "JSXText") {
      report(node.start ?? 0, node.value ?? "");
    } else if (node.type === "JSXExpressionContainer" && parent?.type !== "JSXAttribute") {
      const value = literalString(node.expression);
      if (value !== undefined) {
        report(node.start ?? 0, value);
      }
    } else if (node.type === "JSXAttribute" && accessibleStringAttributes.has(node.name?.name)) {
      const value =
        node.value?.type === "JSXExpressionContainer"
          ? literalString(node.value.expression)
          : literalString(node.value);
      if (value !== undefined) {
        report(node.start ?? 0, value);
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
