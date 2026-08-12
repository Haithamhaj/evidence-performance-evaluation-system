export function workWorkspaceEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return environment.AI_NATIVE_WORK_WORKSPACE_ENABLED?.trim().toLowerCase() !== "false";
}
