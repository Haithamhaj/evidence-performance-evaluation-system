"use client";

export function ResearchSourceReviewSheet({
  catalog,
  confirming = false,
  onConfirm,
  review,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  confirming?: boolean;
  onConfirm?: (proposalHandles: readonly string[]) => void;
  review: import("../../../../../platform/research-experiments-contracts").WebResearchSourceReview;
}>) {
  if (review.output === null) {
    return (
      <section className="panel researchRecovery" aria-live="polite">
        <h2>{catalog["research.recoveryTitle"]}</h2>
        <p>{review.retrievalReason ?? catalog["research.recoveryBody"]}</p>
        {review.recoveryOptions.map((option) => (
          <p key={option.kind}>{option.explanation}</p>
        ))}
      </section>
    );
  }

  return (
    <div className="drawerBackdrop researchReviewBackdrop">
      <aside
        aria-labelledby="research-proposals-title"
        aria-modal="true"
        className="workItemDrawer researchReviewSheet"
        role="dialog"
      >
        <header className="drawerHeader">
          <div>
            <p className="eyebrow">{catalog["research.assistantDraft"]}</p>
            <h2 id="research-proposals-title">{catalog["research.editProposals"]}</h2>
          </div>
          <button autoFocus className="quietButton" type="button">
            {catalog["actions.close"]}
          </button>
        </header>
        <p className="boundaryNote">{catalog["research.confirmationBoundary"]}</p>
        <form
          className="researchProposalList"
          onSubmit={(event) => {
            event.preventDefault();
            const selected = new FormData(event.currentTarget).getAll("proposalHandle").map(String);
            if (selected.length > 0) onConfirm?.(selected);
          }}
        >
          {review.output.proposals.map((proposal) => (
            <fieldset className="researchProposal" disabled={confirming} key={proposal.handle}>
              <legend>{catalog[`research.proposal.${proposal.kind}`]}</legend>
              <label className="researchProposalSelection">
                <input
                  defaultChecked
                  name="proposalHandle"
                  type="checkbox"
                  value={proposal.handle}
                />
                <span>{catalog["research.includeProposal"]}</span>
              </label>
              <label>
                <span>{catalog["research.proposalTitle"]}</span>
                <input defaultValue={proposal.title} dir="auto" />
              </label>
              <label>
                <span>{catalog["research.proposalRationale"]}</span>
                <textarea defaultValue={proposal.rationale} dir="auto" />
              </label>
              {proposal.kind === "EXPERIMENT" ? (
                <>
                  <label>
                    <span>{catalog["research.question"]}</span>
                    <textarea defaultValue={proposal.question} dir="auto" />
                  </label>
                  <label>
                    <span>{catalog["research.baseline"]}</span>
                    <input defaultValue={proposal.baseline ?? ""} dir="auto" />
                  </label>
                </>
              ) : null}
              {proposal.kind === "RESEARCH" ? (
                <label>
                  <span>{catalog["research.question"]}</span>
                  <textarea defaultValue={proposal.question} dir="auto" />
                </label>
              ) : null}
              {proposal.kind === "WORK_ITEM" ? (
                <label>
                  <span>{catalog["research.description"]}</span>
                  <textarea defaultValue={proposal.description} dir="auto" />
                </label>
              ) : null}
            </fieldset>
          ))}
          <button className="primaryAction" disabled={confirming} type="submit">
            {confirming ? catalog["research.confirming"] : catalog["research.confirmSelected"]}
          </button>
        </form>
      </aside>
    </div>
  );
}
