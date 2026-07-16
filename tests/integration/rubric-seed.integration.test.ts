import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { appendAuditEvent } from "../../packages/audit/src/index.js";
import { createDatabaseClient } from "../../packages/database/src/index.js";
import { approvedEnglishRubric } from "../../packages/localization/src/index.js";
import { sha256File } from "../../packages/localization/src/rubric/source-hash.js";
import { activateRubricWithAudit, seedPilotWithAudit } from "../../scripts/seed-pilot.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

type DatabaseClient = ReturnType<typeof createDatabaseClient>;
type DatabaseTransaction = Parameters<Parameters<DatabaseClient["$transaction"]>[0]>[0];
type AuditWriter<T> = import("../../packages/contracts/src/index.js").AuditWriter<T>;

const databaseWriter: AuditWriter<DatabaseTransaction> = { append: appendAuditEvent };
const repositoryRoot = path.resolve(import.meta.dirname, "../..");

describe("approved rubric Version 1", () => {
  it("matches the approved English source exactly", async () => {
    expect(approvedEnglishRubric.employeeCriteria).toHaveLength(12);
    expect(
      approvedEnglishRubric.employeeCriteria.flatMap((criterion) => criterion.anchors),
    ).toHaveLength(60);
    expect(approvedEnglishRubric.projectContribution.anchors).toHaveLength(5);
    expect(approvedEnglishRubric.managerCriteria).toHaveLength(5);
    expect(
      approvedEnglishRubric.managerCriteria.flatMap((criterion) => criterion.anchors),
    ).toHaveLength(25);
    expect(approvedEnglishRubric.sections.reduce((sum, section) => sum + section.weight, 0)).toBe(
      100,
    );
    expect(
      Object.fromEntries(approvedEnglishRubric.sections.map(({ id, weight }) => [id, weight])),
    ).toEqual({ PPB: 20, ARL: 25, EED: 30, "PROJECT-CONTRIBUTION": 25 });
    expect(
      Object.fromEntries(
        approvedEnglishRubric.employeeCriteria.map(({ id, internalWeight }) => [
          id,
          internalWeight,
        ]),
      ),
    ).toEqual({
      "PPB-01": 30,
      "PPB-02": 25,
      "PPB-03": 20,
      "PPB-04": 25,
      "ARL-01": 20,
      "ARL-02": 25,
      "ARL-03": 25,
      "ARL-04": 30,
      "EED-01": 25,
      "EED-02": 30,
      "EED-03": 25,
      "EED-04": 20,
    });
    expect(approvedEnglishRubric.projectContribution.sectionWeight).toBe(25);
    expect(approvedEnglishRubric.sourceHash).toBe(
      await sha256File(path.join(repositoryRoot, "docs/EVALUATION_RUBRIC.md")),
    );

    const committed = JSON.parse(
      await readFile(
        path.join(repositoryRoot, "packages/localization/src/rubric/v1.en.json"),
        "utf8",
      ),
    );
    expect(approvedEnglishRubric).toEqual(committed);

    const comparison = spawnSync(process.execPath, ["scripts/compare-approved-rubric.mjs"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    expect(comparison.status, comparison.stderr).toBe(0);
    expect(comparison.stdout).toContain("zero differences");
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("approved rubric Version 1 persistence", () => {
  let client: DatabaseClient;

  beforeAll(async () => {
    client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
    await seedPilotWithAudit(
      client,
      { managerSubject: "pilot-manager", adminSubject: "system-admin" },
      databaseWriter,
    );
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it("seeds one active immutable rubric and one bootstrap activation audit", async () => {
    const organization = await client.organization.findUniqueOrThrow({ where: { key: "leapai" } });
    const rubric = await client.rubricVersion.findUniqueOrThrow({
      where: { organizationId_version: { organizationId: organization.id, version: "1" } },
      include: {
        locales: {
          include: { sections: true, criteria: { include: { anchors: true } } },
        },
      },
    });
    const activationEvents = await client.auditEvent.findMany({
      where: { eventType: "rubric.version.activated", targetId: rubric.id },
    });

    expect(rubric.status).toBe("active");
    expect(rubric.activatedAt).not.toBeNull();
    expect(rubric.locales).toHaveLength(1);
    expect(rubric.locales[0]?.sourceHash).toBe(approvedEnglishRubric.sourceHash);
    expect(rubric.locales[0]?.sections).toHaveLength(4);
    expect(rubric.locales[0]?.criteria.filter(({ kind }) => kind === "employee")).toHaveLength(12);
    expect(
      rubric.locales[0]?.criteria.filter(({ kind }) => kind === "project_contribution"),
    ).toHaveLength(1);
    expect(rubric.locales[0]?.criteria.filter(({ kind }) => kind === "manager")).toHaveLength(5);
    expect(rubric.locales[0]?.criteria.flatMap(({ anchors }) => anchors)).toHaveLength(90);
    expect(activationEvents).toHaveLength(1);
    expect(activationEvents[0]).toMatchObject({
      actorKind: "service",
      actorId: "bootstrap",
      scopeType: "organization",
      scopeId: organization.id,
      targetType: "rubric_version",
      targetId: rubric.id,
      source: "seed",
    });
  });

  it("limits the rubric lifecycle to draft and audited activation", async () => {
    const statuses = await client.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel
      FROM pg_enum
      JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
      WHERE pg_type.typname = 'RubricStatus'
      ORDER BY enumlabel
    `;

    expect(statuses.map(({ enumlabel }) => enumlabel)).toEqual(["active", "draft"]);
  });

  it("rejects a criterion linked to a section from another locale", async () => {
    const organization = await client.organization.findUniqueOrThrow({ where: { key: "leapai" } });
    const rubric = await client.rubricVersion.findUniqueOrThrow({
      where: { organizationId_version: { organizationId: organization.id, version: "1" } },
    });

    await expect(
      client.$transaction(async (transaction) => {
        const sectionLocale = await transaction.rubricLocale.create({
          data: {
            rubricVersionId: rubric.id,
            locale: "ar-SA",
            sourceHash: "0".repeat(64),
            biasGuidance: [],
          },
        });
        const criterionLocale = await transaction.rubricLocale.create({
          data: {
            rubricVersionId: rubric.id,
            locale: "fr-FR",
            sourceHash: "1".repeat(64),
            biasGuidance: [],
          },
        });
        const foreignSection = await transaction.rubricSection.create({
          data: {
            rubricLocaleId: sectionLocale.id,
            stableId: "FOREIGN",
            title: "Foreign section",
            weight: 100,
            displayOrder: 0,
          },
        });

        await transaction.rubricCriterion.create({
          data: {
            rubricLocaleId: criterionLocale.id,
            sectionId: foreignSection.id,
            stableId: "CROSS-LOCALE-01",
            kind: "employee",
            title: "Cross-locale criterion",
            internalWeight: 100,
            content: {},
            displayOrder: 0,
          },
        });
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("keeps a new locale draft mutable beneath active Version 1 until its own activation", async () => {
    const organization = await client.organization.findUniqueOrThrow({ where: { key: "leapai" } });
    const rubric = await client.rubricVersion.findUniqueOrThrow({
      where: { organizationId_version: { organizationId: organization.id, version: "1" } },
    });

    await expect(
      client.$transaction(async (transaction) => {
        const locale = await transaction.rubricLocale.create({
          data: {
            rubricVersionId: rubric.id,
            locale: "ar-SA",
            sourceHash: "0".repeat(64),
            biasGuidance: [],
          },
        });
        await transaction.rubricLocale.update({
          where: { id: locale.id },
          data: { biasGuidance: ["pending human review"] },
        });
        await transaction.rubricLocale.delete({ where: { id: locale.id } });
      }),
    ).resolves.toBeUndefined();
  });

  it("is idempotent when the approved rubric is already active", async () => {
    const firstCount = await client.auditEvent.count({
      where: { eventType: "rubric.version.activated" },
    });
    const result = await seedPilotWithAudit(
      client,
      { managerSubject: "pilot-manager", adminSubject: "system-admin" },
      databaseWriter,
    );
    const secondCount = await client.auditEvent.count({
      where: { eventType: "rubric.version.activated" },
    });

    expect(result.rubricActivation).toBeNull();
    expect(secondCount).toBe(firstCount);
  });

  it("rolls rubric creation and activation back when audit append fails", async () => {
    const organization = await client.organization.create({
      data: { key: `rollback-${crypto.randomUUID()}`, name: "Rollback test" },
    });
    const failingWriter: AuditWriter<DatabaseTransaction> = {
      append: vi.fn().mockRejectedValue(new Error("audit unavailable")),
    };

    await expect(
      activateRubricWithAudit(client, organization.id, approvedEnglishRubric, failingWriter),
    ).rejects.toThrow("audit unavailable");
    await expect(
      client.rubricVersion.findUnique({
        where: { organizationId_version: { organizationId: organization.id, version: "1" } },
      }),
    ).resolves.toBeNull();
    await expect(
      client.auditEvent.count({
        where: { eventType: "rubric.version.activated", scopeId: organization.id },
      }),
    ).resolves.toBe(0);
  });

  it("prevents mutation of every protected active-rubric field and child record", async () => {
    const organization = await client.organization.findUniqueOrThrow({ where: { key: "leapai" } });
    const rubric = await client.rubricVersion.findUniqueOrThrow({
      where: { organizationId_version: { organizationId: organization.id, version: "1" } },
      include: {
        locales: {
          include: { sections: true, criteria: { include: { anchors: true } } },
        },
      },
    });
    const locale = rubric.locales[0]!;
    const section = locale.sections[0]!;
    const criterion = locale.criteria[0]!;
    const anchor = criterion.anchors[0]!;

    const mutations = [
      client.rubricVersion.update({ where: { id: rubric.id }, data: { version: "corrected" } }),
      client.rubricVersion.update({ where: { id: rubric.id }, data: { activatedAt: new Date(0) } }),
      client.rubricVersion.delete({ where: { id: rubric.id } }),
      client.rubricLocale.update({
        where: { id: locale.id },
        data: { sourceHash: "0".repeat(64) },
      }),
      client.rubricSection.update({ where: { id: section.id }, data: { stableId: "changed" } }),
      client.rubricSection.update({ where: { id: section.id }, data: { title: "Changed" } }),
      client.rubricSection.update({ where: { id: section.id }, data: { weight: 0 } }),
      client.rubricCriterion.update({ where: { id: criterion.id }, data: { stableId: "changed" } }),
      client.rubricCriterion.update({ where: { id: criterion.id }, data: { title: "Changed" } }),
      client.rubricCriterion.update({ where: { id: criterion.id }, data: { internalWeight: 0 } }),
      client.rubricCriterion.update({ where: { id: criterion.id }, data: { content: {} } }),
      client.rubricAnchor.update({ where: { id: anchor.id }, data: { text: "Changed" } }),
      client.rubricAnchor.delete({ where: { id: anchor.id } }),
      client.rubricCriterion.delete({ where: { id: criterion.id } }),
      client.rubricSection.delete({ where: { id: section.id } }),
      client.rubricLocale.delete({ where: { id: locale.id } }),
      client.rubricSection.create({
        data: {
          rubricLocaleId: locale.id,
          stableId: "FORBIDDEN-SECTION",
          title: "Forbidden",
          weight: 0,
          displayOrder: 99,
        },
      }),
      client.rubricCriterion.create({
        data: {
          rubricLocaleId: locale.id,
          stableId: "FORBIDDEN-CRITERION",
          kind: "manager",
          title: "Forbidden",
          content: {},
          displayOrder: 99,
        },
      }),
      client.rubricAnchor.create({
        data: { criterionId: criterion.id, rating: 1, text: "Forbidden duplicate" },
      }),
    ];

    for (const mutation of mutations) {
      await expect(mutation).rejects.toThrow(/rubric content is immutable/u);
    }
  });

  it.each(["section", "criterion", "anchor"] as const)(
    "rejects moving an active %s under draft ancestry",
    async (recordType) => {
      const organization = await client.organization.findUniqueOrThrow({
        where: { key: "leapai" },
      });
      const rubric = await client.rubricVersion.findUniqueOrThrow({
        where: { organizationId_version: { organizationId: organization.id, version: "1" } },
        include: {
          locales: {
            include: { sections: true, criteria: { include: { anchors: true } } },
          },
        },
      });
      const activeLocale = rubric.locales.find(({ locale }) => locale === "en")!;
      const activeSection = activeLocale.sections[0]!;
      const activeCriterion = activeLocale.criteria.find(({ anchors }) => anchors.length > 0)!;
      const activeAnchor = activeCriterion.anchors[0]!;

      await expect(
        client.$transaction(async (transaction) => {
          const draftLocale = await transaction.rubricLocale.create({
            data: {
              rubricVersionId: rubric.id,
              locale: `zz-${recordType === "section" ? "AA" : recordType === "criterion" ? "BB" : "CC"}`,
              sourceHash: "0".repeat(64),
              biasGuidance: [],
            },
          });
          const draftCriterion = await transaction.rubricCriterion.create({
            data: {
              rubricLocaleId: draftLocale.id,
              stableId: "DRAFT-TARGET",
              kind: "manager",
              title: "Draft target",
              content: {},
              displayOrder: 99,
            },
          });

          if (recordType === "section") {
            await transaction.rubricSection.update({
              where: { id: activeSection.id },
              data: { rubricLocaleId: draftLocale.id },
            });
          } else if (recordType === "criterion") {
            await transaction.rubricCriterion.update({
              where: { id: activeCriterion.id },
              data: { rubricLocaleId: draftLocale.id },
            });
          } else {
            await transaction.rubricAnchor.update({
              where: { id: activeAnchor.id },
              data: { criterionId: draftCriterion.id },
            });
          }
          throw new Error("active ancestry reparenting bypassed immutability");
        }),
      ).rejects.toThrow(/rubric content is immutable/u);
    },
  );

  it("requires version and locale activation to transition from draft", async () => {
    const organization = await client.organization.findUniqueOrThrow({ where: { key: "leapai" } });
    const rubric = await client.rubricVersion.findUniqueOrThrow({
      where: { organizationId_version: { organizationId: organization.id, version: "1" } },
    });
    const directActivations = [
      () =>
        client.$transaction(async (transaction) => {
          await transaction.rubricVersion.create({
            data: {
              organizationId: organization.id,
              version: `direct-${crypto.randomUUID()}`,
              status: "active",
              activatedAt: new Date(),
            },
          });
          throw new Error("direct active version bypassed audited activation");
        }),
      () =>
        client.$transaction(async (transaction) => {
          await transaction.rubricLocale.create({
            data: {
              rubricVersionId: rubric.id,
              locale: "xy-XY",
              sourceHash: "0".repeat(64),
              status: "active",
              activatedAt: new Date(),
              biasGuidance: [],
            },
          });
          throw new Error("direct active locale bypassed audited activation");
        }),
    ];

    for (const activation of directActivations) {
      await expect(activation()).rejects.toThrow(/rubric activation must transition from draft/u);
    }
  });
});
