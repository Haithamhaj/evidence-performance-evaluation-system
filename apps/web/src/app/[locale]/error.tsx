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
    <main role="alert" data-error-code="INTERNAL_ERROR">
      <h1 data-message-key="errors.internal">{catalog["errors.internal"]}</h1>
      {correlationId === undefined ? null : (
        <code>{createElement(BidiText, { kind: "hash", children: correlationId })}</code>
      )}
      <button type="button" data-message-key="actions.retry" onClick={reset}>
        {catalog["actions.retry"]}
      </button>
    </main>
  );
}
