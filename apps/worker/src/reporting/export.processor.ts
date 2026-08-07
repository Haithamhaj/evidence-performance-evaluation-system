export class ExportProcessor {
  private readonly exports: import("@evaluation/reporting").ExportService;

  constructor(exports: import("@evaluation/reporting").ExportService) {
    this.exports = exports;
  }

  process(job: Readonly<{ requestId: string }>) {
    return this.exports.generate(job.requestId);
  }
}
