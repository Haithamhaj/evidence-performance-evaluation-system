export function sourceReviewEnabled() {
  return process.env.AI_NATIVE_SOURCE_REVIEW_ENABLED !== "false";
}

export function sourceReviewEnabledForRoles(roles: readonly string[]) {
  if (!sourceReviewEnabled()) return false;
  const protectedRoles = new Set(roles);
  return !protectedRoles.has("manager") && !protectedRoles.has("system_administrator");
}
