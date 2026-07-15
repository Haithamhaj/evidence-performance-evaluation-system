"use client";

interface ErrorBoundaryProperties {
  readonly error: Error & { readonly correlationId?: unknown };
  readonly reset: () => void;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function getSafeErrorCorrelationId(error: { readonly correlationId?: unknown }) {
  return typeof error.correlationId === "string" && UUID_PATTERN.test(error.correlationId)
    ? error.correlationId
    : undefined;
}

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProperties) {
  const correlationId = getSafeErrorCorrelationId(error);

  return (
    <main role="alert" data-error-code="INTERNAL_ERROR">
      <h1 data-message-key="errors.internal">errors.internal</h1>
      {correlationId === undefined ? null : <code>{correlationId}</code>}
      <button type="button" data-message-key="actions.retry" onClick={reset}>
        actions.retry
      </button>
    </main>
  );
}
