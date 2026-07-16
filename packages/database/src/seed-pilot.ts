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
