"use client";

import { ActionButton, FocusedDialog, ProductIcon } from "@evaluation/ui";
import { createElement, useRef, useState } from "react";

import { VoiceCapture } from "../../app/[locale]/my-work/voice-capture";
import { understandCapture } from "../../platform/capture-understanding-api";
import { stageCaptureUpdateFile } from "../../platform/capture-update-source-api";
import {
  answerCaptureUpdate,
  prepareCaptureEvidence,
  prepareCaptureUpdate,
} from "../../platform/capture-update-api";
import type {
  CaptureUnderstandingInput,
  WebCaptureUnderstanding,
} from "../../platform/capture-understanding-contracts";
import { ReviewConfirmation } from "../review/review-confirmation";
import styles from "./capture-dialog.module.css";

// JSX-only references are removed before the repository's base unused-variable rule runs.
// eslint-disable-next-line no-unused-vars
const ReviewConfirmationView = ReviewConfirmation;

type SourceType = "text" | "link" | "code" | "file" | "image";
type Source = CaptureUnderstandingInput["sources"][number] &
  Readonly<{ file?: File; transcript?: string; voiceSessionId?: string }>;

export function CaptureDialog({
  catalog,
  disabled = false,
  loadContext,
  locale,
  onSaved,
  prepareEvidence = prepareCaptureEvidence,
  prepareUpdate = prepareCaptureUpdate,
  answerUpdate = answerCaptureUpdate,
  save,
  stageUpdateFile = stageCaptureUpdateFile,
  understand = understandCapture,
  voiceFetcher,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  disabled?: boolean;
  loadContext?: () => Promise<
    import("../../platform/updates-evidence-contracts").UpdateComposerContext
  >;
  locale: "ar" | "en";
  onSaved: () => void;
  answerUpdate?: typeof answerCaptureUpdate;
  prepareUpdate?: (input: {
    idempotencyKey: string;
    projectId: string;
    workItemId: string | null;
    rawText: string;
    sources?: import("../../platform/updates-evidence-contracts").UpdateSourceInput[];
  }) => Promise<import("../../platform/capture-update-api").CapturePreparedUpdate>;
  prepareEvidence?: typeof prepareCaptureEvidence;
  save: (
    input: Readonly<{ sourceType: SourceType; text: string; sourceUploadId: string | null }>,
  ) => Promise<void>;
  stageUpdateFile?: typeof stageCaptureUpdateFile;
  understand?: (input: CaptureUnderstandingInput) => Promise<WebCaptureUnderstanding>;
  voiceFetcher?: import("react").ComponentProps<typeof VoiceCapture>["fetcher"];
}>) {
  const [text, setText] = useState("");
  const [sources, setSources] = useState<readonly Source[]>([]);
  const [understanding, setUnderstanding] = useState<WebCaptureUnderstanding | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [review, setReview] = useState<Awaited<ReturnType<typeof reviewDraft>> | null>(null);
  const [preparedUpdate, setPreparedUpdate] = useState<
    import("../../platform/capture-update-api").CapturePreparedUpdate | null
  >(null);
  const [preparedSources, setPreparedSources] = useState<
    readonly import("../../platform/updates-evidence-contracts").UpdateSourceInput[]
  >([]);
  const [updateIdempotencyKey] = useState(() => crypto.randomUUID());
  const [evidenceIdempotencyKey] = useState(() => crypto.randomUUID());
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [context, setContext] = useState<
    import("../../platform/updates-evidence-contracts").UpdateComposerContext | null
  >(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  if (disabled) return null;

  const resetInterpretation = () => {
    setUnderstanding(null);
    setAnswer("");
    setError(false);
  };
  const addFile = (kind: Source["kind"], file: File | undefined) => {
    if (file === undefined) return;
    setSources((current) => [...current, { kind, label: file.name, file }]);
    resetInterpretation();
  };
  const runUnderstanding = async () => {
    setBusy(true);
    setError(false);
    try {
      const authorized = await authorizedUpdateContext();
      const interpreted = await understand({
        locale,
        rawText: text.trim(),
        sources: inferredSources(text, sources),
      });
      setUnderstanding(constrainUnderstanding(interpreted, authorized, selectedProjectId));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const authorizedUpdateContext = async () => {
    if (context !== null || loadContext === undefined) return context;
    const loaded = await loadContext();
    setContext(loaded);
    if (loaded.projects.length === 1) setSelectedProjectId(loaded.projects[0]!.id);
    return loaded;
  };
  const toggleVoice = async () => {
    if (voiceOpen) {
      setVoiceOpen(false);
      return;
    }
    setBusy(true);
    setError(false);
    try {
      await authorizedUpdateContext();
      setVoiceOpen(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const savePrivate = async () => {
    setBusy(true);
    setError(false);
    try {
      const upload = sources.find(
        (source) =>
          (source.kind === "file" || source.kind === "image") && source.file !== undefined,
      );
      const sourceUploadId = upload?.file === undefined ? null : await stageFile(upload.file);
      await save({
        sourceType: privateSourceType(text, upload),
        text: text.trim() || sources.map(({ label }) => label).join(", "),
        sourceUploadId,
      });
      setText("");
      setSources([]);
      setUnderstanding(null);
      setAnswer("");
      onSaved();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const continueToReview = async () => {
    if (understanding?.likelyProject === null || understanding === null) {
      setError(true);
      return;
    }
    setBusy(true);
    setError(false);
    try {
      const stagedSources = await Promise.all(
        sources
          .filter(
            (source): source is Source & Readonly<{ kind: "file" | "image"; file: File }> =>
              (source.kind === "file" || source.kind === "image") && source.file !== undefined,
          )
          .map((source) =>
            stageUpdateFile(source.file, {
              projectId: understanding.likelyProject!.id,
              workstreamId: null,
            }),
          ),
      );
      const voiceSources = sources.flatMap((source) =>
        source.kind === "voice" && source.voiceSessionId !== undefined
          ? [{ kind: "voice_transcript" as const, voiceSessionId: source.voiceSessionId }]
          : [],
      );
      const updateSources = [...textUpdateSources(text), ...voiceSources, ...stagedSources];
      setPreparedSources(updateSources);
      const updateInput = {
        idempotencyKey: updateIdempotencyKey,
        projectId: understanding.likelyProject.id,
        workItemId: understanding.relatedWorkItemId,
        rawText: text.trim(),
      };
      const prepared = await prepareUpdate(
        updateSources.length === 0 ? updateInput : { ...updateInput, sources: updateSources },
      );
      setPreparedUpdate(prepared);
      if (prepared.state === "draft_with_question") {
        return;
      }
      setReview(
        await reviewDraft(
          understanding,
          prepared,
          text.trim(),
          sources,
          catalog,
          updateSources,
          evidenceIdempotencyKey,
          prepareEvidence,
        ),
      );
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const answerUpdateQuestion = async () => {
    if (preparedUpdate?.state !== "draft_with_question" || answer.trim() === "") return;
    setBusy(true);
    setError(false);
    try {
      const prepared = await answerUpdate({
        answer: answer.trim(),
        sessionId: preparedUpdate.sessionId,
        sessionVersion: preparedUpdate.sessionVersion,
        turnId: preparedUpdate.turnId,
      });
      setPreparedUpdate(prepared);
      setAnswer("");
      if (prepared.state === "ready_for_review" && understanding !== null) {
        setReview(
          await reviewDraft(
            understanding,
            prepared,
            text.trim(),
            sources,
            catalog,
            preparedSources,
            evidenceIdempotencyKey,
            prepareEvidence,
          ),
        );
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return createElement(FocusedDialog, {
    closeLabel: catalog["actions.close"],
    layout: "workspace",
    title: catalog[review === null ? "capture.title" : "review.title"],
    trigger: createElement(ActionButton, {
      "aria-label": catalog["shell.global.capture"],
      children: catalog["shell.global.capture"],
      variant: "primary",
    }),
    children:
      review === null ? (
        <div className={styles.workspace!} dir={locale === "ar" ? "rtl" : "ltr"}>
          <header className={styles.intro!}>
            <p>{catalog["capture.subtitle"]}</p>
            <ol aria-label={catalog["capture.title"]} className={styles.steps!}>
              <li className={styles.activeStep!}>1&nbsp; {catalog["capture.step.capture"]}</li>
              <li className={understanding === null ? "" : styles.activeStep!}>
                2&nbsp; {catalog["capture.step.clarify"]}
              </li>
              <li>3&nbsp; {catalog["capture.step.review"]}</li>
            </ol>
          </header>

          <section className={styles.composer!}>
            <label className={styles.srOnly!} htmlFor="capture-composer">
              {catalog["capture.composerLabel"]}
            </label>
            <textarea
              aria-label={catalog["capture.composerLabel"]}
              id="capture-composer"
              maxLength={8_000}
              onChange={(event) => {
                setText(event.target.value);
                resetInterpretation();
              }}
              placeholder={catalog["capture.composerPlaceholder"]}
              value={text}
            />
            {sources.length > 0 ? (
              <ul className={styles.sources!}>
                {sources.map((source, index) => (
                  <li key={`${source.kind}-${source.label}-${index}`}>
                    {createElement(ProductIcon, {
                      name:
                        source.kind === "voice"
                          ? "microphone"
                          : source.kind === "file"
                            ? "paperclip"
                            : source.kind,
                      size: "small",
                    })}
                    <span>{source.label}</span>
                    <button
                      aria-label={catalog["capture.removeSource"].replace("{source}", source.label)}
                      onClick={() => {
                        setSources((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        );
                        resetInterpretation();
                      }}
                      type="button"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className={styles.composerTools!}>
              <div className={styles.sourceActions!}>
                <SourceButton
                  label={catalog["capture.addVoice"]}
                  name="microphone"
                  onClick={() => void toggleVoice()}
                />
                <SourceButton
                  label={catalog["capture.addLink"]}
                  name="link"
                  onClick={() =>
                    setText((current) => `${current}${current === "" ? "" : "\n"}https://`)
                  }
                />
                <SourceButton
                  label={catalog["capture.addImage"]}
                  name="image"
                  onClick={() => imageInput.current?.click()}
                />
                <SourceButton
                  label={catalog["capture.addCode"]}
                  name="code"
                  onClick={() =>
                    setText((current) => `${current}${current === "" ? "" : "\n"}\`\`\`\n\n\`\`\``)
                  }
                />
                <SourceButton
                  label={catalog["capture.addFile"]}
                  name="paperclip"
                  onClick={() => fileInput.current?.click()}
                />
              </div>
              <span>
                {catalog["capture.characterCount"].replace("{count}", String(text.length))}
              </span>
            </div>
            <input
              accept="image/png,image/jpeg,image/webp"
              className={styles.srOnly!}
              onChange={(event) => addFile("image", event.target.files?.[0])}
              ref={imageInput}
              type="file"
            />
            <input
              accept=".md,.txt,.docx,.pdf"
              className={styles.srOnly!}
              onChange={(event) => addFile("file", event.target.files?.[0])}
              ref={fileInput}
              type="file"
            />
          </section>

          {voiceOpen && context !== null && context.projects.length > 1 ? (
            <label className={styles.projectContext!}>
              <span>{catalog["capture.projectForUpdate"]}</span>
              <select
                aria-label={catalog["capture.projectForUpdate"]}
                onChange={(event) => {
                  setSelectedProjectId(event.target.value);
                  resetInterpretation();
                }}
                value={selectedProjectId}
              >
                <option value="">{catalog["capture.chooseProject"]}</option>
                {context.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {voiceOpen && resolvedProject(understanding, context, selectedProjectId) !== null
            ? createElement(VoiceCapture, {
                catalog,
                scope: {
                  projectId: resolvedProject(understanding, context, selectedProjectId)!.id,
                  workstreamId: null,
                  workItemId: understanding?.relatedWorkItemId ?? null,
                },
                onConfirmed: (source) => {
                  setSources((current) => [
                    ...current.filter((item) => item.kind !== "voice"),
                    {
                      kind: "voice",
                      label: catalog["voice.title"],
                      transcript: source.transcript,
                      voiceSessionId: source.voiceSessionId,
                    },
                  ]);
                },
                ...(voiceFetcher === undefined ? {} : { fetcher: voiceFetcher }),
              })
            : null}

          {busy && understanding === null ? (
            <p aria-live="polite" className={styles.loading!}>
              {catalog["capture.understanding"]}
            </p>
          ) : null}
          {understanding === null ? null : (
            <UnderstandingPanel catalog={catalog} understanding={understanding} />
          )}
          {understanding?.clarification === null ||
          understanding === null ||
          preparedUpdate !== null ? null : (
            <section className={styles.clarification!}>
              <h3>
                {createElement(ProductIcon, { name: "sparkles", size: "small" })}
                {catalog["capture.clarification"]}
              </h3>
              <p>{understanding.clarification.question}</p>
              <label className={styles.srOnly!} htmlFor="capture-answer">
                {catalog["capture.answer"]}
              </label>
              <textarea
                id="capture-answer"
                maxLength={1_000}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder={catalog["capture.answer"]}
                value={answer}
              />
              <button
                className={styles.secondaryAction!}
                onClick={() => setAnswer("")}
                type="button"
              >
                {catalog["capture.notYet"]}
              </button>
            </section>
          )}
          {preparedUpdate?.state !== "draft_with_question" ? null : (
            <section className={styles.clarification!}>
              <h3>{catalog["capture.clarification"]}</h3>
              <p>{preparedUpdate.question}</p>
              <label className={styles.srOnly!} htmlFor="capture-update-answer">
                {catalog["capture.answer"]}
              </label>
              <textarea
                id="capture-update-answer"
                maxLength={20_000}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder={catalog["capture.answer"]}
                value={answer}
              />
            </section>
          )}
          <p className={styles.privateNotice!}>
            {createElement(ProductIcon, { name: "shield", size: "small" })}
            {catalog["capture.noRecord"]}
          </p>
          {error ? (
            <p className={styles.recovery!} role="alert">
              {catalog["capture.recovery"]}
            </p>
          ) : null}
          <footer className={styles.footer!}>
            <button
              className={styles.secondaryAction!}
              disabled={
                busy ||
                (text.trim() === "" && sources.length === 0) ||
                (preparedUpdate?.state === "draft_with_question" && answer.trim() === "")
              }
              onClick={() => void savePrivate()}
              type="button"
            >
              {catalog["capture.savePrivate"]}
            </button>
            <button
              className={styles.primaryAction!}
              disabled={busy || (text.trim() === "" && sources.length === 0)}
              onClick={() => {
                if (understanding === null) void runUnderstanding();
                else if (preparedUpdate?.state === "draft_with_question") {
                  void answerUpdateQuestion();
                } else void continueToReview();
              }}
              type="button"
            >
              {understanding === null
                ? catalog["capture.understand"]
                : catalog["capture.continueReview"]}
            </button>
          </footer>
        </div>
      ) : (
        <ReviewConfirmationView catalog={catalog} draft={review} onBack={() => setReview(null)} />
      ),
  });
}

function resolvedProject(
  understanding: WebCaptureUnderstanding | null,
  context: import("../../platform/updates-evidence-contracts").UpdateComposerContext | null,
  selectedProjectId: string,
) {
  const selected = context?.projects.find((project) => project.id === selectedProjectId) ?? null;
  return selected ?? understanding?.likelyProject ?? null;
}

function constrainUnderstanding(
  understanding: WebCaptureUnderstanding,
  context: import("../../platform/updates-evidence-contracts").UpdateComposerContext | null,
  selectedProjectId: string,
): WebCaptureUnderstanding {
  if (context === null) return understanding;
  const selected =
    context.projects.find((project) => project.id === selectedProjectId) ??
    (context.projects.length === 1 ? context.projects[0]! : null);
  const inferred = context.projects.find(
    (project) => project.id === understanding.likelyProject?.id,
  );
  const project = selected ?? inferred ?? null;
  if (project === null) {
    return {
      ...understanding,
      likelyProject: null,
      relatedComponentId: null,
      relatedWorkItemId: null,
      relatedWorkItemTitle: null,
      confidence: "uncertain",
    };
  }
  const workItem = project.workItems.find((item) => item.id === understanding.relatedWorkItemId);
  const changedProject = understanding.likelyProject?.id !== project.id;
  return {
    ...understanding,
    likelyProject: {
      confidence:
        selected === null ? (understanding.likelyProject?.confidence ?? "uncertain") : "high",
      id: project.id,
      name: project.name,
    },
    relatedComponentId: changedProject ? null : understanding.relatedComponentId,
    relatedWorkItemId: workItem?.id ?? null,
    relatedWorkItemTitle: workItem?.title ?? null,
  };
}

async function reviewDraft(
  understanding: WebCaptureUnderstanding,
  prepared: Extract<
    import("../../platform/capture-update-api").CapturePreparedUpdate,
    { state: "ready_for_review" }
  >,
  rawText: string,
  captureSources: readonly Source[],
  catalog: import("@evaluation/localization").Catalog,
  updateSources: readonly import("../../platform/updates-evidence-contracts").UpdateSourceInput[],
  evidenceIdempotencyKey: string,
  prepareEvidence: typeof prepareCaptureEvidence,
) {
  const sourceRefs = reviewSourceRefs(rawText, captureSources, catalog);
  const evidence = await Promise.all(
    (prepared.draft.evidenceClaimDrafts ?? []).slice(0, 1).map(async (supportedClaim) => {
      const draft = await prepareEvidence({
        idempotencyKey: evidenceIdempotencyKey,
        projectId: understanding.likelyProject!.id,
        workItemId: understanding.relatedWorkItemId,
        updateSourceId: updateSourceId(prepared.draft.sourceReferences),
        source: evidenceSource(rawText, captureSources, updateSources),
        supportedClaim,
        contributionContext: prepared.draft.contributionContext,
      });
      return {
        draftId: draft.id,
        expectedRevision: draft.revision,
        selected: false,
        employeeEditRequired: true,
        employeeEdited: false,
        supportedClaim: draft.supportedClaim,
        contributionContext: draft.contributionContext,
        sourceRefs,
      };
    }),
  );
  return {
    schemaVersion: "review-confirmation-draft.v1" as const,
    captureId: crypto.randomUUID(),
    project: understanding.likelyProject ?? { id: crypto.randomUUID(), name: "Project to confirm" },
    workItem:
      understanding.relatedWorkItemId === null
        ? null
        : {
            id: understanding.relatedWorkItemId,
            title: understanding.relatedWorkItemTitle ?? "Related Work Item",
          },
    update: {
      sessionId: prepared.sessionId,
      expectedVersion: prepared.draft.revision,
      editable: true as const,
      selected: true,
      summary: prepared.draft.summary,
      result: prepared.draft.result,
      nextAction: prepared.draft.nextAction,
      sourceRefs,
    },
    evidence,
    progressProposal:
      understanding.relatedComponentId === null
        ? null
        : {
            componentId: understanding.relatedComponentId,
            selected: false,
            proposedValue: "Measurement observed",
            rationale: "Requires the approved rule and owner confirmation.",
            mutatesOfficialProgress: false as const,
            requiresOwnerConfirmation: true,
            sourceRefs,
          },
    uncertainty: "No additional uncertainty was identified.",
    afterConfirmation: [
      "Append the selected Update to the Timeline.",
      "Confirm Evidence only when selected and employee-edited.",
      "Official Project progress remains unchanged unless its owner confirms the approved measurable rule.",
    ],
  };
}

function reviewSourceRefs(
  rawText: string,
  sources: readonly Source[],
  catalog: import("@evaluation/localization").Catalog,
) {
  const captured = sources.map((source) => ({
    kind: "manual_capture" as const,
    label: source.label,
    observedAt: null,
    freshness: "fresh" as const,
  }));
  const links = [...rawText.matchAll(/https?:\/\/[^\s)\],;!?]+/gu)].map((match) => ({
    kind: match[0].startsWith("https://github.com/")
      ? ("github" as const)
      : ("manual_capture" as const),
    label: match[0],
    observedAt: null,
    freshness: "fresh" as const,
  }));
  const combined = [...captured, ...links];
  return combined.length > 0
    ? combined.slice(0, 20)
    : [
        {
          kind: "manual_capture" as const,
          label: catalog["review.source.writtenUpdate"],
          observedAt: null,
          freshness: "fresh" as const,
        },
      ];
}

function updateSourceId(sourceReferences: readonly string[]) {
  const reference = sourceReferences.find((value) => value.startsWith("update-source:"));
  if (reference === undefined) throw new Error("CAPTURE_UPDATE_SOURCE_MISSING");
  return reference.slice("update-source:".length);
}

function evidenceSource(
  rawText: string,
  captureSources: readonly Source[],
  updateSources: readonly import("../../platform/updates-evidence-contracts").UpdateSourceInput[],
) {
  const uploaded = updateSources.find(
    (
      source,
    ): source is Readonly<{
      kind: "document" | "file" | "image" | "screenshot";
      uploadedSourceId: string;
    }> =>
      source.kind === "image" ||
      source.kind === "screenshot" ||
      source.kind === "file" ||
      source.kind === "document",
  );
  if (uploaded !== undefined) return uploaded;
  const url = rawText.match(/https?:\/\/\S+/u)?.[0].replace(/[),.;!?]+$/u, "");
  if (url !== undefined) return { kind: "url" as const, url };
  const code = updateSources.find((source) => source.kind === "pasted_code");
  if (code !== undefined && "text" in code) {
    return { kind: "pasted_code" as const, text: code.text };
  }
  const voice = captureSources.find(
    (source) => source.kind === "voice" && source.transcript !== undefined,
  );
  return {
    kind: "pasted_text" as const,
    text: voice?.transcript ?? rawText,
  };
}

// JSX-only references are removed before the repository's base unused-variable rule runs.
// eslint-disable-next-line no-unused-vars
function SourceButton({
  label,
  name,
  onClick,
}: Readonly<{
  label: string;
  name: import("@evaluation/ui").ProductIconName;
  onClick: () => void;
}>) {
  return (
    <button aria-label={label} onClick={onClick} title={label} type="button">
      {createElement(ProductIcon, { name, size: "medium" })}
    </button>
  );
}

// JSX-only references are removed before the repository's base unused-variable rule runs.
// eslint-disable-next-line no-unused-vars
function UnderstandingPanel({
  catalog,
  understanding,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  understanding: WebCaptureUnderstanding;
}>) {
  return (
    <section className={styles.understanding!}>
      <h3>{catalog["capture.understoodTitle"]}</h3>
      <dl>
        <div>
          <dt>{catalog["capture.likelyProject"]}</dt>
          <dd>
            <strong>
              {understanding.likelyProject?.name ?? catalog["capture.confidence.uncertain"]}
            </strong>
            <span>{catalog[`capture.confidence.${understanding.confidence}`]}</span>
          </dd>
        </div>
        <div>
          <dt>{catalog["capture.likelyMeaning"]}</dt>
          <dd>{catalog[`capture.meaning.${understanding.likelyMeaning}`]}</dd>
        </div>
        <div>
          <dt>{catalog["capture.relatedWork"]}</dt>
          <dd>
            {
              catalog[
                understanding.relatedWorkItemId === null
                  ? "capture.relatedWorkNone"
                  : "capture.relatedWorkFound"
              ]
            }
          </dd>
        </div>
        <div>
          <dt>{catalog["capture.kpiSignal"]}</dt>
          <dd>{catalog["capture.kpiMissing"]}</dd>
        </div>
        <div>
          <dt>{catalog["capture.privacy"]}</dt>
          <dd>{catalog["capture.privateDraft"]}</dd>
        </div>
      </dl>
    </section>
  );
}

function inferredSources(text: string, sources: readonly Source[]) {
  const inferred: Source[] = [];
  if (/https?:\/\//u.test(text))
    inferred.push({ kind: "link", label: text.match(/https?:\/\/\S+/u)?.[0] ?? "Link" });
  if (/```/u.test(text)) inferred.push({ kind: "code", label: "Pasted code" });
  return [...sources.map(({ kind, label }) => ({ kind, label })), ...inferred].slice(0, 20);
}

function textUpdateSources(
  text: string,
): import("../../platform/updates-evidence-contracts").UpdateSourceInput[] {
  const urls = [...text.matchAll(/https?:\/\/[^\s)\],;!?]+/gu)].map(
    (match) => ({ kind: "url", url: match[0] }) as const,
  );
  const code = [...text.matchAll(/```(?:[^\n]*)\n([\s\S]*?)```/gu)]
    .map((match) => match[1]?.trim() ?? "")
    .filter((value) => value !== "")
    .map((value) => ({ kind: "pasted_code", text: value }) as const);
  return [...urls, ...code].slice(0, 20);
}

function privateSourceType(text: string, upload: Source | undefined): SourceType {
  if (upload?.kind === "file" || upload?.kind === "image") return upload.kind;
  if (/https?:\/\//u.test(text)) return "link";
  if (/```/u.test(text)) return "code";
  return "text";
}

async function stageFile(file: File): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch("/api/capture/uploads", { body: form, method: "POST" });
  if (!response.ok) throw new Error("private capture file staging failed");
  const value = await response.json();
  if (typeof value !== "object" || value === null || typeof value.id !== "string")
    throw new Error("private capture file staging failed");
  return value.id;
}
