import type { Readable } from "node:stream";

export const READINESS_INPUT_SCHEMA_VERSION = "document-analysis-input.v2";
export const READINESS_OUTPUT_SCHEMA_VERSION = "document-readiness-output.v2";
export const COMPARISON_INPUT_SCHEMA_VERSION = "document-comparison-input.v2";
export const COMPARISON_OUTPUT_SCHEMA_VERSION = "document-comparison-output.v2";

export type RegisteredPromptReference = Readonly<{
  artifactId: string;
  version: string;
  sha256: string;
}>;

export type AnalysisTemplateSection = Readonly<{
  key: string;
  required: boolean;
  protected: boolean;
  position?: number;
  display?: unknown;
}>;

export type CanonicalSource = Readonly<{
  reference: string;
  sourceType: "upload" | "external_link" | "github";
  mediaType: string;
  expectedSha256?: string;
  openStream?: () => Promise<Readable>;
}>;

export type CanonicalAnalysisSources = Readonly<{
  identity: import("./model.js").DocumentResourceIdentity;
  documentId: string;
  documentVersionId: string;
  documentVersion: number;
  currentVersion: number;
  templateVersionId: string;
  templateSections: readonly AnalysisTemplateSection[];
  sources: readonly CanonicalSource[];
  sourceReferences: readonly string[];
}>;

export type ExtractionCoverage = "complete" | "unsupported" | "failed";
export type ExtractedSource = Readonly<{
  reference: string;
  mediaType: string;
  coverage: ExtractionCoverage;
  sha256?: string;
  contentBase64?: string;
  reason?: "not_fetched" | "unsupported_safe_extraction" | "failed";
}>;
export type ExtractionBundle = Readonly<{
  coverage: ExtractionCoverage;
  sources: readonly ExtractedSource[];
}>;

export type DocumentAnalysisRequestReceipt = Readonly<{
  requestId: string;
  operationId: string;
  state: "queued" | "running" | "succeeded" | "failed" | "superseded";
  documentId: string;
  documentVersionIds: readonly string[];
}>;

export type DocumentComparisonReview = Readonly<{
  id: string;
  comparisonId: string;
  effectiveClassification: import("@evaluation/contracts").ComparisonAnalysisOutput["classification"];
  reviewerId: string;
  reason: string;
  createdAt: string;
}>;

export type AnalysisJobEnqueuer = (receipt: DocumentAnalysisRequestReceipt) => Promise<unknown>;

export interface DocumentAnalysisAiRouter {
  run<TInput, TOutput>(
    input: import("@evaluation/ai-routing").AiRunRequest<TInput, TOutput>,
    persist: import("@evaluation/ai-routing").PersistValidatedOutput<
      TOutput,
      import("./model.js").DocumentTransaction
    >,
  ): Promise<import("@evaluation/ai-routing").ValidatedAiResult<TOutput>>;
}
