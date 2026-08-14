import { localeMetadata } from "@evaluation/localization";

type Draft =
  import("../../../../../../platform/progress-contract-drafts").PublicProgressContractDraft;
type Contract =
  import("../../../../../../platform/progress-contract-drafts").ProgressContractReviewState;

export function ReviewStep({
  busy,
  catalog,
  contract,
  draft,
  locale,
  onApply,
  onBack,
  onDecision,
}: Readonly<{
  busy: boolean;
  catalog: import("@evaluation/localization").Catalog;
  contract: Contract | null;
  draft: Draft;
  locale: import("@evaluation/localization").Locale;
  onApply: (reason: string, calculationKind: "weighted" | "stage_gate") => void;
  onBack: () => void;
  onDecision: (action: "submit" | "approve", reason: string) => void;
}>) {
  const defaultCalculationKind = draft.draft?.components.every(
    (component) => component.weight !== null,
  )
    ? "weighted"
    : "stage_gate";
  function submit(event: import("react").FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const reason = String(form.get("reason") ?? "").trim();
    if (contract === null) {
      onApply(reason, form.get("calculationKind") === "weighted" ? "weighted" : "stage_gate");
    } else if (contract.state === "draft") {
      onDecision("submit", reason);
    } else if (contract.state === "pending_approval") {
      onDecision("approve", reason);
    }
  }
  const actionLabel =
    contract === null
      ? catalog["progressContract.applyAsDraft"]
      : contract.state === "draft"
        ? catalog["progressContract.submitForApproval"]
        : contract.state === "pending_approval"
          ? catalog["progressContract.activate"]
          : catalog["progressContract.active"];
  return (
    <section className="progressSetupStep" dir={localeMetadata[locale].direction}>
      <p className="setupStepNumber">4 / 4</p>
      <h2>{catalog["progressSetup.step.review"]}</h2>
      <p>{catalog["progressSetup.reviewIntro"]}</p>
      <div className="reviewSummary">
        <strong>{draft.draft?.components.length ?? 0}</strong>
        <span>{catalog["progressSetup.measurableComponents"]}</span>
      </div>
      <form onSubmit={submit}>
        {contract === null ? (
          <label>
            <span>{catalog["progressContract.calculationKind"]}</span>
            <select defaultValue={defaultCalculationKind} name="calculationKind">
              <option value="weighted">{catalog["progressContract.calculation.weighted"]}</option>
              <option value="stage_gate">
                {catalog["progressContract.calculation.stage_gate"]}
              </option>
            </select>
          </label>
        ) : null}
        {contract?.state === "active" ? null : (
          <label>
            <span>{catalog["progressContract.reason"]}</span>
            <textarea dir="auto" maxLength={500} name="reason" required rows={2} />
          </label>
        )}
        <p className="boundaryNote">{catalog["progressContract.activationRequired"]}</p>
        <p className="boundaryNote">{catalog["progressSetup.notPerformance"]}</p>
        <details className="safeAuditDetails">
          <summary>{catalog["progressSetup.auditDetails"]}</summary>
          <p>
            {catalog["progressContract.sourceVersion"]}: {draft.source.version}
          </p>
          <p>
            {catalog["progressContract.revision"]}: {draft.revision}
          </p>
        </details>
        <div className="formActions">
          <button className="quietButton" onClick={onBack} type="button">
            {catalog["actions.back"]}
          </button>
          <button
            className="primaryAction"
            disabled={busy || contract?.state === "active"}
            type="submit"
          >
            {actionLabel}
          </button>
        </div>
      </form>
    </section>
  );
}
