const coverageKeys = {
  missing_source: "evaluationFacts.coverage.missingSource",
  partial_period: "evaluationFacts.coverage.partialPeriod",
  unverified_claim: "evaluationFacts.coverage.unverifiedClaim",
  disputed_attribution: "evaluationFacts.coverage.disputedAttribution",
  approved_leave_excluded: "evaluationFacts.coverage.approvedLeaveExcluded",
  incomplete_context: "evaluationFacts.coverage.incompleteContext",
} as const;

export function CoverageNotes({
  catalog,
  notes,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  notes: readonly import("@evaluation/contracts").SourceCoverageNote[];
}>) {
  if (notes.length === 0) return null;
  return (
    <section className="panel factSection" aria-labelledby="coverage-notes-heading">
      <h2 id="coverage-notes-heading">{catalog["evaluationFacts.coverageTitle"]}</h2>
      <ul className="compactSetupList">
        {notes.map((note, index) => (
          <li key={`${note.code}:${note.projectId ?? "cycle"}:${index}`}>
            <span>{catalog[coverageKeys[note.code]]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
