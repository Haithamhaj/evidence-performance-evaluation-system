import path from "node:path";
import { fileURLToPath } from "node:url";

import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient, seedPilot } from "@evaluation/database";
import { approvedEnglishRubric } from "@evaluation/localization";

type SeedTransaction = Parameters<typeof seedPilot>[0];
type SeedClient = Pick<ReturnType<typeof createDatabaseClient>, "$transaction">;
type AuditWriter<T> = import("@evaluation/contracts").AuditWriter<T>;
type RubricContent = import("@evaluation/localization").RubricContent;

async function createRubricDraft(
  transaction: SeedTransaction,
  organizationId: string,
  rubric: RubricContent,
) {
  const existing = await transaction.rubricVersion.findUnique({
    where: { organizationId_version: { organizationId, version: rubric.version } },
    include: { locales: true },
  });
  if (existing !== null) {
    const locale = existing.locales.find((candidate) => candidate.locale === rubric.locale);
    if (
      existing.status === "active" &&
      locale?.status === "active" &&
      locale.sourceHash === rubric.sourceHash
    ) {
      return null;
    }
    throw new Error("Existing rubric Version 1 conflicts with the approved English source");
  }

  const version = await transaction.rubricVersion.create({
    data: { organizationId, version: rubric.version },
  });
  const locale = await transaction.rubricLocale.create({
    data: {
      rubricVersionId: version.id,
      locale: rubric.locale,
      sourceHash: rubric.sourceHash,
      biasGuidance: rubric.biasGuidance,
    },
  });
  const sectionIds = new Map<string, string>();
  for (const [displayOrder, section] of rubric.sections.entries()) {
    const created = await transaction.rubricSection.create({
      data: {
        rubricLocaleId: locale.id,
        stableId: section.id,
        title: section.title,
        weight: section.weight,
        displayOrder,
      },
    });
    sectionIds.set(section.id, created.id);
  }

  const createCriterion = async (
    criterion: RubricContent["employeeCriteria"][number] | RubricContent["projectContribution"],
    kind: "employee" | "project_contribution",
    displayOrder: number,
  ) => {
    const sectionId = sectionIds.get(criterion.sectionId);
    if (sectionId === undefined)
      throw new Error(`Rubric section ${criterion.sectionId} is missing`);
    await transaction.rubricCriterion.create({
      data: {
        rubricLocaleId: locale.id,
        sectionId,
        stableId: criterion.id,
        kind,
        title: criterion.title,
        ...(criterion.assessmentBasis === undefined
          ? {}
          : { assessmentBasis: criterion.assessmentBasis }),
        ...(criterion.internalWeight === undefined
          ? {}
          : { internalWeight: criterion.internalWeight }),
        content: criterion,
        displayOrder,
        anchors: {
          create: criterion.anchors.map((anchor) => ({ rating: anchor.rating, text: anchor.text })),
        },
      },
    });
  };

  for (const [displayOrder, criterion] of rubric.employeeCriteria.entries()) {
    await createCriterion(criterion, "employee", displayOrder);
  }
  await createCriterion(rubric.projectContribution, "project_contribution", 12);
  for (const [index, criterion] of rubric.managerCriteria.entries()) {
    await transaction.rubricCriterion.create({
      data: {
        rubricLocaleId: locale.id,
        stableId: criterion.id,
        kind: "manager",
        title: criterion.title,
        content: criterion,
        displayOrder: 13 + index,
        anchors: {
          create: criterion.anchors.map((anchor) => ({ rating: anchor.rating, text: anchor.text })),
        },
      },
    });
  }
  return { rubricVersionId: version.id, rubricLocaleId: locale.id };
}

async function activateRubricInTransaction(
  transaction: SeedTransaction,
  organizationId: string,
  rubric: RubricContent,
  writer: AuditWriter<SeedTransaction>,
) {
  const draft = await createRubricDraft(transaction, organizationId, rubric);
  if (draft === null) return null;
  const audit = await writer.append(transaction, {
    eventType: "rubric.version.activated",
    actor: { kind: "service", id: "bootstrap" },
    effectiveSubjectId: organizationId,
    scopeType: "organization",
    scopeId: organizationId,
    targetType: "rubric_version",
    targetId: draft.rubricVersionId,
    correlationId: crypto.randomUUID(),
    source: "seed",
    safeDiff: { locale: rubric.locale, sourceHash: rubric.sourceHash, version: rubric.version },
  });
  const activatedAt = new Date();
  await transaction.rubricLocale.update({
    where: { id: draft.rubricLocaleId },
    data: { status: "active", activatedAt },
  });
  await transaction.rubricVersion.update({
    where: { id: draft.rubricVersionId },
    data: { status: "active", activatedAt },
  });
  return { rubricVersionId: draft.rubricVersionId, auditEventId: audit.id };
}

export async function activateRubricWithAudit(
  client: SeedClient,
  organizationId: string,
  rubric: RubricContent,
  writer: AuditWriter<SeedTransaction> = databaseAuditWriter,
) {
  return client.$transaction((transaction) =>
    activateRubricInTransaction(transaction, organizationId, rubric, writer),
  );
}

export async function seedPilotWithAudit(
  client: SeedClient,
  subjects: import("@evaluation/database").PilotSubjects,
  writer: AuditWriter<SeedTransaction> = databaseAuditWriter,
) {
  return client.$transaction(async (transaction) => {
    const roleChanges = await seedPilot(transaction, subjects);
    const correlationId = crypto.randomUUID();
    const auditEvents = [];
    for (const change of roleChanges) {
      auditEvents.push(
        await writer.append(transaction, {
          eventType: "role.assignment.changed",
          actor: { kind: "service", id: "bootstrap" },
          effectiveSubjectId: change.userId,
          scopeType: change.scopeType,
          scopeId: change.scopeId,
          targetType: "role_assignment",
          targetId: change.assignmentId,
          correlationId,
          source: "seed",
          safeDiff: { change: change.change, role: change.role, scopeType: change.scopeType },
        }),
      );
    }
    const organization = await transaction.organization.findUniqueOrThrow({
      where: { key: "leapai" },
      select: { id: true },
    });
    const rubricActivation = await activateRubricInTransaction(
      transaction,
      organization.id,
      approvedEnglishRubric,
      writer,
    );
    return {
      roleChanges,
      auditEventIds: auditEvents.map(({ id }) => id),
      rubricActivation,
    };
  });
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`);
  return value;
}

async function main(): Promise<void> {
  const client = createDatabaseClient(requiredEnvironment("DATABASE_URL"));
  try {
    await seedPilotWithAudit(client, {
      managerSubject: requiredEnvironment("PILOT_MANAGER_OIDC_SUBJECT"),
      adminSubject: requiredEnvironment("PILOT_ADMIN_OIDC_SUBJECT"),
      oidcIssuer: requiredEnvironment("OIDC_ISSUER"),
    });
  } finally {
    await client.$disconnect();
  }
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  await main();
}
