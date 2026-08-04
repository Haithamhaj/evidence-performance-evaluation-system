import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const stableNextEnvironment = [
  '/// <reference types="next" />',
  '/// <reference types="next/image-types/global" />',
  'import "./.next/types/routes.d.ts";',
  "",
  "// NOTE: This file should not be edited",
  "// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.",
  "",
].join("\n");

export async function prepareNextGeneratedTypes(appDirectory) {
  const resolvedDirectory = path.resolve(appDirectory);
  await rm(path.join(resolvedDirectory, ".next", "dev"), { force: true, recursive: true });
  await writeFile(path.join(resolvedDirectory, "next-env.d.ts"), stableNextEnvironment);
}

const invokedPath = process.argv[1] === undefined ? undefined : path.resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  const appDirectory = process.argv[2];
  if (appDirectory === undefined) {
    process.stderr.write("Usage: prepare-next-generated-types.mjs <app-directory>\n");
    process.exitCode = 1;
  } else {
    await prepareNextGeneratedTypes(appDirectory);
  }
}
