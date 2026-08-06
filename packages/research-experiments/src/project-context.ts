import { createHash } from "node:crypto";

import { AnalysisSourceReferenceSchema, AppError } from "@evaluation/contracts";

export type NamedReference = Readonly<{
  id: string;
  projectId: string;
  name: string;
  description: string;
  version: number;
  contentIdentitySha256: string;
  sourceReference: string;
  contentIdentityReference: string;
}>;

export type ResearchWorkItemReference = Readonly<{
  id: string;
  projectId: string;
  workstreamId: string | null;
  title: string;
  description: string;
  status: import("@evaluation/contracts").WorkItemStatus;
  version: number;
  contentIdentitySha256: string;
  sourceReference: string;
  contentIdentityReference: string;
}>;

export type ResearchProjectContextSnapshot = Readonly<{
  schemaVersion: "research-project-context.v1";
  projectId: string;
  projectName: string;
  projectVersion: number;
  projectContentIdentitySha256: string;
  projectSourceReference: string;
  projectContentIdentityReference: string;
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
  projectName: string;
  projectVersion: number;
  projectContentIdentitySha256: string;
  projectSourceReference: string;
  projectContentIdentityReference: string;
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
  const projectIdentity = contentIdentity({
    kind: "project",
    id: input.projectId,
    version: input.projectVersion,
    name: input.projectName,
    description: input.objective,
  });
  if (
    !Number.isFinite(input.generatedAt.getTime()) ||
    input.projectId.trim().length === 0 ||
    input.projectVersion < 1 ||
    input.projectContentIdentitySha256 !== projectIdentity ||
    input.projectSourceReference !== `project:${input.projectId}` ||
    input.projectContentIdentityReference !== `project-version:${projectIdentity}` ||
    hasDuplicateIds(input.workstreams) ||
    hasDuplicateIds(input.workItems) ||
    input.workstreams.some((reference) => !validWorkstream(reference, input.projectId)) ||
    input.workItems.some((reference) => !validWorkItem(reference, input.projectId))
  ) {
    throw invalidContext();
  }
  const workstreams = [...input.workstreams]
    .map((reference) => ({
      id: reference.id,
      projectId: reference.projectId,
      name: reference.name,
      description: reference.description,
      version: reference.version,
      contentIdentitySha256: reference.contentIdentitySha256,
      sourceReference: AnalysisSourceReferenceSchema.parse(reference.sourceReference),
      contentIdentityReference: AnalysisSourceReferenceSchema.parse(
        reference.contentIdentityReference,
      ),
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
      contentIdentitySha256: reference.contentIdentitySha256,
      sourceReference: AnalysisSourceReferenceSchema.parse(reference.sourceReference),
      contentIdentityReference: AnalysisSourceReferenceSchema.parse(
        reference.contentIdentityReference,
      ),
    }))
    .sort(compareWorkItems);
  const rawSourceReferences = input.sourceReferences.map((reference) =>
    AnalysisSourceReferenceSchema.parse(reference),
  );
  const authorizedIdentityReferences = new Set([
    input.projectSourceReference,
    input.projectContentIdentityReference,
    ...workstreams.flatMap(({ sourceReference, contentIdentityReference }) => [
      sourceReference,
      contentIdentityReference,
    ]),
    ...workItems.flatMap(({ sourceReference, contentIdentityReference }) => [
      sourceReference,
      contentIdentityReference,
    ]),
  ]);
  if (
    rawSourceReferences.some(
      (reference) =>
        isContextIdentityReference(reference) && !authorizedIdentityReferences.has(reference),
    ) ||
    workItems.some(
      ({ workstreamId }) =>
        workstreamId !== null && !workstreams.some(({ id }) => id === workstreamId),
    )
  ) {
    throw invalidContext();
  }
  const sourceReferences = uniqueSorted([
    ...rawSourceReferences,
    input.projectSourceReference,
    input.projectContentIdentityReference,
    ...workstreams.map(({ sourceReference }) => sourceReference),
    ...workstreams.map(({ contentIdentityReference }) => contentIdentityReference),
    ...workItems.map(({ sourceReference }) => sourceReference),
    ...workItems.map(({ contentIdentityReference }) => contentIdentityReference),
  ]);
  const fingerprinted = {
    schemaVersion: "research-project-context.v1" as const,
    projectId: input.projectId,
    projectName: input.projectName,
    projectVersion: input.projectVersion,
    projectContentIdentitySha256: input.projectContentIdentitySha256,
    projectSourceReference: input.projectSourceReference,
    projectContentIdentityReference: input.projectContentIdentityReference,
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
    projectName: fingerprinted.projectName,
    projectVersion: fingerprinted.projectVersion,
    projectContentIdentitySha256: fingerprinted.projectContentIdentitySha256,
    projectSourceReference: fingerprinted.projectSourceReference,
    projectContentIdentityReference: fingerprinted.projectContentIdentityReference,
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

function validWorkstream(reference: NamedReference, projectId: string): boolean {
  const identity = contentIdentity({
    kind: "workstream",
    id: reference.id,
    projectId: reference.projectId,
    version: reference.version,
    name: reference.name,
    description: reference.description,
  });
  return (
    reference.projectId === projectId &&
    reference.version >= 1 &&
    reference.contentIdentitySha256 === identity &&
    reference.sourceReference === `workstream:${reference.id}` &&
    reference.contentIdentityReference === `workstream-version:${identity}`
  );
}

function validWorkItem(reference: ResearchWorkItemReference, projectId: string): boolean {
  const identity = contentIdentity({
    kind: "work-item",
    id: reference.id,
    projectId: reference.projectId,
    workstreamId: reference.workstreamId,
    title: reference.title,
    description: reference.description,
    status: reference.status,
    version: reference.version,
  });
  return (
    reference.projectId === projectId &&
    reference.version >= 1 &&
    reference.contentIdentitySha256 === identity &&
    reference.sourceReference === `work-item:${reference.id}` &&
    reference.contentIdentityReference === `work-item-version:${identity}`
  );
}

function isContextIdentityReference(reference: string): boolean {
  return /^(?:project|project-version|workstream|workstream-version|work-item|work-item-version):/iu.test(
    reference,
  );
}

function contentIdentity(value: object): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
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
