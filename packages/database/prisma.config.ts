import "dotenv/config";

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: process.env.PRISMA_MIGRATIONS_PATH ?? "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
