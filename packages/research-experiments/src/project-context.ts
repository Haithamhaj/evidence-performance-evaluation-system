import { createHash } from "node:crypto";

import { AnalysisSourceReferenceSchema, AppError } from "@evaluation/contracts";

export type NamedReference = Readonly<{
  id: string;
  name: string;
  sourceReference: string;
}>;

export type ResearchWorkItemReference = Readonly<{
  id: string;
  projectId: string;
  workstreamId: string | null;
  title: string;
  description: string;
  status: import("@evaluation/contracts").WorkItemStatus;
  version: number;
  sourceReference: string;
}>;

export type ResearchProjectContextSnapshot = Readonly<{
  schemaVersion: "research-project-context.v1";
  projectId: string;
  generatedAt: string;
  fingerprintSha256: string;
  sourceReferences: readonly string[];
  objective: string;
  constraints: readonly string[];
  deliverables: readonly string[];
  operationalKpis: readonly string[];
  workstreams: readonly NamedReference[];
  workItems: readonly ResearchWorkItemReference[];
  decisions: readonly string[];
}>;

export type ComposeProjectContextSnapshotInput = Readonly<{
  generatedAt: Date;
  projectId: string;
  sourceReferences: readonly string[];
  objective: string;
  constraints: readonly string[];
  deliverables: readonly string[];
  operationalKpis: readonly string[];
  workstreams: readonly NamedReference[];
  workItems: readonly ResearchWorkItemReference[];
  decisions: readonly string[];
}>;

export function composeProjectContextSnapshot(
  input: ComposeProjectContextSnapshotInput,
): ResearchProjectContextSnapshot {
  if (
    !Number.isFinite(input.generatedAt.getTime()) ||
    input.projectId.trim().length === 0 ||
    hasDuplicateIds(input.workstreams) ||
    hasDuplicateIds(input.workItems) ||
    input.workItems.some(({ projectId }) => projectId !== input.projectId)
  ) {
    throw invalidContext();
  }
  const workstreams = [...input.workstreams]
    .map((reference) => ({
      id: reference.id,
      name: reference.name,
      sourceReference: AnalysisSourceReferenceSchema.parse(reference.sourceReference),
    }))
    .sort(compareNamedReferences);
  const workItems = [...input.workItems]
    .map((reference) => ({
      id: reference.id,
      projectId: reference.projectId,
      workstreamId: reference.workstreamId,
      title: reference.title,
      description: reference.description,
      status: reference.status,
      version: reference.version,
      sourceReference: AnalysisSourceReferenceSchema.parse(reference.sourceReference),
    }))
    .sort(compareWorkItems);
  const sourceReferences = uniqueSorted([
    ...input.sourceReferences.map((reference) => AnalysisSourceReferenceSchema.parse(reference)),
    ...workstreams.map(({ sourceReference }) => sourceReference),
    ...workItems.map(({ sourceReference }) => sourceReference),
  ]);
  const fingerprinted = {
    schemaVersion: "research-project-context.v1" as const,
    projectId: input.projectId,
    sourceReferences,
    objective: input.objective,
    constraints: uniqueSorted(input.constraints),
    deliverables: uniqueSorted(input.deliverables),
    operationalKpis: uniqueSorted(input.operationalKpis),
    workstreams,
    workItems,
    decisions: uniqueSorted(input.decisions),
  };
  return {
    schemaVersion: fingerprinted.schemaVersion,
    projectId: fingerprinted.projectId,
    generatedAt: input.generatedAt.toISOString(),
    fingerprintSha256: createHash("sha256")
      .update(JSON.stringify(fingerprinted), "utf8")
      .digest("hex"),
    sourceReferences: fingerprinted.sourceReferences,
    objective: fingerprinted.objective,
    constraints: fingerprinted.constraints,
    deliverables: fingerprinted.deliverables,
    operationalKpis: fingerprinted.operationalKpis,
    workstreams: fingerprinted.workstreams,
    workItems: fingerprinted.workItems,
    decisions: fingerprinted.decisions,
  };
}

function hasDuplicateIds(values: readonly Readonly<{ id: string }>[]): boolean {
  return new Set(values.map(({ id }) => id)).size !== values.length;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function compareNamedReferences(left: NamedReference, right: NamedReference): number {
  return compareText(left.id, right.id) || compareText(left.name, right.name);
}

function compareWorkItems(
  left: ResearchWorkItemReference,
  right: ResearchWorkItemReference,
): number {
  return compareText(left.id, right.id) || left.version - right.version;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function invalidContext(): AppError {
  return new AppError(
    "RESEARCH_PROJECT_CONTEXT_INVALID",
    "errors.research.projectContextInvalid",
    409,
  );
}
