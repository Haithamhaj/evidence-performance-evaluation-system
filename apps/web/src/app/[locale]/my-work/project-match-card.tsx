"use client";

import { localeMetadata, type Catalog, type Locale } from "@evaluation/localization";
import { useState } from "react";

import type { ContextProjectSuggestion } from "../../../platform/context-intelligence-api";
import type { ConnectedWorkContextItem } from "../../../platform/connected-work-context-api";
import type { ProjectOption } from "./connected-context";

type Properties = Readonly<{
  catalog: Catalog;
  locale: Locale;
  projects: readonly ProjectOption[];
  suggestion: ContextProjectSuggestion;
  source?: ConnectedWorkContextItem | undefined;
  busy?: boolean;
  onConfirm?: () => void;
  onCorrect?: (projectId: string) => void;
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
  source,
  suggestion,
}: Properties) {
  const [correctedProjectId, setCorrectedProjectId] = useState("");
  const project = projects.find(({ id }) => id === suggestion.projectId);
  const canConfirm = suggestion.projectId !== null && project !== undefined;

  return (
    <article className="smartReviewItem" dir={localeMetadata[locale].direction}>
      <div>
        <p className="aiDraftLabel">{catalog["contextReview.prepared"]}</p>
        <h3>{project?.name ?? catalog["contextReview.noProjectSelected"]}</h3>
        <p>
          <strong>{catalog["contextReview.likelyLinkedBecause"]}</strong> {suggestion.explanation}
        </p>
      </div>
      <details className="smartReviewSource">
        <summary>{catalog["contextReview.inspectSource"]}</summary>
        {source === undefined ? (
          <p>{catalog["contextReview.sourceUnavailable"]}</p>
        ) : (
          <>
            <strong dir="auto">{source.title}</strong>
            {source.summary === null ? null : <p dir="auto">{source.summary}</p>}
            {source.sourceUrl === null ? null : (
              <a href={source.sourceUrl} rel="noreferrer" target="_blank">
                {catalog["connectedContext.openSource"]}
              </a>
            )}
          </>
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
              setCorrectedProjectId(event.target.value);
              if (event.target.value !== "") onCorrect?.(event.target.value);
            }}
            value={correctedProjectId}
          >
            <option value="">{catalog["tasks.selectProject"]}</option>
            {projects.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
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
