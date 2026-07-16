import { readFile, realpath } from "node:fs/promises";
import { sep, resolve } from "node:path";

import { validateAiOutput } from "../../packages/ai-routing/src/output-validator.js";
import { AiProviderError } from "../../packages/ai-routing/src/contracts.js";
import {
  EvalCaseSchema,
  EvalOutputSchema,
  ManifestSchema,
  PILOT_ROUTE,
  SpeechGoldenSchema,
  TextFixtureSchema,
  VisibilityFixtureSchema,
  type EvalCaseContract,
  type ManifestEntry,
} from "./schemas.js";
import { scanProhibitedOutput, type ProhibitedOutputViolation } from "./prohibited-output.js";

export type EvalCase = EvalCaseContract;

export type EvalAdapter = Readonly<{
  generate(
    request: import("../../packages/ai-routing/src/contracts.js").ProviderRequest,
    signal: AbortSignal,
  ): Promise<import("../../packages/ai-routing/src/contracts.js").ProviderResult>;
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

export type FixtureSuite = Readonly<{
  manifest: readonly ManifestEntry[];
  textFixtures: ReadonlyArray<import("zod").infer<typeof TextFixtureSchema>>;
  speechFixtures: Readonly<import("zod").infer<typeof SpeechGoldenSchema>>;
}>;

class EvalTimeoutError extends Error {
  constructor() {
    super("AI evaluation case timed out");
    this.name = "EvalTimeoutError";
  }
}

export async function runEvalCase(
  candidateCase: EvalCase,
  adapterInput: EvalAdapter | readonly EvalAdapter[],
): Promise<EvalResult> {
  const parsedCase = EvalCaseSchema.safeParse(candidateCase);
  if (!parsedCase.success) return rejected(candidateCase.id, null, 0, false, "invalid_output");
  const evalCase = parsedCase.data;
  const adapters = distinctAdapters(adapterInput);
  const deadline = Date.now() + (evalCase.timeoutMs ?? 1_000);
  let attempts = 0;
  let rawOutput: unknown = null;

  for (const adapter of adapters) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0)
      return rejected(evalCase.id, rawOutput, attempts, attempts > 1, "timeout");
    attempts += 1;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const generation = Promise.resolve().then(() =>
      adapter.generate(
        {
          routeKey: "evaluation.prepare",
          modelKey: "fixture-model",
          input: evalCase.input,
        },
        controller.signal,
      ),
    );
    const deadlineReached = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new EvalTimeoutError());
      }, remainingMs);
    });

    try {
      const result = await Promise.race([generation, deadlineReached]);
      rawOutput = result.output;
      return validateResult(evalCase, rawOutput, attempts);
    } catch (error) {
      if (error instanceof EvalTimeoutError || controller.signal.aborted) {
        return rejected(evalCase.id, rawOutput, attempts, attempts > 1, "timeout");
      }
      const canFallback = error instanceof AiProviderError && error.category === "retryable";
      if (!canFallback || attempts >= adapters.length) {
        return rejected(evalCase.id, rawOutput, attempts, attempts > 1, "provider_error");
      }
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }

  return rejected(evalCase.id, rawOutput, attempts, attempts > 1, "provider_error");
}

export async function loadFixtureSuite(fixtureRoot: string): Promise<FixtureSuite> {
  const root = await realpath(resolve(fixtureRoot));
  const manifestValue = await readJson(resolve(root, "manifest.json"), "manifest");
  const parsedManifest = ManifestSchema.safeParse(manifestValue);
  if (!parsedManifest.success) {
    throw new Error(`Invalid manifest: ${formatIssues(parsedManifest.error.issues)}`);
  }

  const manifest = parsedManifest.data;
  const textFixtures: import("zod").infer<typeof TextFixtureSchema>[] = [];
  for (const entry of manifest) {
    const inputPath = await resolveWithinRoot(root, entry.inputPath);
    if (entry.expectedSchemaVersion === "speech-golden.v1") {
      await readFile(inputPath);
      continue;
    }
    const fixtureValue = await readJson(inputPath, `fixture ${entry.id}`);
    if (entry.id === "visibility-modes") {
      const parsed = VisibilityFixtureSchema.safeParse(fixtureValue);
      if (!parsed.success) {
        throw new Error(`Invalid fixture ${entry.id}: ${formatIssues(parsed.error.issues)}`);
      }
      for (const fixture of parsed.data) {
        assertFixtureMetadata(entry, fixture.evalCase, false);
        textFixtures.push(fixture);
      }
      continue;
    }
    const parsed = TextFixtureSchema.safeParse(fixtureValue);
    if (!parsed.success) {
      throw new Error(`Invalid fixture ${entry.id}: ${formatIssues(parsed.error.issues)}`);
    }
    assertFixtureMetadata(entry, parsed.data.evalCase, true);
    textFixtures.push(parsed.data);
  }

  const speechValue = await readJson(
    await resolveWithinRoot(root, "audio/speech-golden.json"),
    "speech golden fixture",
  );
  const parsedSpeech = SpeechGoldenSchema.safeParse(speechValue);
  if (!parsedSpeech.success) {
    throw new Error(`Invalid speech fixture: ${formatIssues(parsedSpeech.error.issues)}`);
  }
  for (const speech of parsedSpeech.data) {
    const entry = manifest.find(({ id }) => id === speech.fixtureId);
    if (
      entry === undefined ||
      entry.inputPath !== speech.audioPath ||
      entry.locale !== speech.locale ||
      entry.dialect !== speech.dialect ||
      entry.classification !== speech.privacyClassification ||
      entry.provenance !== speech.provenance ||
      entry.expectedDisposition !== speech.expectedDisposition
    ) {
      throw new Error(`Fixture metadata mismatch for ${speech.fixtureId}`);
    }
  }

  return { manifest, textFixtures, speechFixtures: parsedSpeech.data };
}

function validateResult(evalCase: EvalCase, rawOutput: unknown, attempts: number): EvalResult {
  const validation = validateAiOutput("evaluation.prepare", EvalOutputSchema, rawOutput);
  if (!validation.valid) {
    return rejected(evalCase.id, rawOutput, attempts, attempts > 1, "invalid_output");
  }

  const visibility = validation.output.visibility;
  if (visibility !== undefined && evalCase.input.pilotRoute !== PILOT_ROUTE) {
    return rejected(evalCase.id, rawOutput, attempts, attempts > 1, "invalid_output");
  }

  const configuredConcepts = new Set(evalCase.forbiddenConcepts);
  const scan = scanProhibitedOutput({ text: validation.output.text, value: validation.output });
  const violations = scan.violations.filter(({ code }) => configuredConcepts.has(code));
  const sourceReferences = new Set(validation.output.sourceReferences);
  const missingSourceReferences = evalCase.requiredSourceReferences.filter(
    (reference) => !sourceReferences.has(reference),
  );
  const disposition =
    violations.length === 0 && missingSourceReferences.length === 0 ? "allow" : "reject";

  return {
    caseId: evalCase.id,
    disposition,
    schemaValid: true,
    rawOutput,
    violations,
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
  fallbackUsed: boolean,
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
    fallbackUsed,
    errorCode,
  };
}

function distinctAdapters(input: EvalAdapter | readonly EvalAdapter[]): EvalAdapter[] {
  const candidates = Array.isArray(input) ? input : [input as EvalAdapter];
  return [...new Set(candidates)].slice(0, 3);
}

async function resolveWithinRoot(root: string, relativePath: string): Promise<string> {
  const candidate = resolve(root, relativePath);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
    throw new Error(`Fixture path must remain within the fixture root: ${relativePath}`);
  }
  let canonical: string;
  try {
    canonical = await realpath(candidate);
  } catch (error) {
    throw new Error(`Fixture path is missing: ${relativePath}`, { cause: error });
  }
  if (canonical !== root && !canonical.startsWith(`${root}${sep}`)) {
    throw new Error(`Fixture path must remain within the fixture root: ${relativePath}`);
  }
  return canonical;
}

async function readJson(file: string, label: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`Invalid ${label} JSON`, { cause: error });
  }
}

function assertFixtureMetadata(
  manifest: ManifestEntry,
  evalCase: EvalCase,
  requireMatchingId: boolean,
): void {
  const same =
    (!requireMatchingId || manifest.id === evalCase.id) &&
    manifest.version === evalCase.version &&
    manifest.locale === evalCase.locale &&
    manifest.dialect === evalCase.dialect &&
    manifest.classification === evalCase.classification &&
    manifest.provenance === evalCase.provenance &&
    manifest.expectedSchemaVersion === evalCase.expectedSchemaVersion &&
    manifest.expectedDisposition === evalCase.expectedDisposition &&
    sameStrings(manifest.requiredSourceReferences, evalCase.requiredSourceReferences) &&
    sameStrings(manifest.forbiddenConcepts, evalCase.forbiddenConcepts) &&
    sameStrings(manifest.requiredSourceReferences, evalCase.input.sourceReferences);
  if (!same) throw new Error(`Fixture metadata mismatch for ${evalCase.id}`);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function formatIssues(issues: readonly { path: PropertyKey[]; message: string }[]): string {
  return issues.map(({ path, message }) => `${path.join(".") || "root"}: ${message}`).join("; ");
}
