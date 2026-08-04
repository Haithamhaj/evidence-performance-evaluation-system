import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Phase 2 acceptance data language", () => {
  it("keeps the English-pilot synthetic workspace fully English", () => {
    const seed = readFileSync(resolve("scripts/seed-phase-2-demo.ts"), "utf8");

    expect(seed).not.toMatch(/[\u0600-\u06ff]/u);
  });
});
