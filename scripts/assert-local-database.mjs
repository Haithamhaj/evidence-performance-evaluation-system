import console from "node:console";
import process from "node:process";
import { URL } from "node:url";

const allowedEnvironments = new Set(["local", "test"]);
const allowedHosts = new Set(["localhost", "127.0.0.1", "postgres"]);

if (!allowedEnvironments.has(process.env.APP_ENV ?? "")) {
  console.error("Database reset refused: APP_ENV must be local or test");
  process.exit(1);
}

let target;
try {
  target = new URL(process.env.DATABASE_URL ?? "");
} catch {
  console.error("Database reset refused: DATABASE_URL is missing or invalid");
  process.exit(1);
}

if (!allowedHosts.has(target.hostname)) {
  console.error("Database reset refused: target host is not local");
  process.exit(1);
}
