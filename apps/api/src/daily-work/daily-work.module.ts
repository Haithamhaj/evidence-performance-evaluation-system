import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";
import { ProgressContractDraftSourceLocator, ProgressDocumentReader } from "@evaluation/documents";
import {
  CriteriaReviewReader,
  createProgressContractService,
  DocumentResourceReader,
  ProgressContractService,
  ProgressQueryService,
} from "@evaluation/projects";
import { PrivateInboxQueryService, WorkItemQueryService } from "@evaluation/work-items";
import { CheckInService } from "@evaluation/updates-evidence";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { WorkItemsPolicyGuard } from "../work-items/work-items-policy.guard.js";
import { DailyWorkController, ProgressContractsController } from "./daily-work.controller.js";
import { DailyWorkQueryService } from "./daily-work-query.service.js";
import { ProjectDashboardQueryService } from "./project-dashboard-query.service.js";
import {
  createDatabaseCheckInService,
  createDatabaseReadinessQueryService,
  ReadinessQueryService,
} from "./readiness-query.service.js";

const DAILY_WORK_DATABASE = Symbol("DAILY_WORK_DATABASE");
const DAILY_WORK_DATABASE_LIFECYCLE = Symbol("DAILY_WORK_DATABASE_LIFECYCLE");

export class DailyWorkModule {}

Module({
  imports: [AuthModule],
  controllers: [DailyWorkController, ProgressContractsController],
  providers: [
    {
      provide: DAILY_WORK_DATABASE,
      useFactory: () => {
        const url = process.env.DATABASE_URL?.trim();
        if (!url) throw new Error("DATABASE_URL must be configured");
        return createDatabaseClient(url);
      },
    },
    {
      provide: WorkItemQueryService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        new WorkItemQueryService(client),
      inject: [DAILY_WORK_DATABASE],
    },
    {
      provide: PrivateInboxQueryService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        new PrivateInboxQueryService(client),
      inject: [DAILY_WORK_DATABASE],
    },
    {
      provide: ProgressQueryService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        new ProgressQueryService(client),
      inject: [DAILY_WORK_DATABASE],
    },
    {
      provide: ProgressContractService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        createProgressContractService(
          client,
          new ProgressDocumentReader(client),
          new CriteriaReviewReader(client),
          databaseAuditWriter as never,
        ),
      inject: [DAILY_WORK_DATABASE],
    },
    {
      provide: ProgressContractDraftSourceLocator,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        new ProgressContractDraftSourceLocator(client, new DocumentResourceReader(client)),
      inject: [DAILY_WORK_DATABASE],
    },
    {
      provide: ProjectDashboardQueryService,
      useFactory: (progress: ProgressQueryService) => new ProjectDashboardQueryService(progress),
      inject: [ProgressQueryService],
    },
    {
      provide: CheckInService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        createDatabaseCheckInService(client),
      inject: [DAILY_WORK_DATABASE],
    },
    {
      provide: ReadinessQueryService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        createDatabaseReadinessQueryService(client),
      inject: [DAILY_WORK_DATABASE],
    },
    {
      provide: DailyWorkQueryService,
      useFactory: (
        workItems: WorkItemQueryService,
        progress: ProgressQueryService,
        sourceRequests: ProgressContractDraftSourceLocator,
        inbox: PrivateInboxQueryService,
        projectDashboard: ProjectDashboardQueryService,
      ) => new DailyWorkQueryService(workItems, progress, sourceRequests, inbox, projectDashboard),
      inject: [
        WorkItemQueryService,
        ProgressQueryService,
        ProgressContractDraftSourceLocator,
        PrivateInboxQueryService,
        ProjectDashboardQueryService,
      ],
    },
    {
      provide: DAILY_WORK_DATABASE_LIFECYCLE,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) => ({
        onModuleDestroy: () => client.$disconnect(),
      }),
      inject: [DAILY_WORK_DATABASE],
    },
    WorkItemsPolicyGuard,
  ],
})(DailyWorkModule);
