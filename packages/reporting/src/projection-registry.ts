import type { ExportAudienceSchema, ExportReportTypeSchema } from "@evaluation/contracts";
import type { z } from "zod";

export type ReportType = z.infer<typeof ExportReportTypeSchema>;
export type ReportAudience = z.infer<typeof ExportAudienceSchema>;
export type SourceVersion = Readonly<{ source: string; snapshotId: string; version: number }>;
export type ReportProjection = Readonly<{ title: string; lines: readonly string[] }>;
export type ProjectionContext = Readonly<{ requesterId: string; cycleId: string | null }>;

export type ProjectionRegistration = Readonly<{
  reportType: ReportType;
  audience: ReportAudience;
  source: string;
  projectionVersion: number;
  authorizeCurrent(context: ProjectionContext): Promise<boolean>;
  snapshot(context: ProjectionContext): Promise<Readonly<{ snapshotId: string; version: number }>>;
  read(version: SourceVersion, context: ProjectionContext): Promise<ReportProjection>;
}>;

export class ProjectionRegistry {
  private readonly entries = new Map<string, ProjectionRegistration>();

  register(entry: ProjectionRegistration) {
    const key = registryKey(entry.reportType, entry.audience);
    if (this.entries.has(key)) throw new Error(`Projection already registered: ${key}`);
    this.entries.set(key, entry);
  }

  resolve(reportType: ReportType, audience: ReportAudience) {
    const entry = this.entries.get(registryKey(reportType, audience));
    if (!entry) throw new Error("REPORT_PROJECTION_NOT_ALLOWED");
    return entry;
  }

  async pin(
    reportType: ReportType,
    audience: ReportAudience,
    context: ProjectionContext,
  ): Promise<SourceVersion[]> {
    const entry = this.resolve(reportType, audience);
    const snapshot = await entry.snapshot(context);
    return [{ source: entry.source, ...snapshot }];
  }

  async read(
    reportType: ReportType,
    audience: ReportAudience,
    versions: readonly SourceVersion[],
    context: ProjectionContext,
  ) {
    const entry = this.resolve(reportType, audience);
    const pinned = versions.find(({ source }) => source === entry.source);
    if (!pinned) throw new Error("REPORT_SOURCE_VERSION_MISSING");
    return entry.read(pinned, context);
  }

  authorizeCurrent(reportType: ReportType, audience: ReportAudience, context: ProjectionContext) {
    return this.resolve(reportType, audience).authorizeCurrent(context);
  }
}

function registryKey(reportType: ReportType, audience: ReportAudience) {
  return `${reportType}:${audience}`;
}
