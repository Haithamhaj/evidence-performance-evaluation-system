"use client";

import { localeMetadata, type Catalog, type Locale } from "@evaluation/localization";
import { useState } from "react";

import type { ContextProjectSuggestion } from "../../../platform/context-intelligence-api";

type Properties = Readonly<{
  catalog: Catalog;
  locale: Locale;
  projects: readonly { readonly handle: string; readonly name: string }[];
  suggestion: ContextProjectSuggestion;
  busy?: boolean;
  onConfirm?: () => void;
  onCorrect?: (projectHandle: string) => void;
  onReject?: () => void;
}>;

export function ProjectMatchCard({
  busy = false,
  catalog,
  locale,
  onConfirm,
  onCorrect,
  onReject,
  projects,
  suggestion,
}: Properties) {
  const [correctedProjectHandle, setCorrectedProjectHandle] = useState("");
  const canConfirm = suggestion.projectName !== null;

  return (
    <article className="smartReviewItem" dir={localeMetadata[locale].direction}>
      <div>
        <p className="aiDraftLabel">{catalog["contextReview.prepared"]}</p>
        <h3>{suggestion.projectName ?? catalog["contextReview.noProjectSelected"]}</h3>
        <p>
          <strong>{catalog["contextReview.likelyLinkedBecause"]}</strong> {suggestion.explanation}
        </p>
      </div>
      <details className="smartReviewSource">
        <summary>{catalog["contextReview.inspectSource"]}</summary>
        <strong dir="auto">{suggestion.source.title}</strong>
        {suggestion.source.summary === null ? null : <p dir="auto">{suggestion.source.summary}</p>}
        {suggestion.source.sourceUrl === null ? null : (
          <a href={suggestion.source.sourceUrl} rel="noreferrer" target="_blank">
            {catalog["connectedContext.openSource"]}
          </a>
        )}
      </details>
      <div className="smartReviewActions">
        <button
          className="primaryAction"
          disabled={busy || !canConfirm}
          onClick={onConfirm}
          type="button"
        >
          {catalog["contextReview.confirmLink"]}
        </button>
        <label>
          <span>{catalog["contextReview.chooseAnotherProject"]}</span>
          <select
            disabled={busy}
            onChange={(event) => {
              setCorrectedProjectHandle(event.target.value);
              if (event.target.value !== "") onCorrect?.(event.target.value);
            }}
            value={correctedProjectHandle}
          >
            <option value="">{catalog["tasks.selectProject"]}</option>
            {projects.map((candidate) => (
              <option key={candidate.handle} value={candidate.handle}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
        <button className="quietButton" disabled={busy} onClick={onReject} type="button">
          {catalog["contextReview.rejectLink"]}
        </button>
      </div>
    </article>
  );
}
