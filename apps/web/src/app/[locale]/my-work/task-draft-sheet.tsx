"use client";
import { localeMetadata, type Catalog, type Locale } from "@evaluation/localization";
import { useEffect, useRef, useState } from "react";
import type { ContextTaskDraft } from "../../../platform/context-intelligence-api";
import { createContextReviewDraftStorage } from "./context-review-draft-storage";
export type ConfirmableTaskDraft = Readonly<{
  title: string;
  description: string;
  projectHandle: string;
}>;
type Props = Readonly<{
  catalog: Catalog;
  locale: Locale;
  draft: ContextTaskDraft;
  projects: readonly { readonly handle: string; readonly name: string }[];
  busy?: boolean;
  error?: boolean;
  onClose?: () => void;
  onConfirm?: (value: ConfirmableTaskDraft) => void;
}>;
export function TaskDraftSheetView({
  catalog,
  locale,
  draft,
  projects,
  busy = false,
  error = false,
  onClose,
  onConfirm,
}: Props) {
  const [title, setTitle] = useState(draft.title),
    [description, setDescription] = useState(draft.description),
    [projectHandle, setProjectHandle] = useState(draft.projectHandle ?? ""),
    [restored, setRestored] = useState(false);
  const needsProject = draft.clarification.nextQuestion === "project" && !projectHandle;
  const needsAssignee = draft.clarification.nextQuestion === "assignee";
  useEffect(() => {
    const saved = createContextReviewDraftStorage(window.sessionStorage).load(draft.handle);
    if (saved) {
      setTitle(saved.title);
      setDescription(saved.description);
      setProjectHandle(saved.projectHandle);
    }
    setRestored(true);
  }, [draft.handle]);
  useEffect(() => {
    if (restored)
      createContextReviewDraftStorage(window.sessionStorage).save(draft.handle, {
        title,
        description,
        projectHandle,
      });
  }, [title, description, projectHandle, restored, draft.handle]);
  return (
    <div className="drawerBackdrop smartReviewBackdrop" dir={localeMetadata[locale].direction}>
      <aside
        aria-labelledby="context-task-draft-title"
        aria-modal="true"
        className="workItemDrawer smartReviewSheet"
        role="dialog"
      >
        <header className="drawerHeader">
          <div>
            <p className="aiDraftLabel">{catalog["contextReview.needsReview"]}</p>
            <h2 id="context-task-draft-title">{catalog["contextReview.taskDraftTitle"]}</h2>
          </div>
          <button autoFocus className="quietButton" onClick={onClose} type="button">
            {catalog["actions.close"]}
          </button>
        </header>
        <form
          className="smartReviewForm"
          onSubmit={(event) => {
            event.preventDefault();
            if (projectHandle) onConfirm?.({ title, description, projectHandle });
          }}
        >
          {needsProject || needsAssignee ? (
            <section className="focusedQuestion" aria-live="polite">
              <h3>{catalog["contextReview.focusedQuestion"]}</h3>
              <p>
                {needsProject
                  ? catalog["contextReview.question.project"]
                  : catalog["contextReview.question.assignee"]}
              </p>
              {needsProject ? (
                <label>
                  <span>{catalog["tasks.projectRequired"]}</span>
                  <select
                    disabled={busy}
                    value={projectHandle}
                    onChange={(event) => setProjectHandle(event.target.value)}
                  >
                    <option value="">{catalog["tasks.selectProject"]}</option>
                    {projects.map((project) => (
                      <option key={project.handle} value={project.handle}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p>{catalog["contextReview.assignToYou"]}</p>
              )}
            </section>
          ) : null}
          <section className="smartReviewShared">
            <h3>{catalog["contextReview.sharedPreview"]}</h3>
            <p>{catalog["contextReview.sharedPreviewHint"]}</p>
            <label>
              <span>{catalog["tasks.title"]}</span>
              <input
                disabled={busy}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              <span>{catalog["contextReview.description"]}</span>
              <textarea
                disabled={busy}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <details className="smartReviewSource">
              <summary>{catalog["contextReview.inspectSource"]}</summary>
              <strong dir="auto">{draft.source.title}</strong>
              {draft.source.summary === null ? null : <p dir="auto">{draft.source.summary}</p>}
            </details>
          </section>
          {error ? (
            <p className="formError" role="alert">
              {catalog["contextReview.recovery"]}
            </p>
          ) : null}
          <button className="primaryAction" disabled={busy || !projectHandle} type="submit">
            {catalog["contextReview.confirmTask"]}
          </button>
        </form>
      </aside>
    </div>
  );
}
export function TaskDraftSheet({
  catalog,
  draft,
  locale,
  onClose,
  onConfirm,
  projects,
}: Required<Pick<Props, "catalog" | "draft" | "locale" | "onClose" | "onConfirm" | "projects">>) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  return (
    <TaskDraftSheetView
      catalog={catalog}
      locale={locale}
      draft={draft}
      projects={projects}
      busy={busy}
      error={error}
      onClose={onClose}
      onConfirm={(value) =>
        void (async () => {
          setBusy(true);
          setError(false);
          try {
            await onConfirm(value);
            createContextReviewDraftStorage(window.sessionStorage).clear(draft.handle);
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        })()
      }
    />
  );
}
