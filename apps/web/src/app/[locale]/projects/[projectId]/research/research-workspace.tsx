"use client";

import { createElement, useState } from "react";

import {
  confirmResearchProposals,
  startResearchSourceReview,
} from "../../../../../platform/research-experiments-api";
import { ExperimentSheet } from "./experiment-sheet";
import { ResearchSourceReviewSheet } from "./source-review-sheet";

type ProjectContext = Readonly<{ name: string }>;

export function ResearchWorkspace({
  catalog,
  locale,
  project,
  projectId,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  locale: import("@evaluation/localization").Locale;
  project: ProjectContext;
  projectId: string;
}>) {
  const [review, setReview] = useState<
    import("../../../../../platform/research-experiments-contracts").WebResearchSourceReview | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [confirmationState, setConfirmationState] = useState<
    "idle" | "confirming" | "confirmed" | "failed"
  >("idle");

  return (
    <ResearchWorkspaceView
      catalog={catalog}
      locale={locale}
      project={project}
      review={review}
      experiments={[]}
      busy={busy}
      confirmationState={confirmationState}
      error={error}
      onInvestigate={(value) => {
        let url: URL;
        try {
          url = new URL(value);
        } catch {
          setError(true);
          return;
        }
        setBusy(true);
        setError(false);
        void startResearchSourceReview({ projectId, url: url.toString() })
          .then((nextReview) => {
            setReview(nextReview);
            setConfirmationState("idle");
          })
          .catch(() => setError(true))
          .finally(() => setBusy(false));
      }}
      onConfirm={(proposalHandles) => {
        if (review === null) return;
        setConfirmationState("confirming");
        void confirmResearchProposals({
          reviewHandle: review.handle,
          expectedVersion: review.version,
          proposalHandles,
          reason: "Employee reviewed and confirmed the editable proposals.",
        })
          .then(() => setConfirmationState("confirmed"))
          .catch(() => setConfirmationState("failed"));
      }}
    />
  );
}

export function ResearchWorkspaceView({
  busy = false,
  catalog,
  confirmationState = "idle",
  error = false,
  experiments,
  locale,
  onConfirm,
  onInvestigate,
  project,
  review,
}: Readonly<{
  busy?: boolean;
  catalog: import("@evaluation/localization").Catalog;
  confirmationState?: "idle" | "confirming" | "confirmed" | "failed";
  error?: boolean;
  experiments: readonly import("./experiment-sheet").ResearchExperimentView[];
  locale: import("@evaluation/localization").Locale;
  onConfirm?: (proposalHandles: readonly string[]) => void;
  onInvestigate?: (value: string) => void;
  project: ProjectContext;
  review:
    import("../../../../../platform/research-experiments-contracts").WebResearchSourceReview | null;
}>) {
  return (
    <section
      aria-labelledby="research-workspace-title"
      className="researchWorkspace researchWorkspaceMobileBoundary"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <header className="compactPageHeading">
        <div>
          <p className="eyebrow">{catalog["research.eyebrow"]}</p>
          <h1 id="research-workspace-title">{catalog["research.title"]}</h1>
          <p dir="auto">{project.name}</p>
        </div>
      </header>

      <form
        className="panel researchCapture"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          onInvestigate?.(String(form.get("research-input") ?? ""));
        }}
      >
        <label htmlFor="research-input">{catalog["research.captureLabel"]}</label>
        <div>
          <input
            id="research-input"
            name="research-input"
            placeholder={catalog["research.capturePlaceholder"]}
            required
            type="text"
          />
          <button className="primaryAction" disabled={busy} type="submit">
            {busy ? catalog["research.investigating"] : catalog["research.investigate"]}
          </button>
        </div>
        <p className="formHint">{catalog["research.oneQuestionAtATime"]}</p>
        {error ? (
          <p className="formError" role="alert">
            {catalog["research.safeError"]}
          </p>
        ) : null}
      </form>

      {review?.output === null || review === null ? null : (
        <article className="panel researchCitedCard">
          <header>
            <div>
              <p className="eyebrow">{catalog["research.citedReview"]}</p>
              <h2 dir="auto">{review.output.summary}</h2>
            </div>
            <button className="quietButton" type="button">
              {catalog["research.editProposals"]}
            </button>
          </header>
          {review.displayUrl === null ? null : (
            <a href={review.displayUrl} rel="noreferrer" target="_blank">
              <bdi dir="ltr">
                {new URL(review.displayUrl).host + new URL(review.displayUrl).pathname}
              </bdi>
            </a>
          )}
          <div className="researchInsightGrid">
            {createElement(ResearchInsight, {
              title: catalog["research.whyHelpful"],
              values: [review.output.relevance, ...review.output.benefits],
            })}
            {createElement(ResearchInsight, {
              title: catalog["research.mismatch"],
              values: review.output.mismatches,
            })}
            {createElement(ResearchInsight, {
              title: catalog["research.risks"],
              values: review.output.risks,
            })}
            {createElement(ResearchInsight, {
              title: catalog["research.uncertainty"],
              values: review.output.uncertainties,
            })}
            {createElement(ResearchInsight, {
              title: catalog["research.nextActions"],
              values: review.output.proposals.map((proposal) => proposal.title),
            })}
          </div>
          <ul className="researchCitations">
            {review.output.citations.map((citation) => (
              <li key={`${citation.label}:${citation.locator}`}>
                {citation.label} · <bdi dir="auto">{citation.locator}</bdi>
              </li>
            ))}
          </ul>
          <p className="boundaryNote">{catalog["research.noAutomaticTask"]}</p>
        </article>
      )}

      <details className="panel researchDetails">
        <summary>{catalog["research.methodDetails"]}</summary>
        <p>{catalog["research.methodDetailsBody"]}</p>
        <p>
          <bdi dir="ltr">{catalog["research.modelName"]}</bdi>
        </p>
      </details>
      {createElement(ExperimentSheet, { catalog, experiments })}
      {confirmationState === "confirmed" ? (
        <section aria-live="polite" className="panel researchConfirmationResult">
          <h2>{catalog["research.confirmedTitle"]}</h2>
          <p>{catalog["research.confirmedBody"]}</p>
        </section>
      ) : null}
      {confirmationState === "failed" ? (
        <p className="formError" role="alert">
          {catalog["research.confirmationRecovery"]}
        </p>
      ) : null}
      {review === null || confirmationState === "confirmed"
        ? null
        : createElement(ResearchSourceReviewSheet, {
            catalog,
            confirming: confirmationState === "confirming",
            ...(onConfirm === undefined ? {} : { onConfirm }),
            review,
          })}
    </section>
  );
}

function ResearchInsight({
  title,
  values,
}: Readonly<{ title: string; values: readonly string[] }>) {
  if (values.length === 0) return null;
  return (
    <section>
      <h3>{title}</h3>
      <ul>
        {values.map((value) => (
          <li dir="auto" key={value}>
            {value}
          </li>
        ))}
      </ul>
    </section>
  );
}
