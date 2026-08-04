export type ApprovedProgressDocumentSource = Readonly<{
  documentId: string;
  documentVersionId: string;
  documentVersion: number;
  readinessCheckId: string;
  projectId: string | null;
  workstreamId: string | null;
  sourceReferences: readonly string[];
}>;

export interface ApprovedProgressDocumentSourceReader {
  getApprovedSource(input: {
    documentVersionId: string;
  }): Promise<ApprovedProgressDocumentSource | null>;
  getApprovedSourceIn(
    transaction: import("./model.js").DocumentTransaction,
    input: { documentVersionId: string },
  ): Promise<ApprovedProgressDocumentSource | null>;
}

export class ProgressDocumentReader implements ApprovedProgressDocumentSourceReader {
  private readonly database: import("./model.js").DocumentDatabase;

  constructor(database: import("./model.js").DocumentDatabase) {
    this.database = database;
  }

  async getApprovedSource(
    input: Readonly<{ documentVersionId: string }>,
  ): Promise<ApprovedProgressDocumentSource | null> {
    return this.getApprovedSourceUsing(this.database, input);
  }

  async getApprovedSourceIn(
    transaction: import("./model.js").DocumentTransaction,
    input: Readonly<{ documentVersionId: string }>,
  ): Promise<ApprovedProgressDocumentSource | null> {
    await transaction.$queryRaw`
      SELECT document.id
      FROM "DocumentRecord" document
      INNER JOIN "DocumentVersion" version ON version."documentId" = document.id
      WHERE version.id = ${input.documentVersionId}::uuid
      FOR UPDATE OF document
    `;
    return this.getApprovedSourceUsing(transaction, input);
  }

  private async getApprovedSourceUsing(
    database: Pick<
      import("./model.js").DocumentDatabase,
      | "documentReadinessCheck"
      | "documentReadinessLifecycleTransition"
      | "documentRecord"
      | "documentVersion"
    >,
    input: Readonly<{ documentVersionId: string }>,
  ): Promise<ApprovedProgressDocumentSource | null> {
    const readiness = await database.documentReadinessCheck.findFirst({
      where: {
        documentVersionId: input.documentVersionId,
        analyzedState: "ready_for_criteria_generation",
        stale: false,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        documentId: true,
        documentVersionId: true,
        sourceReferences: true,
      },
    });
    if (readiness === null) return null;

    const [document, version, lifecycle] = await Promise.all([
      database.documentRecord.findUnique({
        where: { id: readiness.documentId },
        select: { currentVersion: true, projectId: true, workstreamId: true },
      }),
      database.documentVersion.findUnique({
        where: { id: readiness.documentVersionId },
        select: { documentId: true, version: true },
      }),
      database.documentReadinessLifecycleTransition.findFirst({
        where: { readinessCheckId: readiness.id },
        orderBy: [{ effectiveAt: "desc" }, { id: "desc" }],
        select: { toState: true },
      }),
    ]);

    if (
      document === null ||
      version === null ||
      lifecycle?.toState !== "criteria_approved" ||
      version.documentId !== readiness.documentId ||
      version.version !== document.currentVersion ||
      (document.projectId === null && document.workstreamId === null)
    ) {
      return null;
    }

    return {
      documentId: readiness.documentId,
      documentVersionId: readiness.documentVersionId,
      documentVersion: version.version,
      readinessCheckId: readiness.id,
      projectId: document.projectId,
      workstreamId: document.workstreamId,
      sourceReferences: Array.isArray(readiness.sourceReferences)
        ? (readiness.sourceReferences as string[])
        : [],
    };
  }
}
