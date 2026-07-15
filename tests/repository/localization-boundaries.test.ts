import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("localization package boundaries", () => {
  it("keeps Node-only hashing outside the browser-facing root export", async () => {
    const [packageJson, rootSource, nodeHashSource] = await Promise.all([
      readFile("packages/localization/package.json", "utf8"),
      readFile("packages/localization/src/index.ts", "utf8"),
      readFile("packages/localization/src/rubric/source-hash.ts", "utf8"),
    ]);

    expect(JSON.parse(packageJson).exports).toEqual({ ".": "./src/index.ts" });
    expect(rootSource).not.toMatch(/source-hash|node:(?:crypto|fs)/u);
    expect(nodeHashSource).toMatch(/node:crypto/u);
    expect(nodeHashSource).toMatch(/node:fs\/promises/u);
  });
});
