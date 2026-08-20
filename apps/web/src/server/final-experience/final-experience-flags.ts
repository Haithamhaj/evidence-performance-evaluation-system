type Environment = Readonly<Record<string, string | undefined>>;

export function finalHomeEnabled(environment: Environment = process.env): boolean {
  return enabled(environment.AI_NATIVE_FINAL_HOME_ENABLED);
}

export function finalProjectEnabled(environment: Environment = process.env): boolean {
  return enabled(environment.AI_NATIVE_FINAL_PROJECT_ENABLED);
}

export function finalWorkEnabled(environment: Environment = process.env): boolean {
  return enabled(environment.AI_NATIVE_FINAL_WORK_ENABLED);
}

export function finalCaptureEnabled(environment: Environment = process.env): boolean {
  return enabled(environment.AI_NATIVE_FINAL_CAPTURE_ENABLED);
}

export function finalReviewEnabled(environment: Environment = process.env): boolean {
  return enabled(environment.AI_NATIVE_FINAL_REVIEW_ENABLED);
}

function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() !== "false";
}
