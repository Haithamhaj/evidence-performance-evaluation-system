import { createHash } from "node:crypto";

import type { AiRouter } from "@evaluation/ai-routing";
import { TaskDraftRecordSchema } from "@evaluation/contracts";

import {
  assertDeterministicTaskProject,
  requirePrompt,
  requireTrace,
  type ContextPromptArtifactPublicReader,
  type PrivateContextOutputProtector,
  type SucceededAiRunTracePublicReader,
} from "./analysis-service.js";
import type { LinkDecision } from "./matching-policy.js";
import type { ApprovedProjectSemanticContext } from "./project-semantic-context-reader.js";
import {
  TASK_DRAFT_OUTPUT_SCHEMA_VERSION,
  TASK_DRAFT_PROMPT_VERSION,
  TASK_DRAFT_ROUTE,
  TASK_DRAFT_TRUSTED_PROMPT,
  TaskDraftAiOutputSchema,
  assertTaskDraftSemantics,
  buildTaskDraftRequest,
  type ContextSourceInput,
} from "./prompts.js";

type Router = Pick<AiRouter, "run">;
type TaskDraftRecord = import("@evaluation/contracts").TaskDraftRecord;

export interface TaskDraftPersistence {
  findInitial(
    input: Readonly<{
      id: string;
      employeeId: string;
      sourceItemId: string;
    }>,
  ): Promise<TaskDraftRecord | null>;
  append(
    input: Readonly<{
      record: TaskDraftRecord;
      draftCiphertext: string;
      draftKeyVersion: string;
    }>,
  ): Promise<TaskDraftRecord>;
}

type Dependencies = Readonly<{
  router: Router;
  promptArtifacts: ContextPromptArtifactPublicReader;
  aiRuns: SucceededAiRunTracePublicReader;
  drafts: TaskDraftPersistence;
  protector: PrivateContextOutputProtector;
  timeoutMs: number;
  clock?: () => Date;
  idFactory?: () => string;
}>;

export type PrepareTaskDraftCommand = Readonly<{
  actor: Readonly<{ userId: string; active: boolean }>;
  sourceItemId: string;
  departmentId: string;
  systemId: string;
  correlationId: string;
  sources: readonly ContextSourceInput[];
  decision: LinkDecision;
  semanticContexts: readonly ApprovedProjectSemanticContext[];
  analysis: Readonly<{
    summary: string;
    uncertainties: readonly string[];
    sourceReferences: readonly string[];
  }>;
}>;

export class TaskDraftService {
  private readonly dependencies: Dependencies;

  constructor(dependencies: Dependencies) {
    this.dependencies = dependencies;
  }

  async prepare(command: PrepareTaskDraftCommand): Promise<TaskDraftRecord> {
    if (!command.actor.active) throw new Error("Active employee required");
    const draftId =
      this.dependencies.idFactory?.() ??
      stableInitialId(command.actor.userId, command.sourceItemId);
    const existing = await this.dependencies.drafts.findInitial({
      id: draftId,
      employeeId: command.actor.userId,
      sourceItemId: command.sourceItemId,
    });
    if (existing !== null) return requireInitialDraft(existing, draftId, command);
    const prompt = await requirePrompt(
      this.dependencies.promptArtifacts,
      TASK_DRAFT_ROUTE,
      TASK_DRAFT_PROMPT_VERSION,
      TASK_DRAFT_TRUSTED_PROMPT,
    );
    const governed = buildTaskDraftRequest({
      prompt: { artifactId: prompt.id, sha256: prompt.bodyHash },
      sources: command.sources,
      decision: command.decision,
      semanticContexts: command.semanticContexts,
      analysis: command.analysis,
    });
    const sourceReferences = boundedReferences([
      ...command.sources.map(({ reference }) => reference),
      ...command.analysis.sourceReferences,
      ...decisionSourceReferences(command.decision),
      ...command.semanticContexts.flatMap((context) => context.sourceReferences),
    ]);
    const outputReference = `task-draft:${draftId}`;
    const run = await this.dependencies.router.run(
      {
        routeKey: TASK_DRAFT_ROUTE,
        ...(command.decision.kind === "AUTO_LINK" ? { projectId: command.decision.projectId } : {}),
        departmentId: command.departmentId,
        systemId: command.systemId,
        input: governed.input,
        inputReference: `connected-source:${command.sourceItemId}`,
        inputSchemaVersion: governed.inputSchemaVersion,
        outputSchemaVersion: TASK_DRAFT_OUTPUT_SCHEMA_VERSION,
        promptTemplateVersion: TASK_DRAFT_PROMPT_VERSION,
        outputSchema: TaskDraftAiOutputSchema,
        sourceReferences,
        classification: "confidential",
        timeoutMs: this.dependencies.timeoutMs,
        requiresHumanApproval: true,
        correlationId: command.correlationId,
      },
      async () => ({ outputReference }),
    );
    assertTaskDraftSemantics(run.output, sourceReferences);
    assertDeterministicTaskProject(command.decision, run.output);
    const trace = await requireTrace(this.dependencies.aiRuns, run, {
      routeKey: TASK_DRAFT_ROUTE,
      outputSchemaVersion: TASK_DRAFT_OUTPUT_SCHEMA_VERSION,
      promptTemplateVersion: TASK_DRAFT_PROMPT_VERSION,
      sourceReferences,
    });
    const sealed = await this.dependencies.protector.seal(JSON.stringify(run.output));
    const record = TaskDraftRecordSchema.parse({
      id: draftId,
      employeeId: command.actor.userId,
      sourceItemId: command.sourceItemId,
      revision: 1,
      schemaVersion: TASK_DRAFT_OUTPUT_SCHEMA_VERSION,
      promptVersion: TASK_DRAFT_PROMPT_VERSION,
      routeTrace: {
        aiRunId: trace.id,
        routeKey: trace.routeKey,
        routeConfigId: trace.routeConfigId,
        routeConfigVersion: trace.routeConfigVersion,
      },
      sourceReferences: run.output.sourceReferences,
      reviewStatus: "PENDING",
      revisionOrigin: "AI",
      correctionReason: null,
      createdAt: (this.dependencies.clock ?? (() => new Date()))().toISOString(),
      draft: run.output,
      supersedesTaskDraftId: null,
    });
    return requireInitialDraft(
      await this.dependencies.drafts.append({
        record,
        draftCiphertext: sealed.ciphertext,
        draftKeyVersion: sealed.keyVersion,
      }),
      draftId,
      command,
    );
  }
}

function decisionSourceReferences(decision: LinkDecision): string[] {
  return decision.kind === "AUTO_LINK"
    ? decision.anchors.map(({ reference }) => reference)
    : decision.kind === "REVIEW"
      ? decision.candidates.flatMap(({ anchors }) => anchors.map(({ anchor }) => anchor.reference))
      : [];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function boundedReferences(values: readonly string[]): string[] {
  const references = unique(values);
  if (references.length === 0 || references.length > 50) {
    throw new Error("Context Intelligence AI source references exceed the Router limit");
  }
  return references;
}

function stableInitialId(employeeId: string, sourceItemId: string): string {
  const bytes = createHash("sha256")
    .update(`context-intelligence:task-draft:${employeeId}:${sourceItemId}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function requireInitialDraft(
  value: TaskDraftRecord,
  id: string,
  command: PrepareTaskDraftCommand,
): TaskDraftRecord {
  const draft = TaskDraftRecordSchema.parse(value);
  if (
    draft.id !== id ||
    draft.employeeId !== command.actor.userId ||
    draft.sourceItemId !== command.sourceItemId ||
    draft.revision !== 1
  ) {
    throw new Error("Persisted Task draft does not match the stable operation");
  }
  return draft;
}
