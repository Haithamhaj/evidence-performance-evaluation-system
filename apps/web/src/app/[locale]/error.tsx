"use client";

import { getCatalogSync, isLocale } from "@evaluation/localization";
import { BidiText } from "@evaluation/ui";
import { useParams } from "next/navigation";
import { createElement } from "react";

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
  const params = useParams<{ locale?: string }>();
  const locale = params.locale !== undefined && isLocale(params.locale) ? params.locale : "ar";
  const catalog = getCatalogSync(locale);

  return (
    <main className="routeState" role="alert" data-error-code="SHELL_CONTEXT_UNAVAILABLE">
      <h1 data-message-key="shell.errorTitle">{catalog["shell.errorTitle"]}</h1>
      <p data-message-key="shell.errorBody">{catalog["shell.errorBody"]}</p>
      {correlationId === undefined ? null : (
        <code>{createElement(BidiText, { kind: "hash", children: correlationId })}</code>
      )}
      <div className="routeStateActions">
        <button type="button" data-message-key="actions.retry" onClick={reset}>
          {catalog["actions.retry"]}
        </button>
        <a href="/api/auth/login">{catalog["actions.login"]}</a>
      </div>
    </main>
  );
}
