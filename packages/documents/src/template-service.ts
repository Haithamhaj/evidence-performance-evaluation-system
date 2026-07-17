import { databaseAuditWriter } from "@evaluation/audit";
import {
  ActivateDocumentTemplateVersionSchema,
  AppError,
  CreateDocumentTemplateVersionSchema,
  DocumentTemplateVersionSchema,
} from "@evaluation/contracts";
import { decide } from "@evaluation/permissions";
import { z } from "zod";

import { assertActivatableTemplate } from "./template-invariants.js";

type DatabaseClient = import("./model.js").DocumentDatabase;
type Transaction = import("./model.js").DocumentTransaction;
type AuditWriter = import("./model.js").DocumentAuditWriter;
type Clock = import("./model.js").DocumentClock;

const ActorSchema = z.object({ userId: z.string().uuid(), active: z.boolean() }).strict();
const CreateCommandSchema = z
  .object({
    actor: ActorSchema,
    correlationId: z.string().uuid(),
    input: CreateDocumentTemplateVersionSchema,
  })
  .strict();
const ActivateCommandSchema = z
  .object({
    actor: ActorSchema,
    correlationId: z.string().uuid(),
    templateId: z.string().uuid(),
    versionId: z.string().uuid(),
    input: ActivateDocumentTemplateVersionSchema,
  })
  .strict();

export class TemplateService {
  private readonly database: DatabaseClient;
  private readonly audit: AuditWriter;
  private readonly clock: Clock;

  constructor(
    database: DatabaseClient,
    audit: AuditWriter = databaseAuditWriter as AuditWriter,
    clock: Clock = () => new Date(),
  ) {
    this.database = database;
    this.audit = audit;
    this.clock = clock;
  }

  async createVersion(command: unknown): Promise<import("@evaluation/contracts").DocumentTemplateVersion> {
    const parsed = CreateCommandSchema.parse(command);
    validNow(this.clock());
    return serializable(this.database, async (transaction) => {
      await authorizeTemplateMutation(transaction, parsed.actor, parsed.input);
      if (parsed.input.templateId === undefined) {
        const created = await transaction.documentTemplate.create({
          data: {
            organizationId: parsed.input.organizationId,
            departmentId: parsed.input.departmentId ?? null,
            scopeType: parsed.input.scopeType,
            kind: parsed.input.kind,
            lockVersion: 1,
            createdById: parsed.actor.userId,
            versions: {
              create: {
                version: 1,
                status: "draft",
                reason: parsed.input.reason,
                createdById: parsed.actor.userId,
                sections: { create: parsed.input.sections },
              },
            },
          },
          include: { versions: { include: { sections: true } } },
        });
        const version = created.versions[0]!;
        await appendAudit(transaction, this.audit, {
          actorId: parsed.actor.userId,
          correlationId: parsed.correlationId,
          eventType: "document_template.version_created",
          scopeType: parsed.input.scopeType,
          scopeId: parsed.input.departmentId ?? parsed.input.organizationId,
          targetId: version.id,
          reason: parsed.input.reason,
          safeDiff: { kind: parsed.input.kind, version: 1, aggregateVersion: 1 },
        });
        return parseVersion(created.kind, created.lockVersion, version);
      }

      const template = await transaction.documentTemplate.findUnique({
        where: { id: parsed.input.templateId },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      });
      if (template === null || !sameTemplateScope(template, parsed.input)) throw notFound();
      if (template.lockVersion !== parsed.input.expectedVersion) throw versionConflict();
      const advanced = await transaction.documentTemplate.updateMany({
        where: { id: template.id, lockVersion: parsed.input.expectedVersion },
        data: { lockVersion: { increment: 1 } },
      });
      if (advanced.count !== 1) throw versionConflict();
      const nextVersion = (template.versions[0]?.version ?? 0) + 1;
      const version = await transaction.documentTemplateVersion.create({
        data: {
          templateId: template.id,
          version: nextVersion,
          status: "draft",
          reason: parsed.input.reason,
          createdById: parsed.actor.userId,
          sections: { create: parsed.input.sections },
        },
        include: { sections: true },
      });
      await appendAudit(transaction, this.audit, {
        actorId: parsed.actor.userId,
        correlationId: parsed.correlationId,
        eventType: "document_template.version_created",
        scopeType: template.scopeType,
        scopeId: template.departmentId ?? template.organizationId,
        targetId: version.id,
        reason: parsed.input.reason,
        safeDiff: {
          kind: template.kind,
          version: nextVersion,
          aggregateVersion: template.lockVersion + 1,
        },
      });
      return parseVersion(template.kind, template.lockVersion + 1, version);
    });
  }

  async activate(command: unknown): Promise<import("@evaluation/contracts").DocumentTemplateVersion> {
    const parsed = ActivateCommandSchema.parse(command);
    const now = validNow(this.clock());
    return serializable(this.database, async (transaction) => {
      const template = await transaction.documentTemplate.findUnique({
        where: { id: parsed.templateId },
        include: {
          versions: {
            where: { id: parsed.versionId },
            include: { sections: true },
          },
        },
      });
      if (template === null) throw notFound();
      await authorizeTemplateMutation(transaction, parsed.actor, template);
      if (template.lockVersion !== parsed.input.expectedVersion) throw versionConflict();
      const version = template.versions[0];
      if (version === undefined || version.status !== "draft") throw invalidState();
      assertActivatableTemplate(template.kind, version.sections.map(toSectionInput));

      await transaction.documentTemplateVersion.updateMany({
        where: { templateId: template.id, status: "active" },
        data: { status: "retired", retiredAt: now },
      });
      const activated = await transaction.documentTemplateVersion.update({
        where: { id: version.id },
        data: { status: "active", activatedAt: now },
        include: { sections: true },
      });
      const advanced = await transaction.documentTemplate.updateMany({
        where: { id: template.id, lockVersion: parsed.input.expectedVersion },
        data: { lockVersion: { increment: 1 } },
      });
      if (advanced.count !== 1) throw versionConflict();
      await appendAudit(transaction, this.audit, {
        actorId: parsed.actor.userId,
        correlationId: parsed.correlationId,
        eventType: "document_template.version_activated",
        scopeType: template.scopeType,
        scopeId: template.departmentId ?? template.organizationId,
        targetId: activated.id,
        reason: parsed.input.reason,
        safeDiff: {
          kind: template.kind,
          version: activated.version,
          aggregateVersion: template.lockVersion + 1,
        },
      });
      return parseVersion(template.kind, template.lockVersion + 1, activated);
    });
  }

  async resolveActive(input: Readonly<{
    organizationId: string;
    departmentId: string;
    kind: "project" | "workstream";
  }>): Promise<ResolvedActiveTemplate | null> {
    const departmentVersion = await this.database.documentTemplateVersion.findFirst({
      where: {
        status: "active",
        template: {
          organizationId: input.organizationId,
          kind: input.kind,
          scopeType: "department",
          departmentId: input.departmentId,
        },
      },
      include: { template: true, sections: { orderBy: { position: "asc" } } },
    });
    const version = departmentVersion ?? await this.database.documentTemplateVersion.findFirst({
      where: {
        status: "active",
        template: {
          organizationId: input.organizationId,
          kind: input.kind,
          scopeType: "organization",
          departmentId: null,
        },
      },
      include: { template: true, sections: { orderBy: { position: "asc" } } },
    });
    if (version === null) return null;
    return {
      id: version.id,
      templateId: version.templateId,
      version: version.version,
      kind: version.template.kind,
      organizationId: version.template.organizationId,
      departmentId: version.template.departmentId,
      sections: version.sections.map(toSectionInput),
    };
  }
}

export type ResolvedActiveTemplate = Readonly<{
  id: string;
  templateId: string;
  version: number;
  kind: "project" | "workstream";
  organizationId: string;
  departmentId: string | null;
  sections: ReadonlyArray<import("@evaluation/contracts").DocumentTemplateSectionInput>;
}>;

async function authorizeTemplateMutation(
  transaction: Transaction,
  actor: Readonly<{ userId: string; active: boolean }>,
  scope: Readonly<{
    organizationId: string;
    departmentId?: string | null | undefined;
    scopeType: "organization" | "department";
  }>,
): Promise<void> {
  const user = await transaction.user.findUnique({ where: { id: actor.userId }, select: { active: true } });
  if (user === null || !user.active || !actor.active) throw authorizationError("INACTIVE");
  const roles = await transaction.roleAssignment.findMany({
    where: { userId: actor.userId },
    select: { role: true, scopeType: true, scopeId: true },
  });
  const resource = scope.scopeType === "organization"
    ? ({ kind: "organizationTemplate", organizationId: scope.organizationId } as const)
    : await departmentTemplateResource(transaction, scope.organizationId, scope.departmentId);
  const decision = decide(
    { subjectId: actor.userId, active: true, roles },
    "document.template.manage",
    resource,
    { now: new Date().toISOString() },
  );
  if (!decision.allowed) throw authorizationError(decision.reasonCode);
}

async function departmentTemplateResource(
  transaction: Transaction,
  organizationId: string,
  departmentId: string | null | undefined,
) {
  if (departmentId === null || departmentId === undefined) throw notFound();
  const department = await transaction.department.findFirst({
    where: { id: departmentId, organizationId },
    select: { authorizationScopes: { where: { scopeType: "department" }, select: { id: true }, take: 1 } },
  });
  const scopeId = department?.authorizationScopes[0]?.id;
  if (scopeId === undefined) throw notFound();
  return { kind: "departmentTemplate", organizationId, departmentId: scopeId } as const;
}

function sameTemplateScope(
  template: Readonly<{ organizationId: string; departmentId: string | null; scopeType: string; kind: string }>,
  input: Readonly<{
    organizationId: string;
    departmentId?: string | undefined;
    scopeType: string;
    kind: string;
  }>,
): boolean {
  return template.organizationId === input.organizationId &&
    template.departmentId === (input.departmentId ?? null) &&
    template.scopeType === input.scopeType && template.kind === input.kind;
}

function toSectionInput(section: Readonly<{
  key: string; position: number; display: unknown; required: boolean; protected: boolean;
}>) {
  return {
    key: section.key,
    position: section.position,
    display: section.display as import("@evaluation/contracts").DocumentTemplateSectionInput["display"],
    required: section.required,
    protected: section.protected,
  };
}

function parseVersion(
  kind: "project" | "workstream",
  aggregateVersion: number,
  version: Readonly<{
    id: string; templateId: string; version: number; status: "draft" | "active" | "retired";
    createdAt: Date; activatedAt: Date | null; retiredAt: Date | null;
    sections: ReadonlyArray<{ key: string; position: number; display: unknown; required: boolean; protected: boolean }>;
  }>,
) {
  return DocumentTemplateVersionSchema.parse({
    id: version.id,
    templateId: version.templateId,
    aggregateVersion,
    version: version.version,
    status: version.status,
    kind,
    sections: version.sections.map(toSectionInput),
    createdAt: version.createdAt.toISOString(),
    activatedAt: version.activatedAt?.toISOString() ?? null,
    retiredAt: version.retiredAt?.toISOString() ?? null,
  });
}

async function appendAudit(
  transaction: Transaction,
  audit: AuditWriter,
  input: Readonly<{
    actorId: string; correlationId: string; eventType: string;
    scopeType: import("@evaluation/contracts").AuditScopeType; scopeId: string;
    targetId: string; reason: string; safeDiff: Record<string, unknown>;
  }>,
) {
  await audit.append(transaction, {
    eventType: input.eventType,
    actor: { kind: "human", id: input.actorId },
    effectiveSubjectId: input.actorId,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    targetType: "document_template_version",
    targetId: input.targetId,
    reason: input.reason,
    safeDiff: input.safeDiff,
    correlationId: input.correlationId,
    source: "api",
  });
}

async function serializable<T>(database: DatabaseClient, operation: (transaction: Transaction) => Promise<T>): Promise<T> {
  try {
    return await database.$transaction(operation, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (hasCode(error, "P2002") || hasCode(error, "P2034")) throw versionConflict();
    throw error;
  }
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
function validNow(now: Date): Date {
  if (!Number.isFinite(now.getTime())) throw new AppError("DOCUMENT_CLOCK_INVALID", "errors.documents.clockInvalid", 500);
  return now;
}
function versionConflict() { return new AppError("VERSION_CONFLICT", "errors.documents.versionConflict", 409); }
function notFound() { return new AppError("RESOURCE_NOT_FOUND", "errors.documents.resourceNotFound", 404); }
function invalidState() { return new AppError("RESOURCE_STATE_INVALID", "errors.documents.resourceStateInvalid", 409); }
function authorizationError(reason: import("@evaluation/permissions").DenialReason) {
  return new AppError(`AUTHZ_${reason}`, "errors.authorization.denied", reason === "UNAUTHENTICATED" ? 401 : 403);
}
