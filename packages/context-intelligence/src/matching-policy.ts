import type { ProjectAnchor } from "@evaluation/contracts";

export type ProjectMatchReason =
  | "COMPETING_PROJECTS"
  | "CONFLICTING_ANCHORS"
  | "INSUFFICIENT_INDEPENDENT_ANCHORS"
  | "MODEL_CONFIDENCE_IS_NOT_AN_ANCHOR"
  | "NO_ACCESSIBLE_PROJECTS"
  | "NO_PROJECT_CANDIDATES"
  | "STALE_MAPPING";

export type ProjectAnchorSignal = Readonly<{
  anchor: ProjectAnchor;
  current: boolean;
}>;

export type ProjectCandidate = Readonly<{
  projectId: string;
  accessible: boolean;
  anchors: readonly ProjectAnchorSignal[];
  modelConfidence?: number;
}>;

export type LinkDecision =
  | { kind: "AUTO_LINK"; projectId: string; anchors: ProjectAnchor[] }
  | { kind: "REVIEW"; candidates: ProjectCandidate[]; reasons: string[] }
  | { kind: "NO_MATCH"; reasons: string[] };

export function decideProjectLink(candidates: readonly ProjectCandidate[]): LinkDecision {
  if (candidates.length === 0) {
    return { kind: "NO_MATCH", reasons: ["NO_PROJECT_CANDIDATES"] };
  }

  const accessible = candidates.filter(({ accessible: canAccess }) => canAccess);
  if (accessible.length === 0) {
    return { kind: "NO_MATCH", reasons: ["NO_ACCESSIBLE_PROJECTS"] };
  }

  const eligible = accessible.filter(isEligibleForAutomaticLink);
  if (eligible.length > 1) {
    return {
      kind: "REVIEW",
      candidates: [...accessible],
      reasons: ["COMPETING_PROJECTS"],
    };
  }
  if (eligible.length === 1) {
    const match = eligible[0]!;
    return {
      kind: "AUTO_LINK",
      projectId: match.projectId,
      anchors: match.anchors
        .filter(({ anchor, current }) => current && !anchor.conflicts)
        .map(({ anchor }) => anchor),
    };
  }

  return {
    kind: "REVIEW",
    candidates: [...accessible],
    reasons: rejectionReasons(accessible),
  };
}

function isEligibleForAutomaticLink(candidate: ProjectCandidate): boolean {
  const current = candidate.anchors.filter(({ current }) => current);
  if (current.some(({ anchor }) => anchor.conflicts)) return false;
  if (current.some(({ anchor }) => anchor.kind === "EXPLICIT_USER_MAPPING")) return true;
  return new Set(current.map(({ anchor }) => anchor.kind)).size >= 2;
}

function rejectionReasons(candidates: readonly ProjectCandidate[]): ProjectMatchReason[] {
  const hasConflict = candidates.some(({ anchors }) =>
    anchors.some(({ anchor, current }) => current && anchor.conflicts),
  );
  const hasStaleMapping = candidates.some(({ anchors }) =>
    anchors.some(({ anchor, current }) => !current && anchor.kind === "EXPLICIT_USER_MAPPING"),
  );
  if (hasConflict || hasStaleMapping) {
    const reasons: ProjectMatchReason[] = [];
    if (hasConflict) reasons.push("CONFLICTING_ANCHORS");
    if (hasStaleMapping) reasons.push("STALE_MAPPING");
    return reasons;
  }

  const hasCurrentAnchor = candidates.some(({ anchors }) => anchors.some(({ current }) => current));
  const hasModelConfidence = candidates.some(
    ({ modelConfidence }) => modelConfidence !== undefined,
  );
  return !hasCurrentAnchor && hasModelConfidence
    ? ["MODEL_CONFIDENCE_IS_NOT_AN_ANCHOR"]
    : ["INSUFFICIENT_INDEPENDENT_ANCHORS"];
}
