import { AppError } from "@evaluation/contracts";

import { assertAccessibleConnectedSource } from "./source-authorization.js";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type Transaction = import("@evaluation/database").DatabaseTransaction;
type Actor = Readonly<{ userId: string; active: boolean }>;
type SourceProjectLinkRecord = Readonly<{
  id: string;
  sourceItemId: string;
  employeeId: string;
  projectId: string;
  origin: "EMPLOYEE_MANUAL" | "CONTEXT_SUGGESTION";
  contextSuggestionId: string | null;
  linkedById: string;
  linkedAt: Date;
  unlinkedAt: Date | null;
  unlinkedById: string | null;
  unlinkReason: string | null;
}>;

export interface ProjectLinkAuthorization {
  canLink(employeeId: string, projectId: string, at: Date): Promise<boolean>;
  authorizeCurrentMemberInTransaction(
    transaction: Transaction,
    employeeId: string,
    projectId: string,
    at: Date,
  ): Promise<void>;
}

type ConnectionServiceDependencies = Readonly<{
  database: DatabaseClient;
  credentialVault: import("./credential-vault.js").CredentialVault;
  auditWriter: import("@evaluation/contracts").AuditWriter<Transaction>;
  projectAuthorization: ProjectLinkAuthorization;
  clock?: () => Date;
}>;

export class ConnectedWorkConnectionService {
  private readonly database: DatabaseClient;
  private readonly credentialVault: import("./credential-vault.js").CredentialVault;
  private readonly auditWriter: import("@evaluation/contracts").AuditWriter<Transaction>;
  private readonly projectAuthorization: ProjectLinkAuthorization;
  private readonly clock: () => Date;

  constructor(dependencies: ConnectionServiceDependencies) {
    this.database = dependencies.database;
    this.credentialVault = dependencies.credentialVault;
    this.auditWriter = dependencies.auditWriter;
    this.projectAuthorization = dependencies.projectAuthorization;
    this.clock = dependencies.clock ?? (() => new Date());
  }

  async connect(
    command: Readonly<{
      actor: Actor;
      correlationId: string;
      credential: import("./credential-vault.js").OAuthCredential;
    }>,
  ) {
    assertActive(command.actor);
    const current = validClock(this.clock());
    const existing = await this.database.connectedWorkAccount.findUnique({
      where: { employeeId: command.actor.userId },
    });
    if (
      existing !== null &&
      existing.disconnectedAt === null &&
      existing.contentInaccessibleAt === null
    ) {
      return serializeConnection(existing);
    }

    const { credentialRef } = await this.credentialVault.put({
      credential: command.credential,
    });
    try {
      return await this.database.$transaction(async (transaction) => {
        const account =
          existing === null
            ? await transaction.connectedWorkAccount.create({
                data: {
                  employeeId: command.actor.userId,
                  credentialRef,
                  connectedAt: current,
                },
              })
            : await transaction.connectedWorkAccount.update({
                where: { id: existing.id },
                data: {
                  credentialRef,
                  connectedAt: current,
                  disconnectedAt: null,
                  contentInaccessibleAt: null,
                  deletionDueAt: null,
                },
              });
        await this.appendAudit(transaction, {
          eventType: "connected_work_context.connected",
          actor: command.actor,
          correlationId: command.correlationId,
          targetType: "connected_work_account",
          targetId: account.id,
          safeDiff: { connected: true },
          reason: "Employee connected a private work-context account",
        });
        return serializeConnection(account);
      });
    } catch (error) {
      await this.credentialVault.revoke(credentialRef);
      throw error;
    }
  }

  async disconnect(command: Readonly<{ actor: Actor; correlationId: string }>) {
    assertActive(command.actor);
    const account = await this.loadOwnedAccount(command.actor.userId, false);
    if (account.disconnectedAt !== null || account.contentInaccessibleAt !== null) {
      return serializeConnection(account);
    }
    const current = validClock(this.clock());

    await this.credentialVault.revoke(account.credentialRef);
    return this.database.$transaction(async (transaction) => {
      const disconnected = await transaction.connectedWorkAccount.update({
        where: { id: account.id },
        data: {
          disconnectedAt: current,
          contentInaccessibleAt: current,
          deletionDueAt: null,
        },
      });
      await this.appendAudit(transaction, {
        eventType: "connected_work_context.disconnected",
        actor: command.actor,
        correlationId: command.correlationId,
        targetType: "connected_work_account",
        targetId: account.id,
        safeDiff: { connected: false, contentAccessible: false },
        reason: "Employee disconnected a private work-context account",
      });
      await this.appendAudit(transaction, {
        eventType: "connected_work_context.credential_revoked",
        actor: command.actor,
        correlationId: command.correlationId,
        targetType: "connected_work_account",
        targetId: account.id,
        safeDiff: { credentialRevoked: true },
        reason: "Private work-context credential was revoked",
      });
      return serializeConnection(disconnected);
    });
  }

  async setSourceExclusion(
    command: Readonly<{
      actor: Actor;
      correlationId: string;
      provider: import("@evaluation/contracts").ConnectedSourceProvider;
      kind: import("./source-adapter.js").ConnectedSourceExclusionKind;
      providerExclusionId: string;
      excluded: boolean;
    }>,
  ): Promise<Readonly<{ excluded: boolean }>> {
    assertActive(command.actor);
    if (command.providerExclusionId.trim().length === 0) {
      throw invalidInputError();
    }
    const account = await this.loadOwnedAccount(command.actor.userId, true);
    const current = validClock(this.clock());

    return this.database.$transaction(async (transaction) => {
      const active = await transaction.connectedSourceExclusion.findFirst({
        where: {
          connectedWorkAccountId: account.id,
          provider: command.provider,
          kind: command.kind,
          providerExclusionId: command.providerExclusionId,
          revokedAt: null,
        },
      });
      if (command.excluded === (active !== null)) {
        return { excluded: command.excluded };
      }
      const targetId = command.excluded
        ? (
            await transaction.connectedSourceExclusion.create({
              data: {
                connectedWorkAccountId: account.id,
                employeeId: command.actor.userId,
                provider: command.provider,
                kind: command.kind,
                providerExclusionId: command.providerExclusionId,
              },
            })
          ).id
        : (
            await transaction.connectedSourceExclusion.update({
              where: { id: active!.id },
              data: { revokedAt: current },
            })
          ).id;
      await this.appendAudit(transaction, {
        eventType: "connected_work_context.source_exclusion_changed",
        actor: command.actor,
        correlationId: command.correlationId,
        targetType: "connected_source_exclusion",
        targetId,
        safeDiff: {
          provider: command.provider,
          kind: command.kind,
          excluded: command.excluded,
        },
        reason: "Employee changed a private source exclusion",
      });
      return { excluded: command.excluded };
    });
  }

  async setItemExclusion(
    command: Readonly<{
      actor: Actor;
      correlationId: string;
      sourceItemId: string;
      excluded: boolean;
    }>,
  ): Promise<Readonly<{ excluded: boolean }>> {
    assertActive(command.actor);
    const account = await this.loadOwnedAccount(command.actor.userId, true);
    return this.database.$transaction(async (transaction) => {
      const item = await loadOwnedSourceItem(
        transaction,
        account.id,
        command.actor.userId,
        command.sourceItemId,
      );
      if (item.excluded === command.excluded) return { excluded: item.excluded };
      const updated = await transaction.connectedSourceItem.update({
        where: { id: item.id },
        data: { excluded: command.excluded },
      });
      await this.appendAudit(transaction, {
        eventType: "connected_work_context.item_exclusion_changed",
        actor: command.actor,
        correlationId: command.correlationId,
        targetType: "connected_source_item",
        targetId: item.id,
        safeDiff: { excluded: updated.excluded },
        reason: "Employee changed a private context-item exclusion",
      });
      return { excluded: updated.excluded };
    });
  }

  async linkProject(
    command: Readonly<{
      actor: Actor;
      correlationId: string;
      sourceItemId: string;
      projectId: string;
      reason: string;
    }>,
  ): Promise<SourceProjectLinkRecord> {
    assertActive(command.actor);
    const account = await this.loadOwnedAccount(command.actor.userId, true);
    const current = validClock(this.clock());
    if (
      !(await this.projectAuthorization.canLink(command.actor.userId, command.projectId, current))
    ) {
      throw forbiddenError();
    }

    return this.database.$transaction(async (transaction) => {
      const item = await loadOwnedSourceItem(
        transaction,
        account.id,
        command.actor.userId,
        command.sourceItemId,
      );
      const activeLink = await transaction.sourceProjectLink.findFirst({
        where: { sourceItemId: item.id, unlinkedAt: null },
      });
      if (activeLink !== null) {
        if (activeLink.projectId === command.projectId) return activeLink;
        throw new AppError(
          "CONNECTED_CONTEXT_LINK_CONFLICT",
          "errors.connectedContext.linkConflict",
          409,
        );
      }
      const link = await transaction.sourceProjectLink.create({
        data: {
          sourceItemId: item.id,
          employeeId: command.actor.userId,
          projectId: command.projectId,
          origin: "EMPLOYEE_MANUAL",
          linkedById: command.actor.userId,
          linkedAt: current,
        },
      });
      await this.appendAudit(transaction, {
        eventType: "connected_work_context.project_linked",
        actor: command.actor,
        correlationId: command.correlationId,
        targetType: "source_project_link",
        targetId: link.id,
        safeDiff: { linked: true },
        reason: "Employee manually linked private context to a Project",
      });
      return link;
    });
  }

  async confirmSuggestedProject(
    transaction: Transaction,
    command: Readonly<{
      actor: Actor;
      correlationId: string;
      sourceItemId: string;
      projectId: string;
      suggestionId: string;
    }>,
  ): Promise<SourceProjectLinkRecord> {
    assertActive(command.actor);
    const current = validClock(this.clock());
    await assertAccessibleConnectedSource(transaction, command);
    await this.authorizeDerivedProjectLink(
      transaction,
      command.actor.userId,
      command.projectId,
      current,
    );
    const activeLink = await transaction.sourceProjectLink.findFirst({
      where: { sourceItemId: command.sourceItemId, unlinkedAt: null },
    });
    if (activeLink?.origin === "EMPLOYEE_MANUAL") {
      if (activeLink.projectId === command.projectId) return activeLink;
      throw linkConflictError();
    }
    await assertValidContextSuggestion(transaction, {
      employeeId: command.actor.userId,
      sourceItemId: command.sourceItemId,
      projectId: command.projectId,
      suggestionId: command.suggestionId,
    });
    if (activeLink !== null) {
      if (
        activeLink.projectId === command.projectId &&
        activeLink.contextSuggestionId === command.suggestionId
      ) {
        return activeLink;
      }
      throw linkConflictError();
    }
    const link = await transaction.sourceProjectLink.create({
      data: {
        sourceItemId: command.sourceItemId,
        employeeId: command.actor.userId,
        projectId: command.projectId,
        origin: "CONTEXT_SUGGESTION",
        contextSuggestionId: command.suggestionId,
        linkedById: command.actor.userId,
        linkedAt: current,
      },
    });
    await this.appendAudit(transaction, {
      eventType: "connected_work_context.context_suggestion_linked",
      actor: command.actor,
      correlationId: command.correlationId,
      targetType: "source_project_link",
      targetId: link.id,
      safeDiff: { linked: true, origin: "CONTEXT_SUGGESTION" },
      reason: "Employee confirmed a Context Intelligence Project suggestion",
    });
    return link;
  }

  async replaceSuggestedProject(
    transaction: Transaction,
    command: Readonly<{
      actor: Actor;
      correlationId: string;
      sourceItemId: string;
      expectedSuggestionId: string;
      replacementSuggestionId: string;
      projectId: string;
    }>,
  ): Promise<SourceProjectLinkRecord> {
    assertActive(command.actor);
    const current = validClock(this.clock());
    await assertAccessibleConnectedSource(transaction, command);
    await this.authorizeDerivedProjectLink(
      transaction,
      command.actor.userId,
      command.projectId,
      current,
    );
    const activeLink = await transaction.sourceProjectLink.findFirst({
      where: { sourceItemId: command.sourceItemId, unlinkedAt: null },
    });
    if (activeLink?.origin === "EMPLOYEE_MANUAL") return activeLink;
    await assertValidContextSuggestion(transaction, {
      employeeId: command.actor.userId,
      sourceItemId: command.sourceItemId,
      projectId: command.projectId,
      suggestionId: command.replacementSuggestionId,
    });
    if (activeLink !== null && activeLink.contextSuggestionId !== command.expectedSuggestionId) {
      throw linkConflictError();
    }
    if (activeLink !== null) {
      const closed = await transaction.sourceProjectLink.update({
        where: { id: activeLink.id },
        data: {
          unlinkedAt: current,
          unlinkedById: command.actor.userId,
          unlinkReason: "Context Intelligence Project suggestion corrected",
        },
      });
      await this.appendAudit(transaction, {
        eventType: "connected_work_context.context_suggestion_replaced",
        actor: command.actor,
        correlationId: command.correlationId,
        targetType: "source_project_link",
        targetId: closed.id,
        safeDiff: { linked: false, origin: "CONTEXT_SUGGESTION" },
        reason: "Employee corrected a Context Intelligence Project suggestion",
      });
    }
    const replacement = await transaction.sourceProjectLink.create({
      data: {
        sourceItemId: command.sourceItemId,
        employeeId: command.actor.userId,
        projectId: command.projectId,
        origin: "CONTEXT_SUGGESTION",
        contextSuggestionId: command.replacementSuggestionId,
        linkedById: command.actor.userId,
        linkedAt: current,
      },
    });
    await this.appendAudit(transaction, {
      eventType: "connected_work_context.context_suggestion_linked",
      actor: command.actor,
      correlationId: command.correlationId,
      targetType: "source_project_link",
      targetId: replacement.id,
      safeDiff: { linked: true, origin: "CONTEXT_SUGGESTION" },
      reason: "Employee confirmed a corrected Context Intelligence Project suggestion",
    });
    return replacement;
  }

  async removeSuggestedProject(
    transaction: Transaction,
    command: Readonly<{
      actor: Actor;
      correlationId: string;
      sourceItemId: string;
      expectedSuggestionId: string;
    }>,
  ): Promise<SourceProjectLinkRecord | null> {
    assertActive(command.actor);
    const current = validClock(this.clock());
    await assertAccessibleConnectedSource(transaction, command);
    const activeLink = await transaction.sourceProjectLink.findFirst({
      where: { sourceItemId: command.sourceItemId, unlinkedAt: null },
    });
    if (activeLink === null || activeLink.origin === "EMPLOYEE_MANUAL") return activeLink;
    if (activeLink.contextSuggestionId !== command.expectedSuggestionId) {
      throw linkConflictError();
    }
    const closed = await transaction.sourceProjectLink.update({
      where: { id: activeLink.id },
      data: {
        unlinkedAt: current,
        unlinkedById: command.actor.userId,
        unlinkReason: "Context Intelligence Project suggestion rejected",
      },
    });
    await this.appendAudit(transaction, {
      eventType: "connected_work_context.context_suggestion_removed",
      actor: command.actor,
      correlationId: command.correlationId,
      targetType: "source_project_link",
      targetId: closed.id,
      safeDiff: { linked: false, origin: "CONTEXT_SUGGESTION" },
      reason: "Employee rejected a Context Intelligence Project suggestion",
    });
    return closed;
  }

  async unlinkProject(
    command: Readonly<{
      actor: Actor;
      correlationId: string;
      sourceItemId: string;
      reason: string;
    }>,
  ): Promise<SourceProjectLinkRecord | null> {
    assertActive(command.actor);
    if (command.reason.trim().length === 0) throw invalidInputError();
    const account = await this.loadOwnedAccount(command.actor.userId, true);
    const current = validClock(this.clock());

    return this.database.$transaction(async (transaction) => {
      const item = await loadOwnedSourceItem(
        transaction,
        account.id,
        command.actor.userId,
        command.sourceItemId,
      );
      const activeLink = await transaction.sourceProjectLink.findFirst({
        where: { sourceItemId: item.id, unlinkedAt: null },
      });
      if (activeLink === null) return null;
      const link = await transaction.sourceProjectLink.update({
        where: { id: activeLink.id },
        data: {
          unlinkedAt: current,
          unlinkedById: command.actor.userId,
          unlinkReason: command.reason,
        },
      });
      await this.appendAudit(transaction, {
        eventType: "connected_work_context.project_unlinked",
        actor: command.actor,
        correlationId: command.correlationId,
        targetType: "source_project_link",
        targetId: link.id,
        safeDiff: { linked: false },
        reason: "Employee removed a private context Project link",
      });
      return link;
    });
  }

  private async loadOwnedAccount(employeeId: string, requireActive: boolean) {
    const account = await this.database.connectedWorkAccount.findUnique({
      where: { employeeId },
    });
    if (
      account === null ||
      (requireActive && (account.disconnectedAt !== null || account.contentInaccessibleAt !== null))
    ) {
      throw forbiddenError();
    }
    return account;
  }

  private async authorizeDerivedProjectLink(
    transaction: Transaction,
    employeeId: string,
    projectId: string,
    at: Date,
  ): Promise<void> {
    try {
      await this.projectAuthorization.authorizeCurrentMemberInTransaction(
        transaction,
        employeeId,
        projectId,
        at,
      );
    } catch (error) {
      if (error instanceof AppError && error.status === 403) throw forbiddenError();
      throw error;
    }
  }

  private appendAudit(
    transaction: Transaction,
    input: Readonly<{
      eventType: string;
      actor: Actor;
      correlationId: string;
      targetType: string;
      targetId: string;
      safeDiff: Readonly<Record<string, unknown>>;
      reason: string;
    }>,
  ) {
    return this.auditWriter.append(transaction, {
      eventType: input.eventType,
      actor: { kind: "human", id: input.actor.userId },
      effectiveSubjectId: input.actor.userId,
      scopeType: "system",
      scopeId: input.actor.userId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      safeDiff: input.safeDiff,
      correlationId: input.correlationId,
      source: "api",
    });
  }
}

async function assertValidContextSuggestion(
  transaction: Transaction,
  input: Readonly<{
    employeeId: string;
    sourceItemId: string;
    projectId: string;
    suggestionId: string;
  }>,
): Promise<void> {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT suggestion.id
    FROM "ProjectLinkSuggestion" suggestion
    WHERE suggestion.id = ${input.suggestionId}::uuid
      AND suggestion."sourceItemId" = ${input.sourceItemId}::uuid
      AND suggestion."employeeId" = ${input.employeeId}::uuid
      AND suggestion."projectId" = ${input.projectId}::uuid
      AND suggestion."reviewStatus" IN ('CONFIRMED', 'CORRECTED')
      AND suggestion."revisionOrigin" = 'EMPLOYEE'
      AND NOT EXISTS (
        SELECT 1
        FROM "ProjectLinkSuggestion" superseding
        WHERE superseding."supersedesSuggestionId" = suggestion.id
      )
    FOR SHARE OF suggestion
  `;
  if (rows[0] === undefined) {
    throw new AppError(
      "CONNECTED_CONTEXT_INVALID_SUGGESTION",
      "errors.connectedContext.invalidSuggestion",
      409,
    );
  }
}

async function loadOwnedSourceItem(
  transaction: Transaction,
  accountId: string,
  employeeId: string,
  sourceItemId: string,
) {
  const item = await transaction.connectedSourceItem.findUnique({
    where: { id: sourceItemId },
  });
  if (
    item === null ||
    item.employeeId !== employeeId ||
    item.connectedWorkAccountId !== accountId ||
    item.deletedAt !== null
  ) {
    throw forbiddenError();
  }
  return item;
}

function serializeConnection(account: {
  id: string;
  employeeId: string;
  connectedAt: Date;
  disconnectedAt: Date | null;
  contentInaccessibleAt: Date | null;
}) {
  return {
    id: account.id,
    employeeId: account.employeeId,
    connectedAt: account.connectedAt.toISOString(),
    disconnectedAt: account.disconnectedAt?.toISOString() ?? null,
    contentInaccessibleAt: account.contentInaccessibleAt?.toISOString() ?? null,
  };
}

function validClock(value: Date): Date {
  if (Number.isNaN(value.getTime())) throw new Error("Clock must return a valid Date");
  return value;
}

function assertActive(actor: Actor): void {
  if (!actor.active) throw forbiddenError();
}

function forbiddenError(): AppError {
  return new AppError("CONNECTED_CONTEXT_FORBIDDEN", "errors.connectedContext.forbidden", 403);
}

function invalidInputError(): AppError {
  return new AppError(
    "CONNECTED_CONTEXT_INPUT_INVALID",
    "errors.connectedContext.inputInvalid",
    400,
  );
}

function linkConflictError(): AppError {
  return new AppError(
    "CONNECTED_CONTEXT_LINK_CONFLICT",
    "errors.connectedContext.linkConflict",
    409,
  );
}
