import { AppError } from "@evaluation/contracts";

export class DocumentAnalysisSourceLoader {
  private readonly database: import("./model.js").DocumentDatabase;
  private readonly storage: import("./model.js").PrivateObjectStorage;
  private readonly policy: Readonly<{ maxSourceBytes: number }>;

  constructor(
    database: import("./model.js").DocumentDatabase,
    storage: import("./model.js").PrivateObjectStorage,
    policy: Readonly<{ maxSourceBytes: number }>,
  ) {
    this.database = database;
    this.storage = storage;
    this.policy = policy;
  }

  async load(
    input: Readonly<{ documentVersionId: string }>,
  ): Promise<import("./analysis-model.js").CanonicalAnalysisSources> {
    const version = await this.database.documentVersion.findUnique({
      where: { id: input.documentVersionId },
      include: {
        document: true,
        templateVersion: { include: { sections: { orderBy: { position: "asc" } } } },
        sources: {
          orderBy: { position: "asc" },
          include: { uploadedSource: true },
        },
      },
    });
    if (version === null) throw notFound();
    const resourceId = version.document.workstreamId ?? version.document.projectId;
    if (resourceId === null) throw notFound();
    const kind = version.document.workstreamId === null ? "project" : "workstream";
    const identity = {
      kind,
      resourceId,
      projectId: version.document.projectId ?? resourceId,
      organizationId: version.document.organizationId,
      departmentId: version.document.departmentId,
      status: "active",
    } as const;
    const sources = version.sources.map((source) => {
      const reference = `document-source:${source.id}`;
      if (source.sourceType === "upload" && source.uploadedSource !== null) {
        const uploaded = source.uploadedSource;
        return {
          reference,
          sourceType: "upload" as const,
          mediaType: uploaded.detectedMime,
          expectedSha256: uploaded.sha256,
          openStream: () =>
            this.storage.readStream({
              key: uploaded.objectKey,
              maxBytes: this.policy.maxSourceBytes,
            }),
        };
      }
      return {
        reference,
        sourceType: source.sourceType,
        mediaType:
          source.sourceType === "github"
            ? "application/vnd.github+json"
            : "text/uri-list",
      };
    });
    return {
      identity,
      documentId: version.document.id,
      documentVersionId: version.id,
      documentVersion: version.version,
      currentVersion: version.document.currentVersion,
      templateVersionId: version.templateVersionId,
      templateSections: version.templateVersion.sections.map((section) => ({
        key: section.key,
        required: section.required,
        protected: section.protected,
        position: section.position,
        display: section.display,
      })),
      sources,
      sourceReferences: sources.map(({ reference }) => reference),
    };
  }
}

function notFound() {
  return new AppError("RESOURCE_NOT_FOUND", "errors.documents.resourceNotFound", 404);
}
