import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const fontDirectory = path.join(repositoryRoot, "apps/web/public/fonts");

describe("self-hosted web fonts", () => {
  it.each(["NotoSansArabic-Variable.woff2", "Inter-Variable.woff2"])(
    "contains a real WOFF2 binary for %s",
    async (fileName) => {
      const font = await readFile(path.join(fontDirectory, fileName));

      expect(font.subarray(0, 4).toString("ascii")).toBe("wOF2");
      expect(font.byteLength).toBeGreaterThan(10_000);
    },
  );

  it("records font provenance and accurate license terms", async () => {
    const licenses = await readFile(path.join(fontDirectory, "LICENSES.md"), "utf8");

    expect(licenses).toContain("Noto Sans Arabic");
    expect(licenses).toContain("Inter");
    expect(licenses.match(/SIL Open Font License, Version 1\.1/g)).toHaveLength(2);
    expect(licenses).toContain("SHA-256");
    expect(licenses).toContain("Source:");
  });
});
