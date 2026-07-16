import console from "node:console";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const secretRules = [
  {
    label: "private key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g,
  },
  {
    label: "GitHub token",
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{20,255})\b/g,
  },
  {
    label: "AWS access key",
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  },
  {
    label: "OpenAI API key",
    pattern: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    label: "Slack token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  },
];

const allowedEnvironmentExamples = new Set([".env.example", ".env.test.example"]);

function sensitiveFilename(filePath) {
  const basename = path.basename(filePath);
  if (allowedEnvironmentExamples.has(basename)) return false;
  if (basename === ".env" || basename.startsWith(".env.")) return true;
  if (/\.(?:pem|key|p12|pfx)$/i.test(basename)) return true;
  return /^(?:credentials|secrets).*\.json$/i.test(basename);
}

async function repositoryFiles() {
  const { stdout } = await execFileAsync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { encoding: "buffer", maxBuffer: 20 * 1024 * 1024 },
  );
  return stdout.toString("utf8").split("\0").filter(Boolean);
}

function lineNumberAt(content, index) {
  let line = 1;
  for (let position = 0; position < index; position += 1) {
    if (content.charCodeAt(position) === 10) line += 1;
  }
  return line;
}

async function scanFile(filePath) {
  const findings = [];
  if (sensitiveFilename(filePath)) {
    findings.push({ filePath, label: "sensitive filename", line: 1 });
  }

  let buffer;
  try {
    buffer = await readFile(filePath);
  } catch (error) {
    if (error?.code === "EISDIR") return findings;
    throw error;
  }
  if (buffer.includes(0)) return findings;

  const content = buffer.toString("utf8");
  for (const rule of secretRules) {
    rule.pattern.lastIndex = 0;
    for (const match of content.matchAll(rule.pattern)) {
      findings.push({
        filePath,
        label: rule.label,
        line: lineNumberAt(content, match.index),
      });
    }
  }
  return findings;
}

const files = process.argv.length > 2 ? process.argv.slice(2) : await repositoryFiles();
const findings = (await Promise.all(files.map(scanFile))).flat();

if (findings.length > 0) {
  console.error("SECRET SCAN FAILED");
  for (const finding of findings) {
    console.error(`- ${finding.filePath}:${finding.line}: possible ${finding.label}`);
  }
  process.exitCode = 1;
} else {
  console.log(`SECRET SCAN VALID: ${files.length} files checked`);
}
