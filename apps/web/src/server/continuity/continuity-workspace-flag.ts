export function continuityWorkspaceEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  return environment.AI_NATIVE_CONTINUITY_WORKSPACE_ENABLED?.trim().toLowerCase() !== "false";
}
