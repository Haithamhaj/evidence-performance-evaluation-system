"use client";

import type { Catalog } from "@evaluation/localization";
import { createElement, useRef, useState, type ReactNode } from "react";

import type {
  UpdateComposerContext,
  UpdateResultCard as UpdateResult,
} from "../../../platform/updates-evidence-contracts";
import { UpdateResultCard } from "./update-result-card";
import type { StoredUpdateSource } from "./update-draft-storage";
import { UniversalCapture } from "./universal-capture";
import { UpdateDraftSheet } from "./update-draft-sheet";

export type UpdateSelection = Readonly<{
  projectId: string;
  workstreamId: string | null;
  workItemId: string | null;
}>;

export type ReviewViewDraft = Readonly<{
  summary: string;
  result: string;
  blocker: string | null;
  nextAction: string;
  contributionContext: string;
  documentationNeeds: readonly string[];
  comparison: Readonly<{ explanation: string }>;
}>;

export type UpdateComposerViewStage =
  | Readonly<{
      kind: "entry";
      context: UpdateComposerContext;
      selection: UpdateSelection;
      rawText: string;
      sources: readonly StoredUpdateSource[];
    }>
  | Readonly<{
      kind: "draft_with_question";
      context: UpdateComposerContext;
      selection: UpdateSelection;
      draft: ReviewViewDraft;
      question: string;
      remainingFieldCount: number;
    }>
  | Readonly<{
      kind: "review";
      context: UpdateComposerContext;
      selection: UpdateSelection;
      draft: ReviewViewDraft;
      saved: boolean;
      evidenceCount: number;
    }>
  | Readonly<{ kind: "complete"; result: UpdateResult }>;

type Properties = Readonly<{
  catalog: Catalog;
  stage: UpdateComposerViewStage;
  timeline?: ReactNode;
  busy?: boolean;
  errorKey?: keyof Catalog | null;
  onClose?: () => void;
  onEntrySubmit?: (event: import("react").FormEvent<HTMLFormElement>) => void;
  onQuestionSubmit?: (event: import("react").FormEvent<HTMLFormElement>) => void;
  onReviewSubmit?: (event: import("react").FormEvent<HTMLFormElement>) => void;
  onAddEvidence?: () => void;
  onConfirm?: () => void;
  onNew?: () => void;
  onRawTextChange?: (value: string) => void;
  onSourcesChange?: (form: FormData) => void;
  onVoiceConfirmed?: (
    source: Readonly<{ kind: "voice_transcript"; voiceSessionId: string }>,
  ) => void;
  locale?: import("@evaluation/localization").Locale;
}>;

export function UpdateComposerView({
  busy = false,
  catalog,
  errorKey = null,
  locale = "en",
  onAddEvidence,
  onClose,
  onConfirm,
  onEntrySubmit,
  onNew,
  onQuestionSubmit,
  onRawTextChange,
  onSourcesChange,
  onVoiceConfirmed,
  onReviewSubmit,
  stage,
  timeline,
}: Properties) {
  const dialogRef = useRef<HTMLElement>(null);
  return (
    <div className="drawerBackdrop updateComposerBackdrop">
      <aside
        aria-labelledby="update-composer-title"
        aria-modal="true"
        className="workItemDrawer updateComposer"
        onKeyDown={(event) => keepDialogFocus(event, dialogRef.current)}
        ref={dialogRef}
        role="dialog"
      >
        <header className="drawerHeader">
          <div>
            <p className="eyebrow">{catalog["updates.dailyWork"]}</p>
            <h2 id="update-composer-title">{catalog["updates.title"]}</h2>
          </div>
          <button autoFocus className="quietButton" onClick={onClose} type="button">
            {catalog["actions.close"]}
          </button>
        </header>
        {errorKey === null ? null : (
          <p className="formError" role="alert">
            {catalog[errorKey]}
          </p>
        )}
        {stage.kind === "entry" ? (
          <EntryForm
            busy={busy}
            catalog={catalog}
            key={`${stage.selection.projectId}:${stage.selection.workstreamId ?? ""}:${stage.selection.workItemId ?? ""}`}
            onRawTextChange={onRawTextChange}
            onSourcesChange={onSourcesChange}
            onVoiceConfirmed={onVoiceConfirmed}
            onSubmit={onEntrySubmit}
            stage={stage}
          />
        ) : stage.kind === "draft_with_question" ? (
          <ClarificationForm
            busy={busy}
            catalog={catalog}
            onSubmit={onQuestionSubmit}
            stage={stage}
          />
        ) : stage.kind === "review" ? (
          <ReviewForm
            busy={busy}
            catalog={catalog}
            onAddEvidence={onAddEvidence}
            onConfirm={onConfirm}
            onSubmit={onReviewSubmit}
            stage={stage}
          />
        ) : (
          <>
            {createElement(UpdateResultCard, { catalog, locale, result: stage.result })}
            <button className="primaryAction" onClick={onNew} type="button">
              {catalog["updates.new"]}
            </button>
          </>
        )}
        {timeline}
      </aside>
    </div>
  );
}

function keepDialogFocus(
  event: import("react").KeyboardEvent<HTMLElement>,
  dialog: HTMLElement | null,
) {
  if (event.key !== "Tab" || dialog === null) return;
  const focusable = [
    ...dialog.querySelectorAll<HTMLElement>(
      "button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), a[href]",
    ),
  ];
  const first = focusable[0];
  const last = focusable.at(-1);
  if (first === undefined || last === undefined) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function EntryForm({
  busy,
  catalog,
  onRawTextChange,
  onSourcesChange,
  onVoiceConfirmed,
  onSubmit,
  stage,
}: Readonly<{
  busy: boolean;
  catalog: Catalog;
  onRawTextChange: Properties["onRawTextChange"];
  onSourcesChange: Properties["onSourcesChange"];
  onVoiceConfirmed: Properties["onVoiceConfirmed"];
  onSubmit: Properties["onEntrySubmit"];
  stage: Extract<UpdateComposerViewStage, { kind: "entry" }>;
}>) {
  const firstProject = stage.context.projects[0];
  const initialProjectId = stage.context.projects.some(
    (project) => project.id === stage.selection.projectId,
  )
    ? stage.selection.projectId
    : (firstProject?.id ?? "");
  const [projectId, setProjectId] = useState(initialProjectId);
  const [workstreamId, setWorkstreamId] = useState(stage.selection.workstreamId ?? "");
  const [workItemId, setWorkItemId] = useState(stage.selection.workItemId ?? "");
  const project = stage.context.projects.find((candidate) => candidate.id === projectId);
  const workItems =
    project?.workItems.filter(
      (item) => workstreamId === "" || item.workstreamId === workstreamId,
    ) ?? [];

  return (
    <form className="composerForm" onSubmit={onSubmit}>
      <p>{catalog["updates.intro"]}</p>
      <div className="composerScopeGrid">
        <label>
          <span>{catalog["updates.project"]}</span>
          <select
            name="projectId"
            onChange={(event) => {
              setProjectId(event.currentTarget.value);
              setWorkstreamId("");
              setWorkItemId("");
            }}
            required
            value={projectId}
          >
            {stage.context.projects.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{catalog["updates.workstream"]}</span>
          <select
            name="workstreamId"
            onChange={(event) => {
              setWorkstreamId(event.currentTarget.value);
              setWorkItemId("");
            }}
            value={workstreamId}
          >
            <option value="">{catalog["updates.noneOptional"]}</option>
            {(project?.workstreams ?? []).map((workstream) => (
              <option key={workstream.id} value={workstream.id}>
                {workstream.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{catalog["updates.workItem"]}</span>
          <select
            name="workItemId"
            onChange={(event) => {
              const nextId = event.currentTarget.value;
              setWorkItemId(nextId);
              const item = project?.workItems.find((candidate) => candidate.id === nextId);
              if (item?.workstreamId) setWorkstreamId(item.workstreamId);
            }}
            value={workItemId}
          >
            <option value="">{catalog["updates.noneOptional"]}</option>
            {workItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {createElement(UniversalCapture, {
        catalog,
        sources: stage.sources,
        scope: stage.selection,
        ...(onVoiceConfirmed === undefined ? {} : { onVoiceConfirmed }),
        ...(onSourcesChange === undefined
          ? {}
          : {
              onSourcesChange: (
                event: import("react").ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
              ) => {
                const form = event.currentTarget.form;
                if (form !== null) onSourcesChange(new FormData(form));
              },
            }),
      })}
      <label>
        <span>{catalog["updates.rawText"]}</span>
        <textarea
          defaultValue={stage.rawText}
          dir="auto"
          name="rawText"
          onChange={(event) => onRawTextChange?.(event.currentTarget.value)}
          rows={7}
        />
      </label>
      <button
        className="primaryAction"
        disabled={busy || stage.context.projects.length === 0}
        name="intent"
        type="submit"
        value="update"
      >
        {catalog["updates.start"]}
      </button>
    </form>
  );
}

export function ClarificationForm({
  busy,
  catalog,
  onSubmit,
  stage,
}: Readonly<{
  busy: boolean;
  catalog: Catalog;
  onSubmit: Properties["onQuestionSubmit"];
  stage: Extract<UpdateComposerViewStage, { kind: "draft_with_question" }>;
}>) {
  return (
    <div className="draftClarificationLayout">
      {createElement(UpdateDraftSheet, { catalog, draft: stage.draft })}
      <form className="composerForm clarificationCard" onSubmit={onSubmit}>
        <p className="eyebrow">{catalog["updates.question"]}</p>
        <h3 dir="auto">{stage.question}</h3>
        <p className="boundaryNote">
          {catalog["updates.remaining"]}: {stage.remainingFieldCount}
        </p>
        <label>
          <span>{catalog["updates.answer"]}</span>
          <textarea autoFocus dir="auto" name="answer" required rows={5} />
        </label>
        <button className="primaryAction" disabled={busy} type="submit">
          {catalog["updates.answerContinue"]}
        </button>
      </form>
    </div>
  );
}

export function ReviewForm({
  busy,
  catalog,
  onAddEvidence,
  onConfirm,
  onSubmit,
  stage,
}: Readonly<{
  busy: boolean;
  catalog: Catalog;
  onAddEvidence: Properties["onAddEvidence"];
  onConfirm: Properties["onConfirm"];
  onSubmit: Properties["onReviewSubmit"];
  stage: Extract<UpdateComposerViewStage, { kind: "review" }>;
}>) {
  return (
    <form className="composerForm" onSubmit={onSubmit}>
      <h3>{catalog["updates.review"]}</h3>
      <label>
        <span>{catalog["updates.summary"]}</span>
        <textarea defaultValue={stage.draft.summary} dir="auto" name="summary" required />
      </label>
      <label>
        <span>{catalog["updates.result"]}</span>
        <textarea defaultValue={stage.draft.result} dir="auto" name="result" required rows={3} />
      </label>
      <label>
        <span>{catalog["updates.nextAction"]}</span>
        <textarea defaultValue={stage.draft.nextAction} dir="auto" name="nextAction" required />
      </label>
      <label>
        <span>{catalog["updates.blocker"]}</span>
        <textarea defaultValue={stage.draft.blocker ?? ""} dir="auto" name="blocker" />
      </label>
      <label>
        <span>{catalog["updates.contribution"]}</span>
        <textarea
          defaultValue={stage.draft.contributionContext}
          dir="auto"
          name="contributionContext"
          required
          rows={3}
        />
      </label>
      <DraftPreview catalog={catalog} draft={stage.draft} compact />
      <div className="formActions">
        <button className="secondaryAction" disabled={busy} type="submit">
          {catalog["updates.saveReview"]}
        </button>
        <button className="secondaryAction" onClick={onAddEvidence} type="button">
          {catalog["updates.addEvidence"]}
        </button>
      </div>
      <p className="boundaryNote">
        {catalog["updates.evidenceCount"]}: {stage.evidenceCount}
      </p>
      <p className="boundaryNote">{catalog["updates.confirmNote"]}</p>
      <button
        className="primaryAction"
        disabled={busy || !stage.saved}
        onClick={onConfirm}
        type="button"
      >
        {catalog["updates.confirm"]}
      </button>
    </form>
  );
}

export function DraftPreview({
  catalog,
  compact = false,
  draft,
}: Readonly<{ catalog: Catalog; compact?: boolean; draft: ReviewViewDraft }>) {
  return (
    <section className={`draftPreview${compact ? " compact" : ""}`}>
      <h3>{catalog["updates.currentDraft"]}</h3>
      <strong dir="auto">{draft.summary}</strong>
      <p dir="auto">{draft.result}</p>
      <p dir="auto">{draft.comparison.explanation}</p>
      {draft.documentationNeeds.length === 0 ? null : (
        <>
          <h4>{catalog["updates.documentationNeeds"]}</h4>
          <ul>
            {draft.documentationNeeds.map((need) => (
              <li dir="auto" key={need}>
                {need}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
