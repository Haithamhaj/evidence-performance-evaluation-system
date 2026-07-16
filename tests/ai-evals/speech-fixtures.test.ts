import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

type SpeechFixture = Readonly<{
  fixtureId: string;
  dialect: "gulf" | "levantine";
  locale: string;
  audioPath: string;
  goldenTranscript: string;
  tolerance: number;
  source: string;
  license: string;
  provenance: string;
  sha256: string;
  privacyClassification: string;
  expectedDisposition: string;
}>;

const fixtureDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("speech fixture corpus integrity", () => {
  it("verifies Gulf and Levantine files, checksums, provenance, and manifest registration", async () => {
    const [goldenRaw, manifestRaw, provenance] = await Promise.all([
      readFile(resolve(fixtureDirectory, "audio/speech-golden.json"), "utf8"),
      readFile(resolve(fixtureDirectory, "manifest.json"), "utf8"),
      readFile(resolve(fixtureDirectory, "audio/PROVENANCE.md"), "utf8"),
    ]);
    const fixtures = JSON.parse(goldenRaw) as SpeechFixture[];
    const manifest = JSON.parse(manifestRaw) as Array<{ id: string; inputPath: string }>;

    expect(fixtures).toHaveLength(2);
    expect(new Set(fixtures.map(({ dialect }) => dialect))).toEqual(new Set(["gulf", "levantine"]));

    for (const fixture of fixtures) {
      expect(Object.keys(fixture).sort()).toEqual(
        [
          "fixtureId",
          "dialect",
          "locale",
          "audioPath",
          "goldenTranscript",
          "tolerance",
          "source",
          "license",
          "provenance",
          "sha256",
          "privacyClassification",
          "expectedDisposition",
        ].sort(),
      );
      expect(fixture.goldenTranscript.trim()).not.toBe("");
      expect(Number.isFinite(fixture.tolerance)).toBe(true);
      expect(fixture.tolerance).toBeGreaterThanOrEqual(0);
      expect(fixture.source.trim()).not.toBe("");
      expect(fixture.license.trim()).not.toBe("");
      expect(fixture.provenance.trim()).not.toBe("");
      expect(fixture.privacyClassification).toBe("synthetic_non_personal");
      expect(fixture.expectedDisposition).toBe("integrity_only");

      const audio = await readFile(resolve(fixtureDirectory, fixture.audioPath));
      expect(audio.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(audio.subarray(8, 12).toString("ascii")).toBe("WAVE");
      expect(createHash("sha256").update(audio).digest("hex")).toBe(fixture.sha256);
      expect(manifest).toContainEqual(
        expect.objectContaining({ id: fixture.fixtureId, inputPath: fixture.audioPath }),
      );
      expect(provenance).toContain(fixture.fixtureId);
      expect(provenance).toContain(fixture.sha256);
    }

    expect(provenance).toContain("No real employee data");
    expect(provenance).toContain("Phase 0 validates corpus integrity only");
  });
});
