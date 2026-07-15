import console from "node:console";
import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

if (process.env.APP_ENV !== "local" || process.env.RESET_LOCAL_DATA !== "YES") {
  console.error(
    "Reset refused. Set APP_ENV=local and RESET_LOCAL_DATA=YES to delete local infrastructure data.",
  );
  process.exitCode = 1;
} else {
  await access(".env.local").catch(() => {
    throw new Error("Missing .env.local. Copy .env.example to .env.local before reset.");
  });
  process.loadEnvFile(".env.local");
  await execFileAsync(
    "docker",
    ["compose", "-f", "infra/docker/compose.yml", "down", "--volumes"],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  console.log("Local infrastructure containers, network, and persistent volumes were removed.");
}
