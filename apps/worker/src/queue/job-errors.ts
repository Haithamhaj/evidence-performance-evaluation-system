const SAFE_ERROR_CODE = /^[A-Z][A-Z0-9_]{2,99}$/u;

export class JobExecutionError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, retryable: boolean) {
    if (!SAFE_ERROR_CODE.test(code)) throw new TypeError("Job error code must be sanitized");
    super(code);
    this.code = code;
    this.retryable = retryable;
    this.name = "JobExecutionError";
  }
}

export class RetryableJobError extends JobExecutionError {
  constructor(code: string) {
    super(code, true);
    this.name = "RetryableJobError";
  }
}

export class NonRetryableJobError extends JobExecutionError {
  constructor(code: string) {
    super(code, false);
    this.name = "NonRetryableJobError";
  }
}

export class PolicyJobError extends NonRetryableJobError {
  constructor(code = "JOB_POLICY_DENIED") {
    super(code);
    this.name = "PolicyJobError";
  }
}

export function asJobExecutionError(error: unknown): JobExecutionError {
  return error instanceof JobExecutionError ? error : new RetryableJobError("JOB_EXECUTION_FAILED");
}
