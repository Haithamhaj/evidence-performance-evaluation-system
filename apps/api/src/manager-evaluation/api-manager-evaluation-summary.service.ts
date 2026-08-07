import {
  createRuntimeAiRouter,
  EnvironmentAiCredentialSecretResolver,
} from "@evaluation/ai-routing";
import { createDatabaseClient } from "@evaluation/database";
import { ManagerEvaluationSummaryService } from "@evaluation/manager-evaluation";

import { createDeferredRuntimeAiRouter } from "../ai-routing/deferred-runtime-ai-router.js";
import { resolveSystemAiScopeId } from "../ai-routing/system-ai-scope.js";

type Database = ReturnType<typeof createDatabaseClient>;

export class ApiManagerEvaluationSummaryService {
  private readonly database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  async createSummary(input: Readonly<{ cycleId: string; managerId: string }>) {
    const router = createDeferredRuntimeAiRouter(() =>
      createRuntimeAiRouter({
        database: this.database,
        secretResolver: new EnvironmentAiCredentialSecretResolver(),
      }),
    );
    return new ManagerEvaluationSummaryService({
      database: this.database,
      router,
      systemId: await resolveSystemAiScopeId(this.database, "manager-evaluation.summary"),
      timeoutMs: 30_000,
    }).createSummary(input);
  }
}
