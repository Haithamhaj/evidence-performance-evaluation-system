import { spawnSync } from "node:child_process";
import process from "node:process";

const environmentFile = process.env.INFRA_ENV_FILE?.trim() || ".env.local";
const composeArguments = ["--env-file", environmentFile, "-f", "infra/docker/compose.yml"];
const plugin = spawnSync("docker", ["compose", "version"], { stdio: "ignore" });
const executable = plugin.status === 0 ? "docker" : "docker-compose";
const prefix = plugin.status === 0 ? ["compose"] : [];
const result = spawnSync(executable, [...prefix, ...composeArguments, ...process.argv.slice(2)], {
  stdio: "inherit",
});

if (result.error !== undefined) throw result.error;
process.exitCode = result.status ?? 1;
