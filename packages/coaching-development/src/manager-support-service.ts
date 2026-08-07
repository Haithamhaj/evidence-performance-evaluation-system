import { AddManagerSupportInputSchema, AppError } from "@evaluation/contracts";

type Store = Readonly<{ find(actionId: string): Promise<{ privacy: string; employeeId: string } | null>; append(entry: Record<string, unknown>): Promise<void> }>;
export class ManagerSupportService {
  constructor(private readonly store: Store) {}
  async append(input: unknown) {
    const parsed = AddManagerSupportInputSchema.parse(input);
    const action = await this.store.find(parsed.actionId);
    if (!action || action.privacy !== "SHARED") throw new AppError("AUTHZ_SCOPE", "errors.coaching.invalid", 403);
    await this.store.append(parsed);
    return { actionId: parsed.actionId, managerId: parsed.managerId, kind: parsed.kind };
  }
}
