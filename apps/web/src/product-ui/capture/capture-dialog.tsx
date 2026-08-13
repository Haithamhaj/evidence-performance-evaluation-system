"use client";

import { ActionButton, FocusedDialog, ProductIcon } from "@evaluation/ui";
import { createElement, useRef, useState } from "react";

import { understandCapture } from "../../platform/capture-understanding-api";
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
type Source = CaptureUnderstandingInput["sources"][number] & Readonly<{ file?: File }>;

export function CaptureDialog({
  catalog,
  disabled = false,
  locale,
  onSaved,
  save,
  understand = understandCapture,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  disabled?: boolean;
  locale: "ar" | "en";
  onSaved: () => void;
  save: (
    input: Readonly<{ sourceType: SourceType; text: string; sourceUploadId: string | null }>,
  ) => Promise<void>;
  understand?: (input: CaptureUnderstandingInput) => Promise<WebCaptureUnderstanding>;
}>) {
  const [text, setText] = useState("");
  const [sources, setSources] = useState<readonly Source[]>([]);
  const [understanding, setUnderstanding] = useState<WebCaptureUnderstanding | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [review, setReview] = useState<ReturnType<typeof reviewDraft> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const voiceInput = useRef<HTMLInputElement>(null);
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
      setUnderstanding(
        await understand({
          locale,
          rawText: text.trim(),
          sources: inferredSources(text, sources),
        }),
      );
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

  return createElement(FocusedDialog, {
    closeLabel: catalog["actions.close"],
    layout: "workspace",
    title: catalog["capture.title"],
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
                  onClick={() => voiceInput.current?.click()}
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
              accept="audio/*"
              className={styles.srOnly!}
              onChange={(event) => addFile("voice", event.target.files?.[0])}
              ref={voiceInput}
              type="file"
            />
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

          {busy && understanding === null ? (
            <p aria-live="polite" className={styles.loading!}>
              {catalog["capture.understanding"]}
            </p>
          ) : null}
          {understanding === null ? null : (
            <UnderstandingPanel catalog={catalog} understanding={understanding} />
          )}
          {understanding?.clarification === null || understanding === null ? null : (
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
              disabled={busy || (text.trim() === "" && sources.length === 0)}
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
                else setReview(reviewDraft(text, understanding));
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

function reviewDraft(rawText: string, understanding: WebCaptureUnderstanding) {
  const sourceRefs =
    understanding.sourceRefs.length > 0
      ? understanding.sourceRefs
      : [
          {
            kind: "manual_capture" as const,
            label: "Employee capture",
            observedAt: new Date().toISOString(),
            freshness: "fresh" as const,
          },
        ];
  const summary =
    rawText
      .split("\n")
      .find((line) => line.trim() !== "")
      ?.slice(0, 120) ?? "Project update";
  return {
    schemaVersion: "review-confirmation-draft.v1" as const,
    captureId: crypto.randomUUID(),
    project: understanding.likelyProject ?? { id: crypto.randomUUID(), name: "Project to confirm" },
    workItem:
      understanding.relatedWorkItemId === null
        ? null
        : { id: understanding.relatedWorkItemId, title: "Validate streaming fallback" },
    update: {
      sessionId: "e5555555-5555-4555-8555-555555555555",
      expectedVersion: 3,
      editable: true as const,
      selected: true,
      summary,
      result: rawText.slice(0, 1_000),
      nextAction: "Verify the remaining measurement source.",
      sourceRefs,
    },
    evidence: [
      {
        draftId: "ea111111-1111-4111-8111-111111111111",
        expectedRevision: 1,
        selected: false,
        employeeEditRequired: understanding.likelyMeaning === "suggested_evidence",
        employeeEdited: false,
        supportedClaim: "Authentication fallback works in staging.",
        contributionContext: "Review and describe your contribution.",
        sourceRefs,
      },
    ],
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
    uncertainty:
      understanding.clarification?.question ?? "No additional uncertainty was identified.",
    afterConfirmation: [
      "Append the selected Update to the Timeline.",
      "Create Evidence only when selected and employee-edited.",
      "Official Project progress remains unchanged unless its owner confirms the approved measurable rule.",
    ],
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
