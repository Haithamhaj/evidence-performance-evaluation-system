import { z } from "zod";

import { validateAiOutput } from "../../packages/ai-routing/src/output-validator.js";
import { AiProviderError } from "../../packages/ai-routing/src/contracts.js";
import {
  scanProhibitedOutput,
  type ProhibitedConceptCode,
  type ProhibitedOutputViolation,
} from "./prohibited-output.js";

const PILOT_ROUTE = "manager-feedback.identified";

const EvalOutputSchema = z
  .object({
    text: z.string(),
    sourceReferences: z.array(z.string()),
    visibility: z
      .object({
        mode: z.enum(["Identified", "Manager-Blinded", "Anonymous Aggregated"]),
        pilotRoute: z.literal(PILOT_ROUTE),
        submitterIdentity: z.string().optional(),
        managerVisibleFields: z.array(z.string()).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type EvalCase = Readonly<{
  id: string;
  version: string;
  locale: string;
  dialect: string;
  classification: import("../../packages/ai-routing/src/contracts.js").DataClassification;
  provenance: string;
  input: Readonly<Record<string, unknown>> &
    Readonly<{ sourceContent: string; sourceReferences: readonly string[]; pilotRoute?: string }>;
  expectedSchemaVersion: string;
  requiredSourceReferences: readonly string[];
  forbiddenConcepts: readonly ProhibitedConceptCode[];
  expectedDisposition: "allow" | "reject";
  timeoutMs?: number;
}>;

export type EvalAdapter = Readonly<{
  generate(
    request: import("../../packages/ai-routing/src/contracts.js").ProviderRequest,
    signal: AbortSignal,
  ): Promise<import("../../packages/ai-routing/src/contracts.js").ProviderResult>;
  maxAttempts?: number;
}>;

export type EvalResult = Readonly<{
  caseId: string;
  disposition: "allow" | "reject";
  schemaValid: boolean;
  rawOutput: unknown;
  violations: readonly ProhibitedOutputViolation[];
  missingSourceReferences: readonly string[];
  attempts: number;
  fallbackUsed: boolean;
  errorCode: "timeout" | "provider_error" | "invalid_output" | null;
}>;

export async function runEvalCase(evalCase: EvalCase, adapter: EvalAdapter): Promise<EvalResult> {
  const maxAttempts = clampAttempts(adapter.maxAttempts ?? 1);
  let attempts = 0;
  let rawOutput: unknown = null;

  while (attempts < maxAttempts) {
    attempts += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), evalCase.timeoutMs ?? 1_000);
    try {
      const result = await adapter.generate(
        {
          routeKey: "evaluation.prepare",
          modelKey: "fixture-model",
          input: evalCase.input,
        },
        controller.signal,
      );
      rawOutput = result.output;
      clearTimeout(timeout);
      return validateResult(evalCase, rawOutput, attempts);
    } catch (error) {
      clearTimeout(timeout);
      if (controller.signal.aborted) {
        return rejected(evalCase.id, rawOutput, attempts, "timeout");
      }
      if (
        attempts >= maxAttempts ||
        !(error instanceof AiProviderError) ||
        error.category !== "retryable"
      ) {
        return rejected(evalCase.id, rawOutput, attempts, "provider_error");
      }
    }
  }

  return rejected(evalCase.id, rawOutput, attempts, "provider_error");
}

function validateResult(evalCase: EvalCase, rawOutput: unknown, attempts: number): EvalResult {
  if (evalCase.expectedSchemaVersion !== "ai-eval-output.v1") {
    return rejected(evalCase.id, rawOutput, attempts, "invalid_output");
  }
  const validation = validateAiOutput("evaluation.prepare", EvalOutputSchema, rawOutput);
  if (!validation.valid) return rejected(evalCase.id, rawOutput, attempts, "invalid_output");

  const visibility = validation.output.visibility;
  if (
    (visibility?.mode === "Identified" && visibility.submitterIdentity === undefined) ||
    (visibility !== undefined && evalCase.input.pilotRoute !== PILOT_ROUTE)
  ) {
    return rejected(evalCase.id, rawOutput, attempts, "invalid_output");
  }

  const scan = scanProhibitedOutput({ text: validation.output.text, value: validation.output });
  const sourceReferences = new Set(validation.output.sourceReferences);
  const missingSourceReferences = evalCase.requiredSourceReferences.filter(
    (reference) => !sourceReferences.has(reference),
  );
  const disposition = scan.allowed && missingSourceReferences.length === 0 ? "allow" : "reject";

  return {
    caseId: evalCase.id,
    disposition,
    schemaValid: true,
    rawOutput,
    violations: scan.violations,
    missingSourceReferences,
    attempts,
    fallbackUsed: attempts > 1,
    errorCode: null,
  };
}

function rejected(
  caseId: string,
  rawOutput: unknown,
  attempts: number,
  errorCode: EvalResult["errorCode"],
): EvalResult {
  return {
    caseId,
    disposition: "reject",
    schemaValid: false,
    rawOutput,
    violations: [],
    missingSourceReferences: [],
    attempts,
    fallbackUsed: attempts > 1,
    errorCode,
  };
}

function clampAttempts(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) return 1;
  return Math.min(value, 3);
}
