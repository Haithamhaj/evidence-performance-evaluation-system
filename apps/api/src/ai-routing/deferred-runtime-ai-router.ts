import type { AiRouter } from "@evaluation/ai-routing";
import type { DatabaseTransaction } from "@evaluation/database";

type RuntimeAiRouter = AiRouter<DatabaseTransaction>;
type RuntimeAiRouterFactory = () => Promise<RuntimeAiRouter>;

export function createDeferredRuntimeAiRouter(
  factory: RuntimeAiRouterFactory,
): Pick<RuntimeAiRouter, "run"> {
  return {
    async run(input, persistValidatedOutput) {
      const router = await factory();
      return router.run(input, persistValidatedOutput);
    },
  };
}
