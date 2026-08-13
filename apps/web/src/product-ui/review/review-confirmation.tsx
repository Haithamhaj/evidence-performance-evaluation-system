"use client";

import { ProductIcon } from "@evaluation/ui";
import { useState } from "react";

import {
  createReviewState,
  editEvidence,
  editUpdate,
  selectedActions,
  toggleEvidence,
  toggleProgressProposal,
  toggleUpdate,
} from "../../features/review-confirmation/review-confirmation-model";
import { executeSelectedActions, type ReviewOutcome } from "../../platform/review-confirmation-api";
import styles from "./review-confirmation.module.css";

// JSX-only references are removed before the repository's base unused-variable rule runs.
// eslint-disable-next-line no-unused-vars
const ReviewProductIcon = ProductIcon;

export function ReviewConfirmation({
  catalog,
  draft,
  onBack,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  draft: import("../../features/review-confirmation/review-confirmation-model").ReviewConfirmationDraft;
  onBack: () => void;
}>) {
  const [state, setState] = useState(() => createReviewState(draft));
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<readonly ReviewOutcome[]>([]);
  const [busy, setBusy] = useState(false);
  const update = state.update;
  const evidence = state.evidence[0] ?? null;
  const progress = state.progressProposal;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const confirmed = (await executeSelectedActions(selectedActions(state))).outcomes;
      const updateOutcome = confirmed.find(({ kind }) => kind === "update");
      setOutcomes([
        ...confirmed,
        ...(state.progressProposal?.selected === true
          ? [
              updateOutcome?.state === "confirmed"
                ? {
                    kind: "progress_proposal" as const,
                    state: "confirmed" as const,
                    receiptId: updateOutcome.receiptId,
                    safeMessage: catalog["review.progressSent"],
                  }
                : {
                    kind: "progress_proposal" as const,
                    state: updateOutcome?.state ?? ("retryable_error" as const),
                    receiptId: null,
                    safeMessage: catalog["review.progressDeferred"],
                  },
            ]
          : []),
      ]);
    } catch {
      setError(catalog["review.recovery"]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.review!}>
      <header className={styles.header!}>
        <div>
          <h2>{catalog["review.title"]}</h2>
          <p>{catalog["review.subtitle"]}</p>
        </div>
        <ol className={styles.steps!}>
          <li>1&nbsp; {catalog["capture.step.capture"]}</li>
          <li>2&nbsp; {catalog["capture.step.clarify"]}</li>
          <li className={styles.active!}>3&nbsp; {catalog["capture.step.review"]}</li>
        </ol>
      </header>

      <div className={styles.sources!}>
        {draft.update?.sourceRefs.map((source) => (
          <span key={`${source.kind}-${source.label}`}>
            <ReviewProductIcon
              name={source.kind === "github" ? "github" : "paperclip"}
              size="small"
            />
            {source.label}
          </span>
        ))}
      </div>

      <p>
        <strong>{draft.project.name}</strong>
        {draft.workItem === null ? null : ` · ${draft.workItem.title}`}
      </p>

      {update === null ? null : (
        <section className={styles.section!}>
          <div className={styles.sectionTitle!}>
            <b>1</b>
            <h3>{catalog["review.updateTitle"]}</h3>
            <span>{catalog["review.editable"]}</span>
          </div>
          <label className={styles.select!}>
            <input
              checked={update.selected}
              onChange={(event) =>
                setState((current) => toggleUpdate(current, event.target.checked))
              }
              type="checkbox"
            />
            {catalog["review.confirmUpdate"]}
          </label>
          <label>
            {catalog["review.updateSummary"]}
            <input
              aria-label={catalog["review.updateSummary"]}
              value={update.summary}
              onChange={(event) =>
                setState((current) =>
                  editUpdate(current, {
                    summary: event.target.value,
                    result: current.update!.result,
                    nextAction: current.update!.nextAction,
                  }),
                )
              }
            />
          </label>
          <label>
            {catalog["review.updateResult"]}
            <textarea
              aria-label={catalog["review.updateResult"]}
              value={update.result}
              onChange={(event) =>
                setState((current) =>
                  editUpdate(current, {
                    summary: current.update!.summary,
                    result: event.target.value,
                    nextAction: current.update!.nextAction,
                  }),
                )
              }
            />
          </label>
        </section>
      )}

      {evidence === null ? null : (
        <section className={styles.section!}>
          <div className={styles.sectionTitle!}>
            <b>2</b>
            <h3>{catalog["review.evidenceTitle"]}</h3>
            <span>{catalog["review.editable"]}</span>
          </div>
          <label className={styles.select!}>
            <input
              checked={evidence.selected}
              onChange={(event) => {
                if (
                  event.target.checked &&
                  evidence.employeeEditRequired &&
                  !evidence.employeeEdited
                ) {
                  setError(catalog["review.editEvidenceFirst"]);
                  return;
                }
                setState((current) =>
                  toggleEvidence(current, evidence.draftId, event.target.checked),
                );
                setError(null);
              }}
              type="checkbox"
            />
            {catalog["review.confirmEvidence"]}
          </label>
          <label>
            {catalog["review.claim"]}
            <input
              aria-label={catalog["review.claim"]}
              value={evidence.supportedClaim}
              onChange={(event) =>
                setState((current) =>
                  editEvidence(current, evidence.draftId, {
                    supportedClaim: event.target.value,
                    contributionContext: evidence.contributionContext,
                  }),
                )
              }
            />
          </label>
          <label>
            {catalog["review.contribution"]}
            <textarea
              aria-label={catalog["review.contribution"]}
              value={evidence.contributionContext}
              onChange={(event) =>
                setState((current) =>
                  editEvidence(current, evidence.draftId, {
                    supportedClaim: evidence.supportedClaim,
                    contributionContext: event.target.value,
                  }),
                )
              }
            />
          </label>
          <small>{catalog["review.verificationRequired"]}</small>
        </section>
      )}

      {progress === null ? null : (
        <section className={styles.section!}>
          <div className={styles.sectionTitle!}>
            <b>3</b>
            <h3>{catalog["review.progressTitle"]}</h3>
          </div>
          <strong>{catalog["review.noProgressChange"]}</strong>
          <div className={styles.progress!}>
            <span>
              {catalog["review.observed"]}
              <b>{progress.proposedValue}</b>
            </span>
            <span>
              {catalog["review.rule"]}
              <b>{progress.rationale}</b>
            </span>
            <span>{catalog["review.progressRemains"]}</span>
          </div>
          <label className={styles.select!}>
            <input
              checked={progress.selected}
              onChange={(event) =>
                setState((current) => toggleProgressProposal(current, event.target.checked))
              }
              type="checkbox"
            />
            {catalog["review.sendOwner"]}
          </label>
        </section>
      )}

      <details className={styles.rationale!} open>
        <summary>
          <ReviewProductIcon name="sparkles" size="small" />
          {catalog["review.rationale"]}
        </summary>
        <p>{draft.uncertainty}</p>
      </details>
      <section className={styles.protections!}>
        <div>
          <h3>{catalog["review.after"]}</h3>
          <ul>
            {draft.afterConfirmation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>{catalog["review.protections"]}</h3>
          <p>{catalog["review.protectionCopy"]}</p>
        </div>
      </section>
      {error === null ? null : (
        <p className={styles.error!} role="alert">
          {error}
        </p>
      )}
      {outcomes.length === 0 ? null : (
        <ul className={styles.outcomes!}>
          {outcomes.map((outcome) => (
            <li key={outcome.kind} data-state={outcome.state}>
              {outcome.safeMessage}
            </li>
          ))}
        </ul>
      )}
      <footer className={styles.footer!}>
        <label>
          <input
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            type="checkbox"
          />
          {catalog["review.acknowledge"]}
        </label>
        <div>
          <button onClick={onBack} type="button">
            {catalog["review.back"]}
          </button>
          <button onClick={onBack} type="button">
            {catalog["review.savePrivate"]}
          </button>
          <button
            disabled={!acknowledged || busy || selectedActions(state).length === 0}
            onClick={() => void confirm()}
            type="button"
          >
            {catalog["review.confirm"]}
          </button>
        </div>
      </footer>
    </div>
  );
}
