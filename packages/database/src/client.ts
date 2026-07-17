import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client.js";

export function createDatabaseClient(connectionString: string): PrismaClient {
  if (connectionString.trim().length === 0) {
    throw new Error("Database connection string is required");
  }

  const adapter = new PrismaPg({ connectionString, options: "-c timezone=UTC" });
  return new PrismaClient({ adapter });
}
