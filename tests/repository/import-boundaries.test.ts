import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(file);
      return /\.(?:ts|tsx|js|mjs)$/u.test(entry.name) ? [file] : [];
    }),
  );
  return files.flat();
}

describe("audit import boundaries", () => {
  it("defines the lower-level framework-neutral AuditWriter contract", async () => {
    const source = await readFile("packages/contracts/src/audit-writer.ts", "utf8");
    expect(source).toContain("interface AuditWriter<TTransaction>");
    expect(source).not.toMatch(/@evaluation\/(?:audit|database)/u);
  });

  it("never lets the database package import the audit implementation", async () => {
    const files = await sourceFiles("packages/database");
    const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
    expect(sources.join("\n")).not.toMatch(/from\s+["']@evaluation\/audit/u);
  });

  it("keeps the seed composition above both database and audit packages", async () => {
    const [databaseSeed, composition] = await Promise.all([
      readFile("packages/database/src/seed-pilot.ts", "utf8"),
      readFile("scripts/seed-pilot.ts", "utf8"),
    ]);
    expect(databaseSeed).not.toContain("@evaluation/audit");
    expect(composition).toContain("@evaluation/database");
    expect(composition).toContain("@evaluation/audit");
  });
});
