import { createHash, randomUUID } from "node:crypto";

import { AppError, ExportRequestSchema } from "@evaluation/contracts";

import { renderHtml } from "./renderers/html.js";
import { renderPdf } from "./renderers/pdf.js";

export interface ReportObjectStorage {
  put(
    input: Readonly<{ key: string; content: Buffer; contentType: string; encrypted: true }>,
  ): Promise<void>;
  signGet(input: Readonly<{ key: string; expiresInSeconds: number }>): Promise<string>;
  probe?(): Promise<boolean>;
}

export class InMemoryReportStorage implements ReportObjectStorage {
  readonly objects = new Map<
    string,
    Readonly<{ content: Buffer; contentType: string; encrypted: true }>
  >();

  async put(
    input: Readonly<{ key: string; content: Buffer; contentType: string; encrypted: true }>,
  ) {
    this.objects.set(input.key, {
      content: Buffer.from(input.content),
      contentType: input.contentType,
      encrypted: true,
    });
  }

  async signGet(input: Readonly<{ key: string; expiresInSeconds: number }>) {
    return `memory-report:${input.key}:${input.expiresInSeconds}:${randomUUID()}`;
  }

  async probe() {
    return true;
  }
}

type RequestInput = Omit<import("@evaluation/contracts").ExportRequest, "schemaVersion">;
type Clock = () => Date;
type Expiry = (generatedAt: Date) => Date;
type ExportRequestRecord = Readonly<{
  id: string;
  requesterId: string;
  reportType: string;
  audience: string;
  format: string;
  locale: string;
  timezone: string;
  cycleId: string | null;
  state: string;
}>;
type ExportRequestResult = Readonly<{
  request: ExportRequestRecord;
  manifest: Readonly<{
    id: string;
    sourceVersions: import("./projection-registry.js").SourceVersion[];
    reportType: string;
    audience: string;
    format: string;
    locale: string;
    timezone: string;
    cycleId: string | null;
    renderAt: string;
  }>;
}>;
type ExportHistoryView = Readonly<{
  id: string;
  reportType: string;
  audience: string;
  format: string;
  locale: string;
  state: string;
  artifactId: string | null;
  expiresAt: string | null;
  createdAt: string;
}>;

export class ExportService {
  private readonly database: import("@evaluation/database").DatabaseClient;
  private readonly registry: import("./projection-registry.js").ProjectionRegistry;
  private readonly storage: ReportObjectStorage;
  private readonly now: Clock;
  private readonly expiresAt: Expiry;

  constructor(
    database: import("@evaluation/database").DatabaseClient,
    registry: import("./projection-registry.js").ProjectionRegistry,
    storage: ReportObjectStorage,
    now: Clock = () => new Date(),
    expiresAt: Expiry = (generatedAt) => new Date(generatedAt.getTime() + 24 * 60 * 60 * 1_000),
  ) {
    this.database = database;
    this.registry = registry;
    this.storage = storage;
    this.now = now;
    this.expiresAt = expiresAt;
  }

  async request(input: RequestInput): Promise<ExportRequestResult> {
    const parsed = ExportRequestSchema.parse({ schemaVersion: 1, ...input });
    if (parsed.locale === "ar" && isEvaluationReport(parsed.reportType)) {
      throw new AppError(
        "ARABIC_EVALUATION_NOT_APPROVED",
        "errors.exports.arabicEvaluationNotApproved",
        409,
      );
    }
    this.registry.resolve(parsed.reportType, parsed.audience);
    const existing = await this.database.exportRequest.findUnique({
      where: {
        requesterId_idempotencyKey: {
          requesterId: parsed.requesterId,
          idempotencyKey: parsed.idempotencyKey,
        },
      },
      include: { manifest: true },
    });
    if (existing?.manifest) return { request: existing, manifest: manifestView(existing.manifest) };

    const sourceVersions = await this.registry.pin(parsed.reportType, parsed.audience, {
      requesterId: parsed.requesterId,
      cycleId: parsed.cycleId,
    });
    const requestId = randomUUID();
    const manifestId = randomUUID();
    const renderAt = this.now();
    const [request, manifest] = await this.database.$transaction([
      this.database.exportRequest.create({
        data: {
          id: requestId,
          schemaVersion: 1,
          requesterId: parsed.requesterId,
          idempotencyKey: parsed.idempotencyKey,
          reportType: parsed.reportType,
          audience: parsed.audience,
          format: parsed.format,
          locale: parsed.locale,
          timezone: parsed.timezone,
          cycleId: parsed.cycleId,
        },
      }),
      this.database.exportManifest.create({
        data: {
          id: manifestId,
          requestId,
          schemaVersion: 1,
          projectionVersion: this.registry.resolve(parsed.reportType, parsed.audience)
            .projectionVersion,
          rendererVersion: 1,
          sourceVersions,
          requesterId: parsed.requesterId,
          reportType: parsed.reportType,
          audience: parsed.audience,
          format: parsed.format,
          locale: parsed.locale,
          timezone: parsed.timezone,
          cycleId: parsed.cycleId,
          renderAt,
        },
      }),
    ]);
    return { request, manifest: manifestView(manifest) };
  }

  async listRequests(requesterId: string, limit = 50): Promise<readonly ExportHistoryView[]> {
    const requests = await this.database.exportRequest.findMany({
      where: { requesterId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: Math.min(Math.max(limit, 1), 100),
      include: {
        manifest: {
          include: { artifact: { include: { revocations: { take: 1 } } } },
        },
      },
    });
    return requests.map((request) => {
      const artifact = request.manifest?.artifact;
      const state = artifact?.revocations.length
        ? "REVOKED"
        : artifact && artifact.expiresAt.getTime() <= this.now().getTime()
          ? "EXPIRED"
          : request.state;
      return {
        id: request.id,
        reportType: request.reportType,
        audience: request.audience,
        format: request.format,
        locale: request.locale,
        state,
        artifactId: artifact?.id ?? null,
        expiresAt: artifact?.expiresAt.toISOString() ?? null,
        createdAt: request.createdAt.toISOString(),
      };
    });
  }

  async materialize(requestId: string) {
    const request = await this.database.exportRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { manifest: { include: { artifact: true } } },
    });
    if (!request.manifest) throw new Error("EXPORT_MANIFEST_MISSING");
    if (request.manifest.artifact) return artifactView(request.manifest.artifact);
    const claimToken = randomUUID();
    const claimedAt = this.now();
    const claimed = await this.database.exportRequest.updateMany({
      where: {
        id: request.id,
        OR: [
          { state: { in: ["REQUESTED", "FAILED"] } },
          { state: "GENERATING", generationLeaseUntil: { lt: claimedAt } },
        ],
      },
      data: {
        state: "GENERATING",
        attemptCount: { increment: 1 },
        generationToken: claimToken,
        generationLeaseUntil: new Date(claimedAt.getTime() + 30_000),
      },
    });
    if (claimed.count !== 1) return this.waitForArtifact(request.id);
    try {
      const sourceVersions = request.manifest
        .sourceVersions as unknown as import("./projection-registry.js").SourceVersion[];
      const pins = request.manifest;
      const projection = await this.registry.read(
        pins.reportType as import("./projection-registry.js").ReportType,
        pins.audience as import("./projection-registry.js").ReportAudience,
        sourceVersions,
        { requesterId: pins.requesterId, cycleId: pins.cycleId },
      );
      const generatedAt = pins.renderAt;
      const content =
        pins.format === "PDF"
          ? renderPdf(projection)
          : Buffer.from(
              renderHtml(projection, {
                locale: pins.locale as "en" | "ar",
                timezone: pins.timezone,
                generatedAt,
              }),
            );
      const contentType = pins.format === "PDF" ? "application/pdf" : "text/html";
      const contentHash = createHash("sha256").update(content).digest("hex");
      const storageKey = `reports/${request.id}/${contentHash}.${pins.format.toLowerCase()}`;
      await this.storage.put({ key: storageKey, content, contentType, encrypted: true });
      const artifact = await this.database.$transaction(async (transaction) => {
        const created = await transaction.exportArtifact.create({
          data: {
            id: randomUUID(),
            manifestId: request.manifest!.id,
            storageKey,
            contentHash,
            byteSize: content.byteLength,
            contentType,
            encrypted: true,
            expiresAt: this.expiresAt(generatedAt),
            createdAt: generatedAt,
          },
        });
        const completed = await transaction.exportRequest.updateMany({
          where: { id: request.id, state: "GENERATING", generationToken: claimToken },
          data: {
            state: "READY",
            failureCategory: null,
            generationToken: null,
            generationLeaseUntil: null,
          },
        });
        if (completed.count !== 1) throw new Error("EXPORT_GENERATION_CLAIM_LOST");
        return created;
      });
      return artifactView(artifact);
    } catch {
      await this.database.exportRequest.updateMany({
        where: { id: request.id, state: "GENERATING", generationToken: claimToken },
        data: {
          state: "FAILED",
          failureCategory: "GENERATION",
          generationToken: null,
          generationLeaseUntil: null,
        },
      });
      throw new Error("EXPORT_GENERATION_FAILED");
    }
  }

  async materializeFor(requesterId: string, requestId: string) {
    const request = await this.database.exportRequest.findUnique({ where: { id: requestId } });
    if (!request || request.requesterId !== requesterId) {
      throw new AppError("EXPORT_FORBIDDEN", "errors.exports.forbidden", 403);
    }
    return this.materialize(requestId);
  }

  async readRequest(
    requesterId: string,
    requestId: string,
  ): Promise<
    Readonly<{ id: string; state: string; artifactId: string | null; expiresAt: Date | null }>
  > {
    const request = await this.database.exportRequest.findUnique({
      where: { id: requestId },
      include: {
        manifest: {
          include: { artifact: { include: { revocations: { take: 1 } } } },
        },
      },
    });
    if (!request || request.requesterId !== requesterId) {
      throw new AppError("EXPORT_FORBIDDEN", "errors.exports.forbidden", 403);
    }
    const artifact = request.manifest?.artifact;
    const state = artifact?.revocations.length
      ? "REVOKED"
      : artifact && artifact.expiresAt.getTime() <= this.now().getTime()
        ? "EXPIRED"
        : request.state;
    return {
      id: request.id,
      state,
      artifactId: artifact?.id ?? null,
      expiresAt: artifact?.expiresAt ?? null,
    };
  }

  private async waitForArtifact(requestId: string) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const current = await this.database.exportRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: { manifest: { include: { artifact: true } } },
      });
      if (current.manifest?.artifact) return artifactView(current.manifest.artifact);
      if (current.state === "FAILED") throw new Error("EXPORT_GENERATION_FAILED");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw Object.assign(new Error("EXPORT_GENERATION_IN_PROGRESS"), { retryable: true as const });
  }
}

function isEvaluationReport(reportType: string) {
  return new Set(["EMPLOYEE_EVALUATION", "DEPARTMENT_EVALUATION", "MANAGER_UPWARD_FEEDBACK"]).has(
    reportType,
  );
}

function manifestView(manifest: {
  id: string;
  sourceVersions: unknown;
  reportType: string;
  audience: string;
  format: string;
  locale: string;
  timezone: string;
  cycleId: string | null;
  renderAt: Date;
}) {
  return {
    id: manifest.id,
    sourceVersions: manifest.sourceVersions as import("./projection-registry.js").SourceVersion[],
    reportType: manifest.reportType,
    audience: manifest.audience,
    format: manifest.format,
    locale: manifest.locale,
    timezone: manifest.timezone,
    cycleId: manifest.cycleId,
    renderAt: manifest.renderAt.toISOString(),
  };
}

function artifactView(artifact: {
  id: string;
  storageKey: string;
  contentHash: string;
  byteSize: bigint;
  contentType: string;
  expiresAt: Date;
}) {
  return {
    artifactId: artifact.id,
    storageKey: artifact.storageKey,
    contentHash: artifact.contentHash,
    byteSize: Number(artifact.byteSize),
    contentType: artifact.contentType,
    expiresAt: artifact.expiresAt,
  };
}
