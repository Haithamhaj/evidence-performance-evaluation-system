"use client";

export function UpdateDraftSheet(
  properties: Readonly<{
    catalog: import("@evaluation/localization").Catalog;
    draft: Readonly<{
      summary: string;
      result: string;
      documentationNeeds: readonly string[];
      comparison: Readonly<{ explanation: string }>;
    }>;
  }>,
) {
  return (
    <section className="draftSheet">
      <h3>{properties.catalog["updates.currentDraft"]}</h3>
      <strong dir="auto">{properties.draft.summary}</strong>
      <p dir="auto">{properties.draft.result}</p>
      <p dir="auto">{properties.draft.comparison.explanation}</p>
      {properties.draft.documentationNeeds.length === 0 ? null : (
        <ul>
          {properties.draft.documentationNeeds.map((need) => (
            <li dir="auto" key={need}>
              {need}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
