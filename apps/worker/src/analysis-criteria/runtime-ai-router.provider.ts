import {
  createRuntimeAiRouter,
  EnvironmentAiCredentialSecretResolver,
} from "@evaluation/ai-routing";

export const ANALYSIS_CRITERIA_DATABASE = Symbol("ANALYSIS_CRITERIA_DATABASE");
export const ANALYSIS_CRITERIA_AI_ROUTER = Symbol("ANALYSIS_CRITERIA_AI_ROUTER");
export const ANALYSIS_CRITERIA_SECRET_RESOLVER = Symbol("ANALYSIS_CRITERIA_SECRET_RESOLVER");

export class WorkerEnvironmentAiCredentialSecretResolver extends EnvironmentAiCredentialSecretResolver {}

export function createWorkerRuntimeAiRouter(
  database: import("@evaluation/database").DatabaseClient,
  secretResolver: import("@evaluation/ai-routing").AiCredentialSecretResolver,
): Promise<
  import("@evaluation/ai-routing").AiRouter<import("@evaluation/database").DatabaseTransaction>
> {
  return createRuntimeAiRouter({ database, secretResolver });
}
