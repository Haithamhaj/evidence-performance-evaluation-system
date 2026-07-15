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
  readonly subject: string;
}

function requiredSubject(name: string, value: string): string {
  const subject = value.trim();
  if (subject.length === 0) throw new Error(`${name} must not be empty`);
  return subject;
}

async function upsertPilotUser(
  transaction: TransactionClient,
  issuer: string,
  identity: PilotIdentity,
): Promise<DatabaseUser> {
  const existingIdentity = await transaction.oidcIdentity.findUnique({
    where: { issuer_subject: { issuer, subject: identity.subject } },
    include: { user: true },
  });
  if (existingIdentity !== null) return existingIdentity.user;

  const user = await transaction.user.upsert({
    where: { email: identity.email },
    update: { displayName: identity.displayName },
    create: { email: identity.email, displayName: identity.displayName },
  });

  await transaction.oidcIdentity.create({
    data: { issuer, subject: identity.subject, userId: user.id },
  });
  return user;
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

  const manager = await upsertPilotUser(transaction, issuer, {
    displayName: "Pilot Manager",
    email: "pilot-manager@seed.invalid",
    subject: managerSubject,
  });
  const administrator = await upsertPilotUser(transaction, issuer, {
    displayName: "System Administrator",
    email: "system-admin@seed.invalid",
    subject: adminSubject,
  });
  if (manager.id === administrator.id) {
    throw new Error("Pilot manager and system administrator must be separate users");
  }

  const changes = await Promise.all([
    ensureRoleAssignment(transaction, {
      userId: manager.id,
      role: "manager",
      scopeType: "department",
      scopeId: department.id,
    }),
    ensureRoleAssignment(transaction, {
      userId: administrator.id,
      role: "system_administrator",
      scopeType: "system",
      scopeId: "system",
    }),
  ]);

  return changes.filter((change): change is RoleAssignmentChange => change !== null);
}
