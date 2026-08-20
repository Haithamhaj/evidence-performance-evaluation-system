export function canUsePrivateCapture(
  principal: Readonly<{ active: boolean; roles: readonly string[] }>,
): boolean {
  return (
    principal.active &&
    principal.roles.some((role) => role === "employee" || role === "contributor")
  );
}
