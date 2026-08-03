"use client";

export function UniversalCapture({
  catalog,
  initialSource,
  onSourceKindChange,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  initialSource?: Readonly<{ kind: string; url?: string }> | null;
  onSourceKindChange?: (source: Readonly<{ kind: string; url?: string }> | null) => void;
}>) {
  return (
    <fieldset className="sourceChoices">
      <legend>{catalog["updates.sources"]}</legend>
      <div className="sourceChoices" aria-label={catalog["updates.sources"]}>
        {(["text", "file", "image", "code", "cli", "url", "githubSnapshot"] as const).map(
          (source) => (
            <span className="sourceChoice" key={source}>
              {catalog[`updates.source.${source}`]}
            </span>
          ),
        )}
        {(["voice", "connectedGithub"] as const).map((source) => (
          <span aria-disabled="true" className="sourceChoice" key={source}>
            {catalog[`updates.source.${source}`]}
          </span>
        ))}
      </div>
      <label>
        <span>{catalog["updates.source.text"]}</span>
        <select
          defaultValue={initialSource?.kind ?? ""}
          name="sourceKind"
          onChange={(event) =>
            onSourceKindChange?.(
              event.currentTarget.value === "" ? null : { kind: event.currentTarget.value },
            )
          }
        >
          <option value="">{catalog["updates.noneOptional"]}</option>
          <option value="pasted_code">{catalog["updates.source.code"]}</option>
          <option value="cli_snapshot">{catalog["updates.source.cli"]}</option>
          <option value="url">{catalog["updates.source.url"]}</option>
          <option value="github_snapshot">{catalog["updates.source.githubSnapshot"]}</option>
        </select>
      </label>
      <label>
        <span>{catalog["updates.rawText"]}</span>
        <textarea
          defaultValue={initialSource?.kind === "url" ? initialSource.url : ""}
          dir="auto"
          name="sourceText"
          rows={3}
        />
      </label>
      <p className="boundaryNote">{catalog["updates.source.later"]}</p>
    </fieldset>
  );
}
