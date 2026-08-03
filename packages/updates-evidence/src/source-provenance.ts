import { AppError } from "@evaluation/contracts";

type Provenance = import("@evaluation/contracts").TimelineItem["sourceProvenance"];

export function timelineSourceProvenance(sourceKinds: readonly string[]): Provenance {
  const provenances = new Set<Provenance>();
  for (const kind of sourceKinds) provenances.add(provenanceForKind(kind));
  if (provenances.size === 0) throw invalidSource();
  if (provenances.size > 1) return "employee_mixed";
  return [...provenances][0]!;
}

function provenanceForKind(kind: string): Provenance {
  if (kind === "github_automated") return "github_automated";
  if (kind === "human_decision") return "human_decision";
  if (kind === "pasted_text") return "employee_text";
  if (kind === "voice_transcript") return "employee_voice";
  if (["image", "screenshot", "file", "document"].includes(kind)) return "employee_file";
  if (["pasted_code", "cli_snapshot"].includes(kind)) return "employee_code";
  if (kind === "url") return "employee_url";
  if (kind === "github_snapshot") return "employee_github_snapshot";
  throw invalidSource();
}

function invalidSource(): AppError {
  return new AppError("TIMELINE_SOURCE_INVALID", "errors.updates.stateInvalid", 409);
}
