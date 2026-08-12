export function intelligentTodayEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return environment.AI_NATIVE_INTELLIGENT_TODAY_ENABLED?.trim().toLowerCase() !== "false";
}
