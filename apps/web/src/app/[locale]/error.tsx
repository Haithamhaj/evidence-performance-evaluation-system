"use client";

interface ErrorBoundaryProperties {
  readonly error: Error & { readonly correlationId?: string };
  readonly reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProperties) {
  return (
    <main role="alert" data-error-code="INTERNAL_ERROR">
      <h1 data-message-key="errors.internal">errors.internal</h1>
      {error.correlationId === undefined ? null : <code>{error.correlationId}</code>}
      <button type="button" data-message-key="actions.retry" onClick={reset}>
        actions.retry
      </button>
    </main>
  );
}
