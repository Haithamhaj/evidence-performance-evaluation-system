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
  assertGroundedSourceReferences,
  buildTaskDraftRequest,
  type ContextSourceInput,
} from "./prompts.js";

type Router = Pick<AiRouter, "run">;
type TaskDraftRecord = import("@evaluation/contracts").TaskDraftRecord;

export interface TaskDraftPersistence {
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
    const sourceReferences = unique([
      ...command.sources.map(({ reference }) => reference),
      ...command.analysis.sourceReferences,
      ...decisionSourceReferences(command.decision),
      ...command.semanticContexts.flatMap((context) => context.sourceReferences),
    ]);
    const draftId = this.dependencies.idFactory?.() ?? crypto.randomUUID();
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
    assertGroundedSourceReferences(run.output, sourceReferences);
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
    return this.dependencies.drafts.append({
      record,
      draftCiphertext: sealed.ciphertext,
      draftKeyVersion: sealed.keyVersion,
    });
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
