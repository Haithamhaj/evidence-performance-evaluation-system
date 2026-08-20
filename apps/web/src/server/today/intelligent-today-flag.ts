export function intelligentTodayEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return environment.AI_NATIVE_INTELLIGENT_TODAY_ENABLED?.trim().toLowerCase() !== "false";
}

export function intelligentTodayEnabledForRoles(
  roles: readonly string[],
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  if (!intelligentTodayEnabled(environment)) return false;
  const protectedRoles = new Set(roles);
  return !protectedRoles.has("manager") && !protectedRoles.has("system_administrator");
}
