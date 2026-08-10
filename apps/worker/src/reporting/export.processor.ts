export class ExportProcessor {
  private readonly exports: import("@evaluation/reporting").ExportService;
  private readonly onReady:
    | ((
        input: Readonly<{
          requestId: string;
          requesterId: string;
          artifactId: string;
        }>,
      ) => Promise<unknown>)
    | undefined;

  constructor(
    exports: import("@evaluation/reporting").ExportService,
    onReady?: (
      input: Readonly<{
        requestId: string;
        requesterId: string;
        artifactId: string;
      }>,
    ) => Promise<unknown>,
  ) {
    this.exports = exports;
    this.onReady = onReady;
  }

  async process(job: Readonly<{ requestId: string; requesterId: string }>) {
    const artifact = await this.exports.materialize(job.requestId);
    await this.onReady?.({
      requestId: job.requestId,
      requesterId: job.requesterId,
      artifactId: artifact.artifactId,
    });
    return artifact;
  }
}
