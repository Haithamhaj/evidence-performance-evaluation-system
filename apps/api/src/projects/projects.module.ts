import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";
import {
  createProjectService,
  createResponsibilityService,
  createWorkstreamService,
  ProjectService,
  ResponsibilityService,
  WorkstreamService,
} from "@evaluation/projects";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { PROJECTS_POLICY_DATABASE, ProjectPolicyGuard } from "./project-policy-loaders.js";
import { ProjectsController } from "./projects.controller.js";
import { ResponsibilitiesController } from "./responsibilities.controller.js";
import { WorkstreamsController } from "./workstreams.controller.js";

const PROJECTS_DATABASE = Symbol("PROJECTS_DATABASE");
const PROJECTS_DATABASE_LIFECYCLE = Symbol("PROJECTS_DATABASE_LIFECYCLE");

function requiredDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (value === undefined || value.length === 0) throw new Error("DATABASE_URL must be configured");
  return value;
}

export class ProjectsModule {}

Module({
  imports: [AuthModule],
  controllers: [ProjectsController, WorkstreamsController, ResponsibilitiesController],
  providers: [
    {
      provide: PROJECTS_DATABASE,
      useFactory: () => createDatabaseClient(requiredDatabaseUrl()),
    },
    {
      provide: PROJECTS_POLICY_DATABASE,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) => client,
      inject: [PROJECTS_DATABASE],
    },
    {
      provide: PROJECTS_DATABASE_LIFECYCLE,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) => ({
        onModuleDestroy: () => client.$disconnect(),
      }),
      inject: [PROJECTS_DATABASE],
    },
    {
      provide: ProjectService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        createProjectService(client, databaseAuditWriter as never),
      inject: [PROJECTS_DATABASE],
    },
    {
      provide: WorkstreamService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        createWorkstreamService(client, databaseAuditWriter as never),
      inject: [PROJECTS_DATABASE],
    },
    {
      provide: ResponsibilityService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        createResponsibilityService(client, databaseAuditWriter as never),
      inject: [PROJECTS_DATABASE],
    },
    ProjectPolicyGuard,
  ],
})(ProjectsModule);
