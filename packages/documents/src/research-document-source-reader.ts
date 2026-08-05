import { AnalysisSourceReferenceSchema, AppError } from "@evaluation/contracts";

type Actor = Readonly<{ userId: string; active: boolean }>;

export type ResearchDocumentSource = Readonly<{
  projectId: string;
  documentId: string;
  documentVersionId: string;
  documentVersion: number;
  sourceChecksumSha256: string;
  sourceReferences: readonly string[];
  extractedText: string;
}>;

type ApprovedVersionLocator = Readonly<{
  locateApprovedProjectVersion(
    input: Readonly<{ actor: Actor; projectId: string }>,
  ): Promise<Readonly<{
    documentVersionId: string;
    sourceChecksum: string;
    sourceVersion: number;
  }> | null>;
}>;

type ApprovedSourceReader = Readonly<{
  loadApprovedVersion(
    input: Readonly<{
      actor: Actor;
      projectId: string;
      documentVersionId: string;
      sourceChecksum: string;
    }>,
  ): Promise<
    Readonly<{
      projectId: string;
      documentId: string;
      documentVersionId: string;
      documentVersion: number;
      sourceChecksum: string;
      sourceReferences: readonly string[];
      quotedSections: readonly Readonly<{
        reference: string;
        mediaType: string;
        text: string;
        trust: "untrusted";
      }>[];
    }>
  >;
}>;

export class ResearchDocumentSourceReader {
  private readonly locator: ApprovedVersionLocator;
  private readonly sources: ApprovedSourceReader;

  constructor(locator: ApprovedVersionLocator, sources: ApprovedSourceReader) {
    this.locator = locator;
    this.sources = sources;
  }

  async readApprovedVersion(
    input: Readonly<{
      actor: Actor;
      documentVersionId: string;
      projectId: string;
    }>,
  ): Promise<ResearchDocumentSource> {
    const located = await this.locator.locateApprovedProjectVersion({
      actor: input.actor,
      projectId: input.projectId,
    });
    if (located === null || located.documentVersionId !== input.documentVersionId) {
      throw invalidSource();
    }
    const source = await this.sources.loadApprovedVersion({
      actor: input.actor,
      projectId: input.projectId,
      documentVersionId: input.documentVersionId,
      sourceChecksum: located.sourceChecksum,
    });
    if (
      source.projectId !== input.projectId ||
      source.documentVersionId !== input.documentVersionId ||
      source.documentVersion !== located.sourceVersion ||
      source.sourceChecksum !== located.sourceChecksum
    ) {
      throw invalidSource();
    }
    const sourceReferences = source.sourceReferences.map((reference) =>
      AnalysisSourceReferenceSchema.parse(reference),
    );
    return {
      projectId: source.projectId,
      documentId: source.documentId,
      documentVersionId: source.documentVersionId,
      documentVersion: source.documentVersion,
      sourceChecksumSha256: source.sourceChecksum,
      sourceReferences,
      extractedText: source.quotedSections.map(({ text }) => text).join("\n"),
    };
  }
}

function invalidSource(): AppError {
  return new AppError(
    "RESEARCH_DOCUMENT_SOURCE_INVALID",
    "errors.research.documentSourceInvalid",
    409,
  );
}
