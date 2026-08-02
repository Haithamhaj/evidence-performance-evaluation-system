"use client";

import { localeMetadata, type Catalog, type Locale } from "@evaluation/localization";
import { useEffect, useRef, useState } from "react";

import type { ContextTaskDraft } from "../../../platform/context-intelligence-api";
import type { ConnectedWorkContextItem } from "../../../platform/connected-work-context-api";
import type { ProjectOption } from "./connected-context";
import { createContextReviewDraftStorage } from "./context-review-draft-storage";

type ViewProperties = Readonly<{
  catalog: Catalog;
  locale: Locale;
  draft: ContextTaskDraft;
  projects: readonly ProjectOption[];
  source?: ConnectedWorkContextItem | undefined;
  busy?: boolean;
  error?: boolean;
  onClose?: () => void;
  onConfirm?: (value: ConfirmableTaskDraft) => void;
}>;

export type ConfirmableTaskDraft = Readonly<{
  title: string;
  description: string;
  projectId: string;
  workstreamId: string | null;
  assigneeId: string;
  dueAt: string | null;
  acceptanceConditions: readonly string[];
}>;

export function TaskDraftSheetView({
  busy = false,
  catalog,
  draft,
  error = false,
  locale,
  onClose,
  onConfirm,
  projects,
  source,
}: ViewProperties) {
  const [title, setTitle] = useState(draft.draft.title);
  const [description, setDescription] = useState(draft.draft.description);
  const [projectId, setProjectId] = useState(draft.draft.projectId ?? "");
  const [assigneeId, setAssigneeId] = useState(draft.draft.proposedAssigneeId ?? "");
  const [restored, setRestored] = useState(false);
  const hasProject = projectId !== "";
  const hasAssignee = assigneeId !== "";
  const requiredField = draft.clarification.nextQuestion?.field ?? null;
  const nextQuestion =
    requiredField === "projectId" && hasProject
      ? hasAssignee
        ? null
        : "assigneeId"
      : requiredField === "assigneeId" && hasAssignee
        ? null
        : requiredField;

  useEffect(() => {
    const saved = createContextReviewDraftStorage(window.sessionStorage).load(draft.id);
    if (saved !== null) {
      setTitle(saved.title);
      setDescription(saved.description);
      setProjectId(saved.projectId);
      setAssigneeId(saved.assigneeId);
    }
    setRestored(true);
  }, [draft.id]);

  useEffect(() => {
    if (!restored) return;
    createContextReviewDraftStorage(window.sessionStorage).save(draft.id, {
      title,
      description,
      projectId,
      assigneeId,
    });
  }, [assigneeId, description, draft.id, projectId, restored, title]);

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
          <button autoFocus className="quietButton" disabled={busy} onClick={onClose} type="button">
            {catalog["actions.close"]}
          </button>
        </header>
        <form
          className="smartReviewForm"
          onSubmit={(event) => {
            event.preventDefault();
            if (!hasProject || !hasAssignee) return;
            onConfirm?.({
              title,
              description,
              projectId,
              workstreamId: draft.draft.workstreamId,
              assigneeId,
              dueAt: draft.draft.dueAt,
              acceptanceConditions: draft.draft.acceptanceConditions,
            });
          }}
        >
          {nextQuestion === null ? null : (
            <section className="focusedQuestion" aria-live="polite">
              <h3>{catalog["contextReview.focusedQuestion"]}</h3>
              <p>
                {nextQuestion === "projectId"
                  ? catalog["contextReview.question.project"]
                  : catalog["contextReview.question.assignee"]}
              </p>
              {nextQuestion === "projectId" ? (
                <label>
                  <span>{catalog["tasks.projectRequired"]}</span>
                  <select
                    disabled={busy}
                    onChange={(event) => setProjectId(event.target.value)}
                    value={projectId}
                  >
                    <option value="">{catalog["tasks.selectProject"]}</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label>
                  <span>{catalog["contextReview.assignee"]}</span>
                  <select
                    disabled={busy}
                    onChange={(event) => setAssigneeId(event.target.value)}
                    value={assigneeId}
                  >
                    <option value="">{catalog["contextReview.selectAssignee"]}</option>
                    <option value={draft.employeeId}>{catalog["contextReview.assignToYou"]}</option>
                  </select>
                </label>
              )}
            </section>
          )}
          <section className="smartReviewShared">
            <h3>{catalog["contextReview.sharedPreview"]}</h3>
            <p>{catalog["contextReview.sharedPreviewHint"]}</p>
            <label>
              <span>{catalog["tasks.title"]}</span>
              <input
                disabled={busy}
                onChange={(event) => setTitle(event.target.value)}
                value={title}
              />
            </label>
            <label>
              <span>{catalog["contextReview.description"]}</span>
              <textarea
                disabled={busy}
                onChange={(event) => setDescription(event.target.value)}
                value={description}
              />
            </label>
            {source === undefined ? null : (
              <details className="smartReviewSource">
                <summary>{catalog["contextReview.inspectSource"]}</summary>
                <strong dir="auto">{source.title}</strong>
                {source.summary === null ? null : <p dir="auto">{source.summary}</p>}
              </details>
            )}
          </section>
          {draft.draft.uncertainties.length === 0 ? null : (
            <section className="drawerSection">
              <h3>{catalog["contextReview.uncertainties"]}</h3>
              <ul>
                {draft.draft.uncertainties.map((uncertainty) => (
                  <li key={uncertainty}>{uncertainty}</li>
                ))}
              </ul>
            </section>
          )}
          {error ? (
            <p className="formError" role="alert">
              {catalog["contextReview.recovery"]}
            </p>
          ) : null}
          <button
            className="primaryAction"
            disabled={busy || !hasProject || !hasAssignee}
            type="submit"
          >
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
  source,
}: Readonly<{
  catalog: Catalog;
  draft: ContextTaskDraft;
  locale: Locale;
  projects: readonly ProjectOption[];
  source?: ConnectedWorkContextItem | undefined;
  onClose: () => void;
  onConfirm: (value: ConfirmableTaskDraft) => Promise<void>;
}>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <TaskDraftSheetView
      busy={busy}
      catalog={catalog}
      draft={draft}
      error={error}
      locale={locale}
      onClose={onClose}
      onConfirm={(value) =>
        void (async () => {
          setBusy(true);
          setError(false);
          try {
            await onConfirm(value);
            createContextReviewDraftStorage(window.sessionStorage).clear(draft.id);
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        })()
      }
      projects={projects}
      source={source}
    />
  );
}
