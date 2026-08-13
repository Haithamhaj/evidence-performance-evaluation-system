import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";
import { PrismaApprovedLeaveReader } from "@evaluation/continuity";
import { ProgressContractDraftSourceLocator, ProgressDocumentReader } from "@evaluation/documents";
import {
  CriteriaReviewReader,
  createProgressContractService,
  DocumentResourceReader,
  ProgressContractService,
  ProgressQueryService,
} from "@evaluation/projects";
import { PrivateInboxQueryService, WorkItemQueryService } from "@evaluation/work-items";
import { ActivityReader, CheckInService } from "@evaluation/updates-evidence";
import { ProjectService } from "@evaluation/projects";
import { ResearchReadinessReader } from "@evaluation/research-experiments";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { WorkItemsPolicyGuard } from "../work-items/work-items-policy.guard.js";
import { OperationsModule } from "../operations/operations.module.js";
import { ExperienceEventRuntime } from "../operations/experience-event-runtime.js";
import { DailyWorkController, ProgressContractsController } from "./daily-work.controller.js";
import { DailyWorkQueryService } from "./daily-work-query.service.js";
import { EmployeeHomeQueryService } from "./employee-home-query.service.js";
import { ProjectDashboardQueryService } from "./project-dashboard-query.service.js";
import { ProjectExperienceQueryService } from "./project-experience-query.service.js";
import {
  createDatabaseManagerOperationsQueryService,
  ManagerOperationsQueryService,
} from "./manager-operations-query.service.js";
import {
  createDatabaseCheckInService,
  createDatabaseReadinessQueryService,
  ReadinessQueryService,
} from "./readiness-query.service.js";

const DAILY_WORK_DATABASE = Symbol("DAILY_WORK_DATABASE");
const DAILY_WORK_DATABASE_LIFECYCLE = Symbol("DAILY_WORK_DATABASE_LIFECYCLE");

export class DailyWorkModule {}

Module({
  imports: [AuthModule, OperationsModule],
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
      provide: ProjectService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        new ProjectService(client, databaseAuditWriter as never, () => new Date()),
      inject: [DAILY_WORK_DATABASE],
    },
    {
      provide: ActivityReader,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) => new ActivityReader(client),
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
        createDatabaseCheckInService(client, new PrismaApprovedLeaveReader(client)),
      inject: [DAILY_WORK_DATABASE],
    },
    {
      provide: ReadinessQueryService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        createDatabaseReadinessQueryService(
          client,
          new ResearchReadinessReader(client),
          new PrismaApprovedLeaveReader(client),
        ),
      inject: [DAILY_WORK_DATABASE],
    },
    {
      provide: ManagerOperationsQueryService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        createDatabaseManagerOperationsQueryService(client),
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
    {
      provide: EmployeeHomeQueryService,
      useFactory: (dailyWork: DailyWorkQueryService, experience: ExperienceEventRuntime) =>
        new EmployeeHomeQueryService(dailyWork, experience),
      inject: [DailyWorkQueryService, ExperienceEventRuntime],
    },
    {
      provide: ProjectExperienceQueryService,
      useFactory: (
        dailyWork: DailyWorkQueryService,
        projects: ProjectService,
        activity: ActivityReader,
      ) =>
        new ProjectExperienceQueryService({
          project: async (actorId, projectId) => {
            const [progress, workspace] = await Promise.all([
              dailyWork.project(actorId, projectId),
              projects.getWorkspace({ actor: { userId: actorId, active: true }, projectId }),
            ]);
            return { ...(progress as object), workspace };
          },
          myWork: (actorId) => dailyWork.myWork(actorId),
          timeline: (input) => activity.timeline(input),
        }),
      inject: [DailyWorkQueryService, ProjectService, ActivityReader],
    },
    WorkItemsPolicyGuard,
  ],
  exports: [CheckInService, DailyWorkQueryService],
})(DailyWorkModule);
