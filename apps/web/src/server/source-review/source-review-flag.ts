export function sourceReviewEnabled() {
  return process.env.AI_NATIVE_SOURCE_REVIEW_ENABLED !== "false";
}
