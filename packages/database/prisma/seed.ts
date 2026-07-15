import { createDatabaseClient, seedPilot, withTransaction } from "../src/index.js";

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`);
  return value;
}

const client = createDatabaseClient(requiredEnvironment("DATABASE_URL"));

try {
  await withTransaction(client, (transaction) =>
    seedPilot(transaction, {
      managerSubject: requiredEnvironment("PILOT_MANAGER_OIDC_SUBJECT"),
      adminSubject: requiredEnvironment("PILOT_ADMIN_OIDC_SUBJECT"),
      oidcIssuer: requiredEnvironment("OIDC_ISSUER"),
    }),
  );
} finally {
  await client.$disconnect();
}
