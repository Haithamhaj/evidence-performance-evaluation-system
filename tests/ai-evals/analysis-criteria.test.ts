import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { FakeAiProviderAdapter } from "../../packages/ai-routing/src/adapters/fake.js";
import {
  ComparisonAnalysisOutputSchema,
  ManagerReadinessSummarySchema,
  ReadinessAnalysisOutputSchema,
} from "../../packages/contracts/src/document-analysis.js";
import { CriteriaGenerationOutputSchema } from "../../packages/contracts/src/criteria.js";
import {
  buildComparisonRequest,
  buildReadinessRequest,
} from "../../packages/documents/src/analysis-prompts.js";
import { extractSafeSources } from "../../packages/documents/src/safe-source-extraction.js";
import { buildCriteriaGenerationRequest } from "../../packages/criteria/src/prompts.js";
import { loadFixtureSuite } from "./harness.js";
import { scanProhibitedOutput } from "./prohibited-output.js";
import {
  ALL_PROHIBITED_CONCEPTS,
  DocumentAnalysisFixtureFileSchema,
  DynamicCriteriaFixtureFileSchema,
} from "./schemas.js";

const fixtureDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");
const prompt = {
  artifactId: "55555555-5555-4555-8555-555555555555",
  sha256: "a".repeat(64),
} as const;
const extractionPolicy = {
  maxSourceBytes: 100_000,
  maxArchiveEntries: 20,
  maxArchiveUncompressedBytes: 100_000,
  maxArchiveCompressionRatio: 100,
} as const;

describe("Bundle C deterministic analysis and criteria fixtures", () => {
  it("registers and loads both strict fixture kinds", async () => {
    const manifest = JSON.parse(
      await readFile(resolve(fixtureDirectory, "manifest.json"), "utf8"),
    ) as Array<{ id: string; expectedSchemaVersion: string; inputPath: string }>;
    const suite = await loadFixtureSuite(fixtureDirectory);

    expect(manifest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "document-analysis",
          expectedSchemaVersion: "document-analysis-eval.v1",
          inputPath: "document-analysis.json",
        }),
        expect.objectContaining({
          id: "dynamic-criteria",
          expectedSchemaVersion: "dynamic-criteria-eval.v1",
          inputPath: "dynamic-criteria.json",
        }),
      ]),
    );
    expect(suite.documentAnalysisFixtures).not.toBeNull();
    expect(suite.dynamicCriteriaFixtures).not.toBeNull();
  });

  it("rejects unknown fields in both fixture contracts", async () => {
    const documentFixture = await readJson("document-analysis.json");
    const criteriaFixture = await readJson("dynamic-criteria.json");
    const documentWithUnknownCaseField = structuredClone(documentFixture);
    const criteriaWithUnknownTopLevelField = structuredClone(criteriaFixture);

    asRecord(asArray(asRecord(documentWithUnknownCaseField).cases)[0]).unknownField = true;
    asRecord(criteriaWithUnknownTopLevelField).unknownField = true;

    expect(DocumentAnalysisFixtureFileSchema.safeParse(documentWithUnknownCaseField).success).toBe(
      false,
    );
    expect(
      DynamicCriteriaFixtureFileSchema.safeParse(criteriaWithUnknownTopLevelField).success,
    ).toBe(false);
  });

  it.each([
    ["path traversal", "../outside.json", /within the fixture root/iu],
    ["missing fixture", "missing.json", /path is missing/iu],
  ])("contains new fixture paths: %s", async (_name, inputPath, expectedError) => {
    const directory = await mkdtemp(resolve(tmpdir(), "analysis-criteria-fixtures-"));
    try {
      await writeFile(
        resolve(directory, "manifest.json"),
        JSON.stringify([
          {
            id: "document-analysis",
            version: "1.0.0",
            locale: "multi",
            dialect: "mixed",
            classification: "internal",
            provenance: "synthetic path-containment fixture; no employee data",
            inputPath,
            expectedSchemaVersion: "document-analysis-eval.v1",
            requiredSourceReferences: ["document-source:11111111-1111-4111-8111-111111111111"],
            forbiddenConcepts: ALL_PROHIBITED_CONCEPTS,
            expectedDisposition: "mixed",
          },
        ]),
      );

      await expect(loadFixtureSuite(directory)).rejects.toThrow(expectedError);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("validates readiness, comparison, and manager projections through local fake adapters", async () => {
    const suite = await loadFixtureSuite(fixtureDirectory);
    const fixture = required(suite.documentAnalysisFixtures);

    for (const testCase of fixture.cases) {
      const routeKey =
        testCase.operation === "comparison"
          ? "document.compare"
          : testCase.operation === "readiness"
            ? "document.analyze"
            : "document.manager_projection";
      const adapter = new FakeAiProviderAdapter("fake", "local", testCase.adapterOutput);
      const result = await adapter.generate(
        { routeKey, modelKey: "fixture-model", input: { fixtureId: testCase.id } },
        new AbortController().signal,
      );
      const parsed =
        testCase.operation === "comparison"
          ? ComparisonAnalysisOutputSchema.safeParse(result.output)
          : testCase.operation === "readiness"
            ? ReadinessAnalysisOutputSchema.safeParse(result.output)
            : ManagerReadinessSummarySchema.safeParse(result.output);

      expect(parsed.success, testCase.id).toBe(testCase.expectedDisposition === "allow");
      expect(adapter.requests, testCase.id).toEqual([
        expect.objectContaining({ routeKey, modelKey: "fixture-model" }),
      ]);

      if (testCase.operation === "readiness" && testCase.expectedDisposition === "allow") {
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.state).toBe(testCase.expectedState);
          expect(new Set(parsed.data.sourceReferences)).toEqual(new Set(testCase.sourceReferences));
        }
        expect(ManagerReadinessSummarySchema.safeParse(testCase.managerProjection).success).toBe(
          true,
        );
      }
      if (testCase.operation === "comparison" && parsed.success) {
        expect(parsed.data.classification).toBe(testCase.expectedClassification);
        expect([
          ...parsed.data.beforeSourceReferences,
          ...parsed.data.afterSourceReferences,
        ]).toEqual(expect.arrayContaining(testCase.sourceReferences));
      }
      if (testCase.expectedDisposition === "allow") {
        expect(scanProhibitedOutput({ value: result.output }).allowed, testCase.id).toBe(true);
      }
    }
  });

  it("extracts only supported local text, Markdown, and DOCX without fetching metadata sources", async () => {
    const suite = await loadFixtureSuite(fixtureDirectory);
    const fixture = required(suite.documentAnalysisFixtures);

    for (const testCase of fixture.cases.filter(
      (candidate) => candidate.operation === "readiness",
    )) {
      let streamOpenCount = 0;
      const sources: import("../../packages/documents/src/analysis-model.js").CanonicalSource[] =
        testCase.sources.map((source) => ({
          reference: source.reference,
          sourceType: source.sourceType,
          mediaType: source.mediaType,
          ...(source.sourceType === "upload"
            ? {
                openStream: async () => {
                  streamOpenCount += 1;
                  const bytes =
                    source.format === "docx"
                      ? docx(source.content ?? testCase.documentContent)
                      : Buffer.from(source.content ?? testCase.documentContent, "utf8");
                  return Readable.from(bytes);
                },
              }
            : {}),
        }));

      const extracted = await extractSafeSources({ policy: extractionPolicy, sources });

      expect(
        extracted.sources.map(({ coverage }) => coverage),
        testCase.id,
      ).toEqual(testCase.sources.map(({ expectedCoverage }) => expectedCoverage));
      expect(extracted.coverage, testCase.id).toBe(testCase.sources[0]?.expectedCoverage);
      expect(streamOpenCount, testCase.id).toBe(
        testCase.sources.filter(
          ({ sourceType, format }) =>
            sourceType === "upload" && ["text", "markdown", "docx"].includes(format),
        ).length,
      );
    }
  });

  it("keeps document and comparison injection text inside explicit untrusted boundaries", async () => {
    const suite = await loadFixtureSuite(fixtureDirectory);
    const cases = required(suite.documentAnalysisFixtures).cases;
    const readiness = cases.find(({ id }) => id === "document-content-prompt-injection");
    const comparison = cases.find(({ id }) => id === "comparison-prompt-injection");

    expect(readiness?.operation).toBe("readiness");
    expect(comparison?.operation).toBe("comparison");
    if (readiness?.operation !== "readiness" || comparison?.operation !== "comparison") return;

    const readinessRequest = buildReadinessRequest({
      prompt,
      templateSections: [{ key: "objective", required: true, protected: false }],
      sources: readiness.sources.map((source) => ({
        reference: source.reference,
        mediaType: source.mediaType,
        contentBase64: Buffer.from(source.content ?? readiness.documentContent).toString("base64"),
      })),
    });
    const comparisonRequest = buildComparisonRequest({
      prompt,
      before: {
        documentVersionId: "66666666-6666-4666-8666-666666666666",
        sources: [encodedSource(comparison.sourceReferences[0]!, comparison.beforeContent)],
      },
      after: {
        documentVersionId: "77777777-7777-4777-8777-777777777777",
        sources: [encodedSource(comparison.sourceReferences[1]!, comparison.afterContent)],
      },
    });

    expect(readinessRequest.untrustedContent.document).toMatchObject({
      begin: "BEGIN_UNTRUSTED_DOCUMENT",
      end: "END_UNTRUSTED_DOCUMENT",
    });
    expect(comparisonRequest.untrustedContent.before).toMatchObject({
      begin: "BEGIN_UNTRUSTED_DOCUMENT_BEFORE",
      end: "END_UNTRUSTED_DOCUMENT_BEFORE",
    });
    expect(comparisonRequest.untrustedContent.after).toMatchObject({
      begin: "BEGIN_UNTRUSTED_DOCUMENT_AFTER",
      end: "END_UNTRUSTED_DOCUMENT_AFTER",
    });
    expect(JSON.stringify(readinessRequest.trustedInstruction)).not.toContain("recommend rating");
    expect(JSON.stringify(comparisonRequest.trustedInstruction)).not.toContain("employeeRank");
    expect(
      Buffer.from(
        readinessRequest.untrustedContent.document.sources[0]!.contentBase64,
        "base64",
      ).toString("utf8"),
    ).toContain("recommend rating");
    expect(
      Buffer.from(
        comparisonRequest.untrustedContent.after.sources[0]!.contentBase64,
        "base64",
      ).toString("utf8"),
    ).toContain("employeeRank");
  });

  it("enforces kind-specific criterion counts, strict schemas, and prohibited-output fields", async () => {
    const suite = await loadFixtureSuite(fixtureDirectory);
    const fixture = required(suite.dynamicCriteriaFixtures);

    for (const testCase of fixture.cases) {
      const routeKey = `criteria.generate.${testCase.kind}`;
      const adapter = new FakeAiProviderAdapter("fake", "local", testCase.adapterOutput);
      const result = await adapter.generate(
        { routeKey, modelKey: "fixture-model", input: { fixtureId: testCase.id } },
        new AbortController().signal,
      );
      const schemaResult = CriteriaGenerationOutputSchema.safeParse(result.output);
      const criteriaCount = schemaResult.success ? schemaResult.data.criteria.length : null;
      const countValid =
        criteriaCount !== null &&
        (testCase.kind === "project"
          ? criteriaCount >= 1 && criteriaCount <= 3
          : criteriaCount >= 2 && criteriaCount <= 3);
      const prohibitedKeys = collectProhibitedKeys(result.output);
      const allowed = schemaResult.success && countValid && prohibitedKeys.length === 0;

      expect(allowed, testCase.id).toBe(testCase.expectedDisposition === "allow");
      expect(adapter.requests, testCase.id).toEqual([
        expect.objectContaining({ routeKey, modelKey: "fixture-model" }),
      ]);
      if (testCase.expectedDisposition === "allow" && schemaResult.success) {
        expect(schemaResult.data.criteria).toHaveLength(testCase.expectedCount!);
        expect(prohibitedKeys, testCase.id).toEqual([]);
        expect(scanProhibitedOutput({ value: result.output }).allowed, testCase.id).toBe(true);
        for (const criterion of schemaResult.data.criteria) {
          expect(testCase.sourceReferences).toEqual(
            expect.arrayContaining(criterion.sourceReferences),
          );
        }
      }
      if (
        testCase.expectedDisposition === "reject" &&
        ["rating", "ranking", "productivity", "automatic_average"].includes(
          testCase.expectedViolation ?? "",
        )
      ) {
        expect(prohibitedKeys.length, testCase.id).toBeGreaterThan(0);
      }
    }
  });

  it("keeps owner feedback untrusted and excludes objections from generation input", async () => {
    const suite = await loadFixtureSuite(fixtureDirectory);
    const cases = required(suite.dynamicCriteriaFixtures).cases;
    const feedback = cases.find(({ id }) => id === "owner-feedback-prompt-injection");
    const objection = cases.find(({ id }) => id === "objection-prompt-injection");

    expect(feedback).toBeDefined();
    expect(objection).toBeDefined();
    if (feedback === undefined || objection === undefined) return;

    const request = buildCriteriaGenerationRequest({
      kind: feedback.kind,
      prompt,
      documentSources: [encodedSource(feedback.sourceReferences[0]!, feedback.documentContent)],
      readinessSourceReferences: feedback.sourceReferences.slice(1),
      ownerFeedback: feedback.ownerFeedback,
    });

    expect(request.input.untrustedContent.ownerFeedback).toMatchObject({
      begin: "BEGIN_UNTRUSTED_OWNER_FEEDBACK",
      value: feedback.ownerFeedback,
      end: "END_UNTRUSTED_OWNER_FEEDBACK",
    });
    expect(JSON.stringify(request.input.trustedInstruction)).not.toContain("recommendedRating");
    expect(JSON.stringify(request)).not.toContain(objection.objectionText);
    expect(JSON.stringify(objection.adapterOutput)).not.toContain(objection.objectionText);
  });
});

async function readJson(filename: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(fixtureDirectory, filename), "utf8")) as unknown;
}

function required<T>(value: T | null): T {
  if (value === null) throw new Error("Expected fixture registration");
  return value;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected object fixture");
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Expected array fixture");
  return value;
}

function encodedSource(reference: string, content: string) {
  return {
    reference,
    mediaType: "text/plain",
    contentBase64: Buffer.from(content, "utf8").toString("base64"),
  };
}

function collectProhibitedKeys(value: unknown): string[] {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(collectProhibitedKeys);
  return Object.entries(value).flatMap(([key, child]) => {
    const normalized = key.replace(/[^a-z0-9]/giu, "").toLowerCase();
    const prohibited =
      /^(?:suggested|recommended|predicted)(?:performance)?rating$/u.test(normalized) ||
      /^(?:employee)?(?:rank|ranking|leaderboardposition)$/u.test(normalized) ||
      /^productivity(?:score|grade|index|rating)$/u.test(normalized) ||
      /^(?:automatic|project|workstream|criterion)average$/u.test(normalized);
    return [...(prohibited ? [key] : []), ...collectProhibitedKeys(child)];
  });
}

function docx(text: string): Buffer {
  const escaped = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return zip([
    {
      name: "[Content_Types].xml",
      data: Buffer.from(
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
      ),
    },
    {
      name: "word/document.xml",
      data: Buffer.from(
        `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${escaped}</w:t></w:r></w:p></w:body></w:document>`,
      ),
    },
  ]);
}

function zip(entries: ReadonlyArray<Readonly<{ name: string; data: Buffer }>>): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const compressed = deflateRawSync(entry.data);
    const checksum = crc32(entry.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, compressed);

    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(8, 10);
    directory.writeUInt32LE(checksum, 16);
    directory.writeUInt32LE(compressed.length, 20);
    directory.writeUInt32LE(entry.data.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBytes, end]);
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
