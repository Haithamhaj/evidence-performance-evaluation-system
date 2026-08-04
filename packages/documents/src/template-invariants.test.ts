import {
  PROJECT_PROTECTED_SECTION_KEYS,
  WORKSTREAM_REQUIRED_SECTION_KEYS,
} from "@evaluation/contracts";
import { describe, expect, it } from "vitest";

import { assertActivatableTemplate } from "./template-invariants.js";

function sections(
  keys: readonly string[],
  options: Readonly<{ protected: boolean; required: boolean }> = {
    protected: false,
    required: true,
  },
): import("@evaluation/contracts").DocumentTemplateSectionInput[] {
  return keys.map((key, index) => ({
    key,
    position: index + 1,
    display: { en: { title: key.replaceAll("_", " ") } },
    ...options,
  }));
}

describe("document template activation invariants", () => {
  it("accepts all six protected project sections plus optional extensions", () => {
    expect(() =>
      assertActivatableTemplate("project", [
        ...sections(PROJECT_PROTECTED_SECTION_KEYS, { protected: true, required: true }),
        ...sections(["optional_risks"], { protected: false, required: false }).map((section) => ({
          ...section,
          position: 7,
        })),
      ]),
    ).not.toThrow();
  });

  it.each(PROJECT_PROTECTED_SECTION_KEYS)("rejects missing project key %s", (missing) => {
    const input = sections(
      PROJECT_PROTECTED_SECTION_KEYS.filter((key) => key !== missing),
      { protected: true, required: true },
    );
    expect(() => assertActivatableTemplate("project", input)).toThrowError(
      expect.objectContaining({ code: "DOCUMENT_TEMPLATE_INVALID" }),
    );
  });

  it("rejects making a protected project section optional or unprotected", () => {
    const input = sections(PROJECT_PROTECTED_SECTION_KEYS, {
      protected: true,
      required: true,
    });
    input[0] = { ...input[0]!, required: false };
    expect(() => assertActivatableTemplate("project", input)).toThrow();
    input[0] = { ...input[0]!, required: true, protected: false };
    expect(() => assertActivatableTemplate("project", input)).toThrow();
  });

  it("requires all nine workstream sections without inventing protected status", () => {
    const input = sections(WORKSTREAM_REQUIRED_SECTION_KEYS);
    expect(() => assertActivatableTemplate("workstream", input)).not.toThrow();
    expect(() => assertActivatableTemplate("workstream", input.slice(1))).toThrowError(
      expect.objectContaining({ code: "DOCUMENT_TEMPLATE_INVALID" }),
    );
  });

  it("rejects duplicate stable keys and positions", () => {
    const input = sections(PROJECT_PROTECTED_SECTION_KEYS, {
      protected: true,
      required: true,
    });
    expect(() =>
      assertActivatableTemplate("project", [...input, { ...input[0]!, position: 7 }]),
    ).toThrow();
    expect(() =>
      assertActivatableTemplate("project", [...input, { ...input[0]!, key: "other" }]),
    ).toThrow();
  });
});
