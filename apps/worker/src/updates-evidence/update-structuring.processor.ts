import type { AiRouter, PersistValidatedOutput } from "@evaluation/ai-routing";
import type { DatabaseTransaction } from "@evaluation/database";
import { runGovernedUpdateStructure } from "@evaluation/updates-evidence";

type Router = Pick<AiRouter<DatabaseTransaction>, "run">;
type Persist = PersistValidatedOutput<
  import("@evaluation/contracts").UpdateStructureAiOutput,
  DatabaseTransaction
>;

export class UpdateStructuringProcessor {
  private readonly router: Router;
  private readonly options: Readonly<{ systemId: string; timeoutMs: number }>;

  constructor(router: Router, options: Readonly<{ systemId: string; timeoutMs: number }>) {
    this.router = router;
    this.options = options;
  }

  process(input: unknown, persistValidatedOutput: Persist) {
    return runGovernedUpdateStructure(this.router, this.options, input, persistValidatedOutput);
  }
}
