import { describe, expect, it } from "vitest";

import {
  CODEX_DOGFOOD_PULL_REQUEST_NUMBER,
  CODEX_DOGFOOD_SOURCE_PATHS,
  buildCodexDogfoodEvaluationEvidenceReferences,
  resolveCodexDogfoodPullRequestLineage,
} from "./codex-dogfood-runtime.js";

describe("Codex dogfood Project Document source", () => {
  it("uses only the current approved v7 document and current Phase 1 Pull Request", () => {
    expect(CODEX_DOGFOOD_SOURCE_PATHS).toEqual([
      "docs/product/CODEX_DOGFOOD_PROJECT_DOCUMENT_V7.md",
    ]);
    expect(CODEX_DOGFOOD_PULL_REQUEST_NUMBER).toBe("30");
  });
});

describe("Codex dogfood Pull Request lineage runtime", () => {
  it("exposes a deterministic Pull Request lineage resolver", () => {
    expect(resolveCodexDogfoodPullRequestLineage).toBeTypeOf("function");
  });

  it("reads exact Pull Request #30 base and head commits from read-only GitHub metadata", () => {
    const calls: Array<{ file: string; args: readonly string[] }> = [];
    const expected = {
      pullRequestRef:
        "https://github.com/Haithamhaj/evidence-performance-evaluation-system/pull/30",
      pullRequestBaseSha: "a".repeat(40),
      pullRequestHeadSha: "b".repeat(40),
    };

    const lineage = resolveCodexDogfoodPullRequestLineage({}, (file, args) => {
      calls.push({ file, args });
      return JSON.stringify({
        url: expected.pullRequestRef,
        baseRefOid: expected.pullRequestBaseSha,
        headRefOid: expected.pullRequestHeadSha,
      });
    });

    expect(lineage).toEqual(expected);
    expect(calls).toEqual([
      {
        file: "gh",
        args: [
          "pr",
          "view",
          "30",
          "--repo",
          "Haithamhaj/evidence-performance-evaluation-system",
          "--json",
          "baseRefOid,headRefOid,url",
        ],
      },
    ]);
  });

  it("accepts only a complete set of explicitly pinned and validated lineage inputs", () => {
    const expected = {
      pullRequestRef:
        "https://github.com/Haithamhaj/evidence-performance-evaluation-system/pull/30",
      pullRequestBaseSha: "c".repeat(40),
      pullRequestHeadSha: "d".repeat(40),
    };
    let commandCalled = false;

    expect(
      resolveCodexDogfoodPullRequestLineage(
        {
          CODEX_DOGFOOD_PULL_REQUEST: expected.pullRequestRef,
          CODEX_DOGFOOD_PULL_REQUEST_BASE_SHA: expected.pullRequestBaseSha,
          CODEX_DOGFOOD_PULL_REQUEST_HEAD_SHA: expected.pullRequestHeadSha,
        },
        () => {
          commandCalled = true;
          return "";
        },
      ),
    ).toEqual(expected);
    expect(commandCalled).toBe(false);

    expect(() =>
      resolveCodexDogfoodPullRequestLineage({
        CODEX_DOGFOOD_PULL_REQUEST: expected.pullRequestRef,
        CODEX_DOGFOOD_PULL_REQUEST_BASE_SHA: expected.pullRequestBaseSha,
      }),
    ).toThrow("must be provided together");
    expect(() =>
      resolveCodexDogfoodPullRequestLineage({
        ...{
          CODEX_DOGFOOD_PULL_REQUEST: expected.pullRequestRef,
          CODEX_DOGFOOD_PULL_REQUEST_BASE_SHA: "not-a-sha",
          CODEX_DOGFOOD_PULL_REQUEST_HEAD_SHA: expected.pullRequestHeadSha,
        },
      }),
    ).toThrow("exact SHA-1");
  });

  it("rejects incomplete or malformed GitHub Pull Request metadata", () => {
    for (const metadata of [
      { url: "https://github.com/Haithamhaj/evidence-performance-evaluation-system/pull/30" },
      {
        url: "https://github.com/Haithamhaj/evidence-performance-evaluation-system/pull/30",
        baseRefOid: "not-a-sha",
        headRefOid: "b".repeat(40),
      },
    ]) {
      expect(() =>
        resolveCodexDogfoodPullRequestLineage({}, () => JSON.stringify(metadata)),
      ).toThrow("exact Pull Request base/head metadata");
    }
  });

  it("stores exact commit lineage in database-safe AI evidence references", () => {
    const lineage = {
      pullRequestRef:
        "https://github.com/Haithamhaj/evidence-performance-evaluation-system/pull/30",
      pullRequestBaseSha: "a".repeat(40),
      pullRequestHeadSha: "b".repeat(40),
    };

    expect(
      buildCodexDogfoodEvaluationEvidenceReferences({
        commitSha: "c".repeat(40),
        ...lineage,
      }),
    ).toEqual([
      `repository-commit:${"c".repeat(40)}`,
      "pull-request:79766686b6a1273fa8faeb1544b550ef5c52ad8fd887642a3076633537557617",
      `pull-request-base:${"a".repeat(40)}`,
      `pull-request-head:${"b".repeat(40)}`,
    ]);
  });
});
