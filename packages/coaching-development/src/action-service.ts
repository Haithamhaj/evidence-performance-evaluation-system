/* eslint-disable no-unused-vars */
import {
  AppError,
  ChangeDevelopmentActionPrivacyInputSchema,
  CreateDevelopmentActionInputSchema,
  ReviseDevelopmentActionInputSchema,
  TransitionDevelopmentActionInputSchema,
} from "@evaluation/contracts";

type Action = Readonly<{
  id: string;
  employeeId: string;
  privacy: "PRIVATE" | "SHARED";
  state: string;
  version: number;
}>;
type Store = Readonly<{
  find(actionId: string): Promise<Action | null>;
  append(event: Record<string, unknown>): Promise<void>;
  create?(input: Record<string, unknown>): Promise<{ id: string; version: number }>;
  revise?(input: Record<string, unknown>): Promise<{ id: string; version: number }>;
  changePrivacy?(input: Record<string, unknown>): Promise<{ id: string; version: number }>;
  isAuthorizedManager?(employeeId: string, managerId: string): Promise<boolean>;
}>;
const next: Readonly<Record<string, readonly string[]>> = {
  DRAFT: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["ACTIVE", "DEFERRED", "CANCELLED", "SUPERSEDED"],
  ACTIVE: ["COMPLETED", "DEFERRED", "CANCELLED", "SUPERSEDED"],
  DEFERRED: ["ACTIVE", "CANCELLED", "SUPERSEDED"],
};

export class DevelopmentActionService {
  constructor(private readonly store: Store) {}
  async create(input: unknown) {
    const parsed = CreateDevelopmentActionInputSchema.parse(input);
    if (!this.store.create) throw fail("DEVELOPMENT_ACTION_STORE_UNAVAILABLE", 500);
    return this.store.create(parsed);
  }
  async revise(input: unknown) {
    const parsed = ReviseDevelopmentActionInputSchema.parse(input);
    const action = await this.require(parsed.actionId);
    if (action.employeeId !== parsed.employeeId) throw fail("AUTHZ_ACTION", 403);
    if (action.version !== parsed.expectedVersion) throw fail("VERSION_CONFLICT", 409);
    if (!this.store.revise) throw fail("DEVELOPMENT_ACTION_STORE_UNAVAILABLE", 500);
    return this.store.revise(parsed);
  }
  async changePrivacy(input: unknown) {
    const parsed = ChangeDevelopmentActionPrivacyInputSchema.parse(input);
    const action = await this.require(parsed.actionId);
    if (action.employeeId !== parsed.employeeId) throw fail("AUTHZ_ACTION", 403);
    if (action.version !== parsed.expectedVersion) throw fail("VERSION_CONFLICT", 409);
    if (!this.store.changePrivacy) throw fail("DEVELOPMENT_ACTION_STORE_UNAVAILABLE", 500);
    return this.store.changePrivacy(parsed);
  }
  async read(input: Readonly<{ actionId: string; actorId: string; managerId?: string }>) {
    const action = await this.require(input.actionId);
    if (
      action.employeeId !== input.actorId &&
      !(action.privacy === "SHARED" &&
        input.managerId === input.actorId &&
        (await this.store.isAuthorizedManager?.(action.employeeId, input.actorId)))
    )
      throw fail("AUTHZ_SCOPE", 403);
    return action;
  }
  async transition(input: unknown) {
    const parsed = TransitionDevelopmentActionInputSchema.parse(input);
    const action = await this.require(parsed.actionId);
    if (action.employeeId !== parsed.employeeId) throw fail("AUTHZ_ACTION", 403);
    if (action.version !== parsed.expectedVersion) throw fail("VERSION_CONFLICT", 409);
    if (!next[action.state]?.includes(parsed.toState))
      throw fail("DEVELOPMENT_ACTION_TRANSITION_INVALID", 409);
    await this.store.append({
      ...parsed,
      fromState: action.state,
      resultingVersion: action.version + 1,
    });
    return { actionId: action.id, state: parsed.toState, version: action.version + 1 };
  }
  private async require(id: string) {
    const action = await this.store.find(id);
    if (!action) throw fail("DEVELOPMENT_ACTION_NOT_FOUND", 404);
    return action;
  }
}
function fail(code: string, status: number) {
  return new AppError(code, "errors.coaching.invalid", status);
}
