"use client";

import { VoiceCapture } from "./voice-capture";
import { createElement } from "react";

export function UniversalCapture({
  catalog,
  sources = [],
  onSourcesChange,
  onVoiceConfirmed,
  scope,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  sources?: readonly Readonly<{ kind: string; url?: string }>[],
  onSourcesChange?: (event: import("react").ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onVoiceConfirmed?: (source: Readonly<{ kind: "voice_transcript"; voiceSessionId: string }>) => void;
  scope?: Readonly<{ projectId: string; workstreamId: string | null; workItemId: string | null }>;
}>) {
  const url = sources.find((source) => source.kind === "url")?.url ?? "";
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
      {scope === undefined
        ? null
        : createElement(VoiceCapture, {
            catalog,
            scope,
            ...(onVoiceConfirmed === undefined ? {} : { onConfirmed: onVoiceConfirmed }),
          })}
      <label>
        <span>{catalog["updates.source.file"]}</span>
        <input
          accept=".png,.jpg,.jpeg,.webp,.txt,.pdf,.docx"
          multiple
          name="sourceFiles"
          onChange={onSourcesChange}
          type="file"
        />
      </label>
      <label>
        <span>{catalog["updates.source.code"]}</span>
        <textarea dir="auto" name="sourceCode" onChange={onSourcesChange} rows={3} />
      </label>
      <label>
        <span>{catalog["updates.source.cli"]}</span>
        <textarea dir="auto" name="sourceCli" onChange={onSourcesChange} rows={3} />
      </label>
      <label>
        <span>{catalog["updates.source.url"]}</span>
        <input defaultValue={url} dir="ltr" name="sourceUrl" onChange={onSourcesChange} type="url" />
      </label>
      <label>
        <span>{catalog["updates.source.githubSnapshot"]}</span>
        <textarea dir="auto" name="sourceGithub" onChange={onSourcesChange} rows={3} />
      </label>
      <p className="boundaryNote">{catalog["updates.source.later"]}</p>
    </fieldset>
  );
}
