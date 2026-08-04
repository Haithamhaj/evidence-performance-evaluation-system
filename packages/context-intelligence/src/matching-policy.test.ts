import { describe, expect, it } from "vitest";

import { decideProjectLink } from "./matching-policy.js";

type ProjectAnchor = import("@evaluation/contracts").ProjectAnchor;
type ProjectAnchorSignal = import("./matching-policy.js").ProjectAnchorSignal;
type ProjectCandidate = import("./matching-policy.js").ProjectCandidate;

const projectA = "00000000-0000-4000-8000-000000000101";
const projectB = "00000000-0000-4000-8000-000000000102";
const projectC = "00000000-0000-4000-8000-000000000103";

function anchor(
  kind: ProjectAnchor["kind"],
  options: Readonly<{ conflicts?: boolean; current?: boolean }> = {},
): ProjectAnchorSignal {
  return {
    anchor: {
      kind,
      reference: `source-item:00000000-0000-4000-8000-${kind.length.toString().padStart(12, "0")}`,
      conflicts: options.conflicts ?? false,
    },
    current: options.current ?? true,
  };
}

function candidate(
  projectId: string,
  anchors: readonly ProjectAnchorSignal[],
  options: Readonly<{ accessible?: boolean; modelConfidence?: number }> = {},
): ProjectCandidate {
  return {
    projectId,
    accessible: options.accessible ?? true,
    anchors,
    ...(options.modelConfidence === undefined ? {} : { modelConfidence: options.modelConfidence }),
  };
}

describe("decideProjectLink rejection-first policy", () => {
  it("keeps conflicting anchors in employee review even when two clean anchors also agree", () => {
    const input = candidate(projectA, [
      anchor("CONFIRMED_SENDER_DOMAIN"),
      anchor("EXPLICIT_PROJECT_REFERENCE"),
      anchor("CALENDAR_CONTEXT", { conflicts: true }),
    ]);

    expect(decideProjectLink([input])).toEqual({
      kind: "REVIEW",
      candidates: [input],
      reasons: ["CONFLICTING_ANCHORS"],
    });
  });

  it("keeps one weak anchor in employee review", () => {
    const input = candidate(projectA, [anchor("CONFIRMED_SENDER_DOMAIN")]);

    expect(decideProjectLink([input])).toEqual({
      kind: "REVIEW",
      candidates: [input],
      reasons: ["INSUFFICIENT_INDEPENDENT_ANCHORS"],
    });
  });

  it("does not auto-link from a stale explicit employee mapping", () => {
    const input = candidate(projectA, [anchor("EXPLICIT_USER_MAPPING", { current: false })]);

    expect(decideProjectLink([input])).toEqual({
      kind: "REVIEW",
      candidates: [input],
      reasons: ["STALE_MAPPING"],
    });
  });

  it("keeps a stale mapping in review when two other current anchors agree", () => {
    const input = candidate(projectA, [
      anchor("EXPLICIT_USER_MAPPING", { current: false }),
      anchor("CALENDAR_CONTEXT"),
      anchor("EXPLICIT_PROJECT_REFERENCE"),
    ]);

    expect(decideProjectLink([input])).toEqual({
      kind: "REVIEW",
      candidates: [input],
      reasons: ["STALE_MAPPING"],
    });
  });

  it("does not return inaccessible Projects as review candidates", () => {
    expect(
      decideProjectLink([
        candidate(projectA, [anchor("EXPLICIT_USER_MAPPING")], { accessible: false }),
      ]),
    ).toEqual({ kind: "NO_MATCH", reasons: ["NO_ACCESSIBLE_PROJECTS"] });
  });

  it("keeps model-only confidence in review and never treats it as an anchor", () => {
    const input = candidate(projectA, [], { modelConfidence: 0.999 });

    expect(decideProjectLink([input])).toEqual({
      kind: "REVIEW",
      candidates: [input],
      reasons: ["MODEL_CONFIDENCE_IS_NOT_AN_ANCHOR"],
    });
  });

  it("auto-links a current explicit employee mapping", () => {
    const input = candidate(projectA, [anchor("EXPLICIT_USER_MAPPING")]);

    expect(decideProjectLink([input])).toEqual({
      kind: "AUTO_LINK",
      projectId: projectA,
      anchors: input.anchors.map(({ anchor: value }) => value),
    });
  });

  it("auto-links two independent non-conflicting governed anchor kinds", () => {
    const input = candidate(projectA, [
      anchor("CALENDAR_CONTEXT"),
      anchor("EXPLICIT_PROJECT_REFERENCE"),
    ]);

    expect(decideProjectLink([input])).toEqual({
      kind: "AUTO_LINK",
      projectId: projectA,
      anchors: input.anchors.map(({ anchor: value }) => value),
    });
  });

  it("does not count duplicate anchors of one kind as independent", () => {
    const input = candidate(projectA, [
      anchor("CONFIRMED_SENDER_DOMAIN"),
      anchor("CONFIRMED_SENDER_DOMAIN"),
    ]);

    expect(decideProjectLink([input])).toEqual({
      kind: "REVIEW",
      candidates: [input],
      reasons: ["INSUFFICIENT_INDEPENDENT_ANCHORS"],
    });
  });

  it("keeps two independently eligible Projects in review", () => {
    const first = candidate(projectA, [
      anchor("CONFIRMED_SENDER_DOMAIN"),
      anchor("EXPLICIT_PROJECT_REFERENCE"),
    ]);
    const second = candidate(projectB, [
      anchor("CALENDAR_CONTEXT"),
      anchor("PRIOR_EMPLOYEE_CORRECTION"),
    ]);

    expect(decideProjectLink([first, second])).toEqual({
      kind: "REVIEW",
      candidates: [first, second],
      reasons: ["COMPETING_PROJECTS"],
    });
  });

  it("keeps a cross-Project conflict in review without disclosing inaccessible candidates", () => {
    const eligible = candidate(projectA, [
      anchor("CONFIRMED_SENDER_DOMAIN"),
      anchor("EXPLICIT_PROJECT_REFERENCE"),
    ]);
    const conflicting = candidate(projectB, [anchor("CALENDAR_CONTEXT", { conflicts: true })]);
    const inaccessible = candidate(projectC, [anchor("EXPLICIT_USER_MAPPING")], {
      accessible: false,
    });

    expect(decideProjectLink([eligible, conflicting, inaccessible])).toEqual({
      kind: "REVIEW",
      candidates: [eligible, conflicting],
      reasons: ["CONFLICTING_ANCHORS"],
    });
  });
});
