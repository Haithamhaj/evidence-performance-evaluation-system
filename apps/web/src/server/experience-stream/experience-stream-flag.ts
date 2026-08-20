export function experienceStreamEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return environment.AI_NATIVE_EXPERIENCE_STREAM_ENABLED?.trim().toLowerCase() !== "false";
}
