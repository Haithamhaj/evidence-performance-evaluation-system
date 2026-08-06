import { describe, expect, it } from "vitest";

import {
  DEFAULT_RESEARCH_SOURCE_POLICY,
  loadResearchSourcePolicy,
  validateResearchSourcePolicy,
} from "./source-config.js";

describe("research source policy configuration", () => {
  it("uses the exact bounded defaults when no override is present", () => {
    expect(loadResearchSourcePolicy({})).toEqual(DEFAULT_RESEARCH_SOURCE_POLICY);
  });

  it("accepts only policy values that narrow the bounded defaults", () => {
    expect(
      loadResearchSourcePolicy({
        RESEARCH_SOURCE_TIMEOUT_MS: "2500",
        RESEARCH_SOURCE_MAX_BYTES: "1000000",
        RESEARCH_SOURCE_MAX_TEXT_CHARS: "60000",
        RESEARCH_SOURCE_MAX_REDIRECTS: "1",
        RESEARCH_SOURCE_ALLOWED_MIME_TYPES: "text/plain,application/pdf,text/plain",
      }),
    ).toEqual({
      timeoutMs: 2_500,
      maxBytes: 1_000_000,
      maxTextChars: 60_000,
      maxRedirects: 1,
      allowedMimeTypes: ["text/plain", "application/pdf"],
    });
  });

  it.each([
    ["RESEARCH_SOURCE_TIMEOUT_MS", "10001"],
    ["RESEARCH_SOURCE_MAX_BYTES", "2000001"],
    ["RESEARCH_SOURCE_MAX_TEXT_CHARS", "120001"],
    ["RESEARCH_SOURCE_MAX_REDIRECTS", "4"],
    ["RESEARCH_SOURCE_MAX_BYTES", "0"],
    ["RESEARCH_SOURCE_TIMEOUT_MS", "1.5"],
    ["RESEARCH_SOURCE_ALLOWED_MIME_TYPES", "text/plain,text/xml"],
    ["RESEARCH_SOURCE_ALLOWED_MIME_TYPES", ""],
  ])("fails closed for unsafe %s=%s", (name, value) => {
    expect(() => loadResearchSourcePolicy({ [name]: value })).toThrowError(
      expect.objectContaining({ code: "RESEARCH_SOURCE_CONFIG_INVALID" }),
    );
  });

  it("rejects an unsafe programmatic policy instead of bypassing the hard limits", () => {
    expect(() =>
      validateResearchSourcePolicy({
        ...DEFAULT_RESEARCH_SOURCE_POLICY,
        maxBytes: 2_000_001,
      }),
    ).toThrowError(expect.objectContaining({ code: "RESEARCH_SOURCE_CONFIG_INVALID" }));
  });
});
