import { createHash, randomUUID } from "node:crypto";

import { AppError, ExportRequestSchema } from "@evaluation/contracts";

import { renderHtml } from "./renderers/html.js";
import { renderPdf } from "./renderers/pdf.js";

export interface ReportObjectStorage {
  put(input: Readonly<{ key: string; content: Buffer; contentType: string; encrypted: true }>): Promise<void>;
  signGet(input: Readonly<{ key: string; expiresInSeconds: number }>): Promise<string>;
}

export class InMemoryReportStorage implements ReportObjectStorage {
  readonly objects = new Map<string, Readonly<{ content: Buffer; contentType: string; encrypted: true }>>();

  async put(input: Readonly<{ key: string; content: Buffer; contentType: string; encrypted: true }>) {
    this.objects.set(input.key, {
      content: Buffer.from(input.content),
      contentType: input.contentType,
      encrypted: true,
    });
  }

  async signGet(input: Readonly<{ key: string; expiresInSeconds: number }>) {
    return `memory-report:${input.key}:${input.expiresInSeconds}:${randomUUID()}`;
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
  }>;
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

    const sourceVersions = await this.registry.pin(parsed.reportType, parsed.audience);
    const requestId = randomUUID();
    const manifestId = randomUUID();
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
          projectionVersion: this.registry.resolve(parsed.reportType, parsed.audience).projectionVersion,
          rendererVersion: 1,
          sourceVersions,
        },
      }),
    ]);
    return { request, manifest: manifestView(manifest) };
  }

  async generate(requestId: string) {
    const request = await this.database.exportRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { manifest: { include: { artifact: true } } },
    });
    if (!request.manifest) throw new Error("EXPORT_MANIFEST_MISSING");
    if (request.manifest.artifact) return artifactView(request.manifest.artifact);
    await this.database.exportRequest.update({
      where: { id: request.id },
      data: { state: "GENERATING", attemptCount: { increment: 1 } },
    });
    const sourceVersions = request.manifest.sourceVersions as unknown as import("./projection-registry.js").SourceVersion[];
    const projection = await this.registry.read(
      request.reportType as import("./projection-registry.js").ReportType,
      request.audience as import("./projection-registry.js").ReportAudience,
      sourceVersions,
    );
    const generatedAt = this.now();
    const content =
      request.format === "PDF"
        ? renderPdf(projection)
        : Buffer.from(
            renderHtml(projection, {
              locale: request.locale as "en" | "ar",
              timezone: request.timezone,
              generatedAt,
            }),
          );
    const contentType = request.format === "PDF" ? "application/pdf" : "text/html";
    const contentHash = createHash("sha256").update(content).digest("hex");
    const storageKey = `reports/${request.id}/${contentHash}.${request.format.toLowerCase()}`;
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
      await transaction.exportRequest.update({ where: { id: request.id }, data: { state: "READY" } });
      return created;
    });
    return artifactView(artifact);
  }
}

function isEvaluationReport(reportType: string) {
  return new Set(["EMPLOYEE_EVALUATION", "DEPARTMENT_EVALUATION", "MANAGER_UPWARD_FEEDBACK"]).has(
    reportType,
  );
}

function manifestView(manifest: { id: string; sourceVersions: unknown }) {
  return {
    id: manifest.id,
    sourceVersions: manifest.sourceVersions as import("./projection-registry.js").SourceVersion[],
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
