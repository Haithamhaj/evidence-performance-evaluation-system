import { describe, expect, it } from "vitest";

import {
  DeterministicResearchSourceAdapter,
  classifyExplicitResearchSource,
  interpretRetrievedResearchSource,
} from "./source-adapters.js";

describe("research source adapters", () => {
  it.each([
    ["https://github.com/acme/widgets", "GITHUB", "REPOSITORY_METADATA"],
    ["https://github.com/acme/widgets/blob/main/README.md", "GITHUB", "README"],
    ["https://github.com/acme/widgets/blob/main/LICENSE", "GITHUB", "LICENSE"],
    ["https://github.com/acme/widgets/blob/main/package.json", "GITHUB", "MANIFEST"],
    ["https://github.com/acme/widgets/blob/main/src/index.ts", "GITHUB", "SELECTED_FILE"],
    ["https://doi.org/10.1000/example", "PAPER", "CITATION_PAGE"],
    ["https://arxiv.org/abs/2401.00001", "PAPER", "ABSTRACT_PAGE"],
    ["https://example.com/guide", "GENERIC", "EXPLICIT_PAGE"],
  ] as const)("classifies %s without repository enumeration", (url, kind, label) => {
    expect(classifyExplicitResearchSource(new URL(url))).toMatchObject({ kind, label });
  });

  it("blocks a GitHub directory tree because it would require enumeration", () => {
    expect(
      classifyExplicitResearchSource(new URL("https://github.com/acme/widgets/tree/main/src")),
    ).toMatchObject({
      kind: "GITHUB",
      allowed: false,
      recoveryOptions: ["ADD_MANUAL_CITATION"],
    });
  });

  it("keeps accessible PDFs partial and offers truthful manual recovery", () => {
    expect(
      interpretRetrievedResearchSource({
        classification: classifyExplicitResearchSource(
          new URL("https://papers.example/research.pdf"),
        ),
        mimeType: "application/pdf",
        text: null,
        status: "RETRIEVED",
      }),
    ).toEqual({
      state: "PARTIAL",
      text: null,
      reason: "PDF_TEXT_NOT_EXTRACTED",
      recoveryOptions: ["UPLOAD_DOCUMENT", "ADD_MANUAL_CITATION"],
    });
  });

  it("provides a deterministic fake adapter without doing network work", async () => {
    const adapter = new DeterministicResearchSourceAdapter({
      "https://example.com/paper": {
        state: "RETRIEVED",
        title: "Stable source",
        text: "Stable text",
      },
    });

    await expect(adapter.retrieve(new URL("https://example.com/paper"))).resolves.toEqual({
      state: "RETRIEVED",
      title: "Stable source",
      text: "Stable text",
    });
    await expect(adapter.retrieve(new URL("https://example.com/missing"))).resolves.toEqual({
      state: "BLOCKED",
      title: null,
      text: null,
      reason: "DETERMINISTIC_SOURCE_NOT_FOUND",
      recoveryOptions: ["TRY_AGAIN", "ADD_MANUAL_CITATION"],
    });
  });
});
