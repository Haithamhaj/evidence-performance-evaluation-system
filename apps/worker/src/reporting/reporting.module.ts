import { Module } from "@nestjs/common";

// Runtime deployments provide source-domain projection readers and approved
// private object storage through the operations composition root. Keeping this
// module dependency-free prevents a second reporting data authority.
export class ReportingWorkerModule {}

Module({})(ReportingWorkerModule);
