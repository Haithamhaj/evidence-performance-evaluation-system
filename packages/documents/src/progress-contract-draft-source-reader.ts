import { createHash } from "node:crypto";

import { AppError } from "@evaluation/contracts";

import { authorizeDocument } from "./document-authorization.js";
import { extractSafeSources } from "./safe-source-extraction.js";

type Actor = Readonly<{ userId: string; active: boolean }>;
type ExtractionPolicy = Readonly<{
  maxSourceBytes: number;
  maxArchiveEntries: number;
  maxArchiveUncompressedBytes: number;
  maxArchiveCompressionRatio: number;
  maxQuotedCharacters: number;
}>;

export type ProgressContractDraftSource = Readonly<{
  projectId: string;
  departmentScopeId: string;
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
}>;

export interface ApprovedProgressContractDraftSourceReader {
  loadApprovedVersion(
    input: Readonly<{
      actor: Actor;
      projectId: string;
      documentVersionId: string;
      sourceChecksum: string;
    }>,
  ): Promise<ProgressContractDraftSource>;
}

export class ProgressContractDraftSourceLocator {
  private readonly database: import("./model.js").DocumentDatabase;
  private readonly identityReader: import("./model.js").DocumentResourceIdentityReader;

  constructor(
    database: import("./model.js").DocumentDatabase,
    identityReader: import("./model.js").DocumentResourceIdentityReader,
  ) {
    this.database = database;
    this.identityReader = identityReader;
  }

  async locateApprovedProjectVersion(
    input: Readonly<{
      actor: Actor;
      projectId: string;
      documentVersionId?: string;
    }>,
  ): Promise<Readonly<{
    documentVersionId: string;
    sourceChecksum: string;
    sourceVersion: number;
  }> | null> {
    const identity = await this.identityReader.read({
      kind: "project",
      resourceId: input.projectId,
    });
    if (identity === null || identity.status !== "active") return null;
    await authorizeDocument(this.database, input.actor, identity, "document.read", new Date());
    const document = await this.database.documentRecord.findUnique({
      where: { projectId: input.projectId },
      include: {
        versions: {
          ...(input.documentVersionId === undefined
            ? {}
            : { where: { id: input.documentVersionId } }),
          orderBy: { version: "desc" },
          take: 1,
          include: {
            sources: {
              orderBy: { position: "asc" },
              include: { uploadedSource: { select: { sha256: true } } },
            },
            readinessChecks: {
              where:
                input.documentVersionId === undefined
                  ? { analyzedState: "ready_for_criteria_generation", stale: false }
                  : {
                      analyzedState: "ready_for_criteria_generation",
                      lifecycleTransitions: { some: { toState: "criteria_approved" } },
                    },
              orderBy: { createdAt: "desc" },
              take: 1,
              include: {
                lifecycleTransitions: {
                  orderBy: [{ effectiveAt: "desc" }, { id: "desc" }],
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    const version = document?.versions[0];
    const readiness = version?.readinessChecks[0];
    const historicalVersion =
      document !== null && version !== undefined && version.version < document.currentVersion;
    const currentApproval =
      readiness?.stale === false &&
      readiness.lifecycleTransitions[0]?.toState === "criteria_approved";
    if (
      document === null ||
      version === undefined ||
      (input.documentVersionId !== undefined && version.id !== input.documentVersionId) ||
      (input.documentVersionId === undefined && version.version !== document.currentVersion) ||
      version.version > document.currentVersion ||
      readiness === undefined ||
      (!historicalVersion && !currentApproval) ||
      version.sources.length === 0 ||
      version.sources.some(({ uploadedSource }) => uploadedSource === null)
    )
      return null;
    const lineage = version.sources.map((source) => ({
      reference: `document-source:${source.id}`,
      sha256: source.uploadedSource!.sha256,
    }));
    return {
      documentVersionId: version.id,
      sourceVersion: version.version,
      sourceChecksum:
        lineage.length === 1
          ? lineage[0]!.sha256
          : createHash("sha256").update(JSON.stringify(lineage)).digest("hex"),
    };
  }
}

type Extract = typeof extractSafeSources;
type Authorize = typeof authorizeDocument;

export class ProgressContractDraftSourceReader implements ApprovedProgressContractDraftSourceReader {
  private readonly database: import("./model.js").DocumentDatabase;
  private readonly identityReader: import("./model.js").DocumentResourceIdentityReader;
  private readonly sourceLoader: import("./document-analysis-source-loader.js").DocumentAnalysisSourceLoader;
  private readonly policy: ExtractionPolicy;
  private readonly extract: Extract;
  private readonly authorize: Authorize;

  constructor(
    database: import("./model.js").DocumentDatabase,
    identityReader: import("./model.js").DocumentResourceIdentityReader,
    sourceLoader: import("./document-analysis-source-loader.js").DocumentAnalysisSourceLoader,
    policy: ExtractionPolicy,
    extract: Extract = extractSafeSources,
    authorize: Authorize = authorizeDocument,
  ) {
    this.database = database;
    this.identityReader = identityReader;
    this.sourceLoader = sourceLoader;
    this.policy = policy;
    this.extract = extract;
    this.authorize = authorize;
  }

  async loadApprovedVersion(
    input: Readonly<{
      actor: Actor;
      projectId: string;
      documentVersionId: string;
      sourceChecksum: string;
    }>,
  ): Promise<ProgressContractDraftSource> {
    const readiness = await this.database.documentReadinessCheck.findFirst({
      where: {
        documentVersionId: input.documentVersionId,
        analyzedState: "ready_for_criteria_generation",
        lifecycleTransitions: { some: { toState: "criteria_approved" } },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, documentId: true, documentVersionId: true, stale: true },
    });
    if (readiness === null) throw invalidSource();

    const [document, version, lifecycle, identity] = await Promise.all([
      this.database.documentRecord.findUnique({
        where: { id: readiness.documentId },
        select: { id: true, projectId: true, workstreamId: true, currentVersion: true },
      }),
      this.database.documentVersion.findUnique({
        where: { id: input.documentVersionId },
        select: { id: true, documentId: true, version: true },
      }),
      this.database.documentReadinessLifecycleTransition.findFirst({
        where: { readinessCheckId: readiness.id },
        orderBy: [{ effectiveAt: "desc" }, { id: "desc" }],
        select: { toState: true },
      }),
      this.identityReader.read({ kind: "project", resourceId: input.projectId }),
    ]);
    if (
      document === null ||
      version === null ||
      identity === null ||
      identity.status !== "active" ||
      (version.version === document.currentVersion &&
        (readiness.stale || lifecycle?.toState !== "criteria_approved")) ||
      document.projectId !== input.projectId ||
      document.workstreamId !== null ||
      version.documentId !== document.id ||
      version.version > document.currentVersion
    ) {
      throw invalidSource();
    }

    const departmentScope = await this.database.authorizationScope.findFirst({
      where: { departmentId: identity.departmentId, scopeType: "department" },
      select: { id: true },
    });
    if (departmentScope === null) throw invalidSource();

    await this.authorize(this.database, input.actor, identity, "document.read", new Date());
    const canonical = await this.sourceLoader.load({
      documentVersionId: input.documentVersionId,
    });
    if (
      canonical.identity.kind !== "project" ||
      canonical.identity.projectId !== input.projectId ||
      canonical.documentId !== document.id ||
      canonical.documentVersionId !== version.id ||
      canonical.documentVersion !== version.version ||
      canonical.currentVersion !== document.currentVersion
    ) {
      throw invalidSource();
    }

    const extracted = await this.extract({
      policy: this.policy,
      sources: canonical.sources,
    });
    if (
      extracted.coverage !== "complete" ||
      extracted.sources.length === 0 ||
      extracted.sources.some(
        (source) =>
          source.coverage !== "complete" ||
          source.sha256 === undefined ||
          source.contentBase64 === undefined,
      )
    ) {
      throw new AppError(
        "PROGRESS_CONTRACT_DRAFT_SOURCE_EXTRACTION_FAILED",
        "errors.progressContractDraft.sourceExtractionFailed",
        409,
      );
    }

    const sourceChecksum = checksumOf(extracted.sources);
    if (sourceChecksum !== input.sourceChecksum) {
      throw new AppError(
        "PROGRESS_CONTRACT_DRAFT_SOURCE_CHECKSUM_MISMATCH",
        "errors.progressContractDraft.sourceChecksumMismatch",
        409,
      );
    }
    const quotedSections = extracted.sources.map((source) => ({
      reference: source.reference,
      mediaType: source.mediaType,
      text: Buffer.from(source.contentBase64!, "base64").toString("utf8"),
      trust: "untrusted" as const,
    }));
    if (
      quotedSections.reduce((sum, section) => sum + section.text.length, 0) >
      this.policy.maxQuotedCharacters
    ) {
      throw new AppError(
        "PROGRESS_CONTRACT_DRAFT_SOURCE_TOO_LARGE",
        "errors.progressContractDraft.sourceTooLarge",
        413,
      );
    }

    return {
      projectId: input.projectId,
      departmentScopeId: departmentScope.id,
      documentId: document.id,
      documentVersionId: version.id,
      documentVersion: version.version,
      sourceChecksum,
      sourceReferences: [...canonical.sourceReferences],
      quotedSections,
    };
  }
}

function checksumOf(sources: readonly Readonly<{ reference: string; sha256?: string }>[]): string {
  if (sources.length === 1) return sources[0]!.sha256!;
  const lineage = sources.map(({ reference, sha256 }) => ({ reference, sha256 }));
  return createHash("sha256").update(JSON.stringify(lineage)).digest("hex");
}

function invalidSource() {
  return new AppError(
    "PROGRESS_CONTRACT_DRAFT_SOURCE_INVALID",
    "errors.progressContractDraft.sourceInvalid",
    409,
  );
}
