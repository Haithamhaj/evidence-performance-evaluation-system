import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient, seedPilotEvaluationTemplateVersionOne } from "@evaluation/database";
import { approvedEnglishRubric } from "@evaluation/localization";
import { afterAll, describe, expect, it } from "vitest";

import { EvaluationTemplateService } from "./template-service.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const now = new Date("2026-08-06T08:00:00Z");

afterAll(async () => client.$disconnect());

async function fixture(
  options: Readonly<{
    invalidSectionWeight?: boolean;
    localeAvailability?: ReadonlyArray<string>;
  }> = {},
) {
  const suffix = crypto.randomUUID();
  const organization = await client.organization.create({
    data: { key: `evaluation-template-${suffix}`, name: "Evaluation Template Organization" },
  });
  const department = await client.department.create({
    data: {
      key: `evaluation-template-department-${suffix}`,
      name: "Evaluation Template Department",
      organizationId: organization.id,
    },
  });
  const actor = await client.user.create({
    data: { email: `evaluation-template-actor-${suffix}@example.invalid`, displayName: "Actor" },
  });
  const rubricVersion = await client.rubricVersion.create({
    data: { organizationId: organization.id, version: approvedEnglishRubric.version },
  });
  const template = await client.evaluationTemplate.create({
    data: {
      organizationId: organization.id,
      departmentId: department.id,
      scope: "DEPARTMENT",
      key: `pilot-v1-${suffix}`,
      name: "Pilot Version 1",
      createdById: actor.id,
    },
  });
  const version = await client.evaluationTemplateVersion.create({
    data: {
      templateId: template.id,
      rubricVersionId: rubricVersion.id,
      versionNumber: 1,
      ratingScale: [1, 2, 3, 4, 5],
      weightPolicy: { sectionTotal: 100, fixedCriterionTotalPerSection: 100 },
      evaluationPolicy: { cadence: "QUARTERLY", cycleOneType: "CALIBRATION_NON_BASELINE" },
      localeAvailability: options.localeAvailability ?? ["en"],
      createdById: actor.id,
    },
  });
  const sections = new Map(approvedEnglishRubric.sections.map((section) => [section.id, section]));
  const sourceCriteria = [
    ...approvedEnglishRubric.employeeCriteria,
    approvedEnglishRubric.projectContribution,
  ];
  const criteria = sourceCriteria.map((criterion) => ({
    id: criterion.id,
    title: criterion.title,
    sectionId: criterion.sectionId,
    ...(criterion.internalWeight === undefined ? {} : { internalWeight: criterion.internalWeight }),
    anchors: criterion.anchors,
  }));
  for (const [displayOrder, criterion] of sourceCriteria.entries()) {
    const section = sections.get(criterion.sectionId)!;
    const item = await client.evaluationTemplateItem.create({
      data: {
        versionId: version.id,
        stableCriterionId: criterion.id,
        kind: criterion.id === "PROJECT-CONTRIBUTION" ? "PROJECT_CONTRIBUTION" : "FIXED_CRITERION",
        sectionStableId: section.id,
        sectionWeight:
          options.invalidSectionWeight === true && section.id === "PROJECT-CONTRIBUTION"
            ? 24
            : section.weight,
        criterionWeight: criterion.internalWeight ?? null,
        displayOrder,
        protectedGlobal: ["PPB-01", "PPB-02", "PPB-03"].includes(criterion.id),
        allowedWeightMinimum:
          criterion.id === "PPB-01"
            ? 4
            : criterion.id === "PPB-02"
              ? 3
              : criterion.id === "PPB-03"
                ? 2
                : null,
        allowedWeightMaximum:
          criterion.id === "PPB-01"
            ? 8
            : criterion.id === "PPB-02"
              ? 7
              : criterion.id === "PPB-03"
                ? 6
                : null,
      },
    });
    await client.evaluationTemplateItemLocale.create({
      data: {
        itemId: item.id,
        locale: "en",
        title: criterion.title,
        definition: criterion.definition ?? criterion.purpose ?? criterion.title,
        anchors: criterion.anchors,
        examples: criterion.examples,
        evidenceGuidance:
          criterion.evidenceGuidance === undefined ? [] : [criterion.evidenceGuidance],
      },
    });
  }

  const rubricReader: import("./ports.js").EvaluationRubricReader = {
    readEvaluationRubric: async (_transaction, rubricVersionId) =>
      rubricVersionId === rubricVersion.id
        ? {
            id: rubricVersion.id,
            organizationId: organization.id,
            version: approvedEnglishRubric.version,
            status: "active",
            protectedGlobalCriterionIds: ["PPB-01", "PPB-02", "PPB-03"],
            locales: [
              {
                locale: "en",
                status: "active",
                sourceHash: approvedEnglishRubric.sourceHash,
                sections: approvedEnglishRubric.sections,
                criteria,
              },
            ],
          }
        : null,
  };
  const organizationReader: import("./ports.js").EvaluationOrganizationReader = {
    departmentBelongsToOrganization: async (_transaction, input) =>
      input.organizationId === organization.id && input.departmentId === department.id,
  };
  const service = new EvaluationTemplateService(
    client,
    rubricReader,
    organizationReader,
    databaseAuditWriter,
    () => now,
  );
  const input = {
    schemaVersion: 1 as const,
    versionId: version.id,
    actorId: actor.id,
    expectedVersion: 1,
    idempotencyKey: crypto.randomUUID(),
    reason: "Approve the exact English pilot rubric for a future cycle.",
  };
  return { actor, department, input, organization, rubricVersion, service, template, version };
}

describe("EvaluationTemplateService", () => {
  it("rejects section weights that do not total 100 without an audit or partial activation", async () => {
    const { input, service, version } = await fixture({ invalidSectionWeight: true });

    await expect(service.activateVersion(input)).rejects.toMatchObject({
      code: "EVALUATION_TEMPLATE_WEIGHT_INVALID",
    });
    await expect(
      client.evaluationTemplateVersion.findUniqueOrThrow({ where: { id: version.id } }),
    ).resolves.toMatchObject({
      status: "DRAFT",
      version: 1,
    });
    await expect(client.auditEvent.count({ where: { targetId: version.id } })).resolves.toBe(0);
  });

  it("activates the exact English Version 1 rubric and leaves the active version immutable", async () => {
    const { actor, input, service, version } = await fixture();

    await expect(service.activateVersion(input)).resolves.toMatchObject({
      id: version.id,
      status: "ACTIVE",
      version: 2,
      localeAvailability: ["en"],
    });
    await expect(
      client.auditEvent.findFirstOrThrow({
        where: { eventType: "evaluation.template.version_activated", targetId: version.id },
      }),
    ).resolves.toMatchObject({ actorId: actor.id });
    await expect(
      client.evaluationTemplateVersion.update({
        where: { id: version.id },
        data: { ratingScale: [1, 2, 3, 4] },
      }),
    ).rejects.toBeDefined();
  });

  it("returns the original activation for an exact retry and rejects stale activation", async () => {
    const { input, service } = await fixture();
    const activated = await service.activateVersion(input);

    await expect(service.activateVersion(input)).resolves.toEqual(activated);
    await expect(
      service.activateVersion({ ...input, idempotencyKey: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });

  it("rejects a locale that is not active in the approved rubric", async () => {
    const { input, service } = await fixture({ localeAvailability: ["en", "ar"] });

    await expect(service.activateVersion(input)).rejects.toMatchObject({
      code: "EVALUATION_TEMPLATE_LOCALE_INVALID",
    });
  });

  it("seeds one draft Version 1 from the approved English rubric source without rewriting wording", async () => {
    const { actor, department, organization, rubricVersion } = await fixture();
    const seed = () =>
      client.$transaction((transaction) =>
        seedPilotEvaluationTemplateVersionOne(transaction, {
          organizationId: organization.id,
          departmentId: department.id,
          rubricVersionId: rubricVersion.id,
          createdById: actor.id,
          rubric: approvedEnglishRubric,
        }),
      );

    const first = await seed();
    await expect(seed()).resolves.toEqual(first);
    const seeded = await client.evaluationTemplate.findUniqueOrThrow({
      where: {
        organizationId_departmentId_key: {
          organizationId: organization.id,
          departmentId: department.id,
          key: "pilot-employee-evaluation",
        },
      },
      include: {
        versions: { include: { items: { include: { locales: true } } } },
      },
    });
    expect(seeded.versions).toHaveLength(1);
    expect(seeded.versions[0]).toMatchObject({ status: "DRAFT", versionNumber: 1 });
    expect(seeded.versions[0]!.items).toHaveLength(13);
    expect(
      seeded.versions[0]!.items.find(({ stableCriterionId }) => stableCriterionId === "PPB-01")
        ?.locales[0],
    ).toMatchObject({
      locale: "en",
      title: approvedEnglishRubric.employeeCriteria[0]!.title,
      definition: approvedEnglishRubric.employeeCriteria[0]!.definition,
      anchors: approvedEnglishRubric.employeeCriteria[0]!.anchors,
    });
  });
});
