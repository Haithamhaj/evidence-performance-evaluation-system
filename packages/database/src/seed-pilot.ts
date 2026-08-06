import type { Role, ScopeType } from "./generated/prisma/client.js";

type TransactionClient = import("./generated/prisma/client.js").Prisma.TransactionClient;
type DatabaseUser = import("./generated/prisma/client.js").User;

export const PILOT_SEED_ISSUER = "urn:evaluation:pilot-seed";

const PILOT_ORGANIZATION = { key: "leapai", name: "LeapAI" } as const;
const PILOT_DEPARTMENT = { key: "ai-department", name: "AI Department" } as const;

export interface PilotSubjects {
  readonly managerSubject: string;
  readonly adminSubject: string;
  readonly oidcIssuer?: string;
}

export interface RoleAssignmentChange {
  readonly assignmentId: string;
  readonly change: "created";
  readonly role: Role;
  readonly scopeId: string;
  readonly scopeType: ScopeType;
  readonly userId: string;
}

interface PilotIdentity {
  readonly displayName: string;
  readonly email: string;
  readonly pilotKey: "pilot-manager" | "system-admin";
}

interface PilotEvaluationCriterionSeed {
  readonly id: string;
  readonly title: string;
  readonly sectionId: string;
  readonly internalWeight?: number | undefined;
  readonly definition?: string | undefined;
  readonly purpose?: string | undefined;
  readonly anchors: ReadonlyArray<Readonly<{ rating: number; text: string }>>;
  readonly examples: ReadonlyArray<string>;
  readonly evidenceGuidance?: string | undefined;
}

export interface PilotEvaluationRubricSeed {
  readonly version: string;
  readonly locale: string;
  readonly sourceHash: string;
  readonly sections: ReadonlyArray<Readonly<{ id: string; title: string; weight: number }>>;
  readonly employeeCriteria: ReadonlyArray<PilotEvaluationCriterionSeed>;
  readonly projectContribution: PilotEvaluationCriterionSeed;
}

export interface PilotEvaluationTemplateSeedInput {
  readonly organizationId: string;
  readonly departmentId: string;
  readonly rubricVersionId: string;
  readonly createdById: string;
  readonly rubric: PilotEvaluationRubricSeed;
}

function requiredSubject(name: string, value: string): string {
  const subject = value.trim();
  if (subject.length === 0) throw new Error(`${name} must not be empty`);
  return subject;
}

async function upsertPilotUser(
  transaction: TransactionClient,
  identity: PilotIdentity,
): Promise<DatabaseUser> {
  return transaction.user.upsert({
    where: { pilotKey: identity.pilotKey },
    update: { displayName: identity.displayName },
    create: {
      pilotKey: identity.pilotKey,
      email: identity.email,
      displayName: identity.displayName,
    },
  });
}

async function bindPilotIdentity(
  transaction: TransactionClient,
  user: DatabaseUser,
  issuer: string,
  subject: string,
): Promise<void> {
  const existingIdentity = await transaction.oidcIdentity.findUnique({
    where: { issuer_subject: { issuer, subject } },
  });
  if (existingIdentity !== null) {
    if (existingIdentity.userId !== user.id) {
      throw new Error("OIDC identity is already assigned to another user");
    }
    return;
  }

  await transaction.oidcIdentity.create({ data: { issuer, subject, userId: user.id } });
}

async function rejectOppositePilotRole(
  transaction: TransactionClient,
  userId: string,
  oppositeRole: "manager" | "system_administrator",
): Promise<void> {
  const assignment = await transaction.roleAssignment.findFirst({
    where: { userId, role: oppositeRole },
    select: { id: true },
  });
  if (assignment !== null) throw new Error("Pilot user has the opposite protected pilot role");
}

async function ensureAuthorizationScope(
  transaction: TransactionClient,
  input: Readonly<{
    key: string;
    scopeType: ScopeType;
    departmentId: string | null;
  }>,
): Promise<{ readonly id: string }> {
  const existing = await transaction.authorizationScope.findUnique({ where: { key: input.key } });
  if (existing !== null) {
    if (existing.scopeType !== input.scopeType || existing.departmentId !== input.departmentId) {
      throw new Error("Canonical authorization scope conflicts with the pilot seed");
    }
    return existing;
  }

  return transaction.authorizationScope.create({ data: input });
}

async function ensureRoleAssignment(
  transaction: TransactionClient,
  input: Readonly<{
    userId: string;
    role: Role;
    scopeType: ScopeType;
    scopeId: string;
  }>,
): Promise<RoleAssignmentChange | null> {
  const existing = await transaction.roleAssignment.findUnique({
    where: { userId_role_scopeType_scopeId: input },
  });
  if (existing !== null) return null;

  const created = await transaction.roleAssignment.create({ data: input });
  return {
    assignmentId: created.id,
    change: "created",
    role: created.role,
    scopeId: created.scopeId,
    scopeType: created.scopeType,
    userId: created.userId,
  };
}

export async function seedPilot(
  transaction: TransactionClient,
  subjects: PilotSubjects,
): Promise<RoleAssignmentChange[]> {
  const managerSubject = requiredSubject("Pilot manager subject", subjects.managerSubject);
  const adminSubject = requiredSubject("System administrator subject", subjects.adminSubject);
  if (managerSubject === adminSubject) {
    throw new Error("Pilot manager and system administrator subjects must be distinct");
  }

  const issuer = (subjects.oidcIssuer ?? PILOT_SEED_ISSUER).trim();
  if (issuer.length === 0) throw new Error("OIDC issuer must not be empty");

  const organization = await transaction.organization.upsert({
    where: { key: PILOT_ORGANIZATION.key },
    update: { name: PILOT_ORGANIZATION.name },
    create: PILOT_ORGANIZATION,
  });
  const department = await transaction.department.upsert({
    where: { key: PILOT_DEPARTMENT.key },
    update: { name: PILOT_DEPARTMENT.name, organizationId: organization.id },
    create: {
      ...PILOT_DEPARTMENT,
      organizationId: organization.id,
    },
  });

  const systemScope = await ensureAuthorizationScope(transaction, {
    key: "system",
    scopeType: "system",
    departmentId: null,
  });
  const departmentScope = await ensureAuthorizationScope(transaction, {
    key: `department:${PILOT_DEPARTMENT.key}`,
    scopeType: "department",
    departmentId: department.id,
  });

  const manager = await upsertPilotUser(transaction, {
    pilotKey: "pilot-manager",
    displayName: "Pilot Manager",
    email: "pilot-manager@seed.invalid",
  });
  const administrator = await upsertPilotUser(transaction, {
    pilotKey: "system-admin",
    displayName: "System Administrator",
    email: "system-admin@seed.invalid",
  });
  if (manager.id === administrator.id) {
    throw new Error("Pilot manager and system administrator must be separate users");
  }

  await rejectOppositePilotRole(transaction, manager.id, "system_administrator");
  await rejectOppositePilotRole(transaction, administrator.id, "manager");
  await bindPilotIdentity(transaction, manager, issuer, managerSubject);
  await bindPilotIdentity(transaction, administrator, issuer, adminSubject);

  const changes = await Promise.all([
    ensureRoleAssignment(transaction, {
      userId: manager.id,
      role: "manager",
      scopeType: "department",
      scopeId: departmentScope.id,
    }),
    ensureRoleAssignment(transaction, {
      userId: administrator.id,
      role: "system_administrator",
      scopeType: "system",
      scopeId: systemScope.id,
    }),
  ]);

  return changes.filter((change): change is RoleAssignmentChange => change !== null);
}

export async function seedPilotEvaluationTemplateVersionOne(
  transaction: TransactionClient,
  input: PilotEvaluationTemplateSeedInput,
): Promise<Readonly<{ templateId: string; versionId: string }>> {
  const key = "pilot-employee-evaluation";
  const existing = await transaction.evaluationTemplate.findUnique({
    where: {
      organizationId_departmentId_key: {
        organizationId: input.organizationId,
        departmentId: input.departmentId,
        key,
      },
    },
    include: { versions: { orderBy: { versionNumber: "asc" } } },
  });
  if (existing !== null) {
    const version = existing.versions[0];
    if (
      existing.scope !== "DEPARTMENT" ||
      existing.versions.length !== 1 ||
      version === undefined ||
      version.versionNumber !== 1 ||
      version.rubricVersionId !== input.rubricVersionId
    ) {
      throw new Error("Existing pilot evaluation template conflicts with approved Version 1");
    }
    return { templateId: existing.id, versionId: version.id };
  }

  if (input.rubric.version !== "1" || input.rubric.locale !== "en") {
    throw new Error("Pilot evaluation template requires approved English rubric Version 1");
  }
  const sectionWeights = new Map(
    input.rubric.sections.map((section) => [section.id, section.weight]),
  );
  const criteria = [...input.rubric.employeeCriteria, input.rubric.projectContribution];
  const created = await transaction.evaluationTemplate.create({
    data: {
      organizationId: input.organizationId,
      departmentId: input.departmentId,
      scope: "DEPARTMENT",
      key,
      name: "LeapAI AI Department Employee Evaluation",
      createdById: input.createdById,
      versions: {
        create: {
          rubricVersionId: input.rubricVersionId,
          versionNumber: 1,
          ratingScale: [1, 2, 3, 4, 5],
          weightPolicy: {
            sectionTotal: 100,
            fixedCriterionTotalPerSection: 100,
            projectContributionAutomaticAverage: false,
          },
          evaluationPolicy: {
            cadence: "QUARTERLY",
            cycleOneType: "CALIBRATION_NON_BASELINE",
            employeeRanking: false,
            documentationReadinessScoring: false,
          },
          localeAvailability: ["en"],
          createdById: input.createdById,
          items: {
            create: criteria.map((criterion, displayOrder) => {
              const sectionWeight = sectionWeights.get(criterion.sectionId);
              if (sectionWeight === undefined) {
                throw new Error(`Approved rubric section ${criterion.sectionId} is missing`);
              }
              const range = protectedAllowedRange(criterion.id);
              return {
                stableCriterionId: criterion.id,
                kind:
                  criterion.id === input.rubric.projectContribution.id
                    ? ("PROJECT_CONTRIBUTION" as const)
                    : ("FIXED_CRITERION" as const),
                sectionStableId: criterion.sectionId,
                sectionWeight,
                criterionWeight: criterion.internalWeight ?? null,
                displayOrder,
                protectedGlobal: range !== null,
                mandatory: true,
                allowedWeightMinimum: range?.minimum ?? null,
                allowedWeightMaximum: range?.maximum ?? null,
                locales: {
                  create: {
                    locale: input.rubric.locale,
                    title: criterion.title,
                    definition: criterion.definition ?? criterion.purpose ?? criterion.title,
                    anchors: criterion.anchors as never,
                    examples: criterion.examples as never,
                    evidenceGuidance:
                      criterion.evidenceGuidance === undefined ? [] : [criterion.evidenceGuidance],
                  },
                },
              };
            }),
          },
        },
      },
    },
    include: { versions: true },
  });
  const version = created.versions[0];
  if (version === undefined) throw new Error("Pilot evaluation template Version 1 was not created");
  return { templateId: created.id, versionId: version.id };
}

function protectedAllowedRange(
  criterionId: string,
): Readonly<{ minimum: number; maximum: number }> | null {
  switch (criterionId) {
    case "PPB-01":
      return { minimum: 4, maximum: 8 };
    case "PPB-02":
      return { minimum: 3, maximum: 7 };
    case "PPB-03":
      return { minimum: 2, maximum: 6 };
    default:
      return null;
  }
}
