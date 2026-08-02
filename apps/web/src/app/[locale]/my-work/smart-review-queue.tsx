"use client";

import type { Catalog, Locale } from "@evaluation/localization";
import { createElement, useEffect, useState } from "react";

import {
  confirmProjectSuggestion,
  confirmTaskDraft,
  correctProjectSuggestion,
  listContextReviewQueue,
  type ContextReviewQueue,
  type ContextTaskDraft,
} from "../../../platform/context-intelligence-api";
import { ProjectMatchCard } from "./project-match-card";
import { TaskDraftSheet } from "./task-draft-sheet";

type Properties = Readonly<{ catalog: Catalog; locale: Locale }>;

export function SmartReviewQueue({ catalog, locale }: Properties) {
  const [queue, setQueue] = useState<ContextReviewQueue>({ items: [], projects: [] });
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContextTaskDraft | null>(null);
  async function refresh() {
    try {
      setError(false);
      setQueue(await listContextReviewQueue());
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function act(handle: string, operation: () => Promise<unknown>) {
    setBusy(handle);
    try {
      await operation();
      await refresh();
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <section className="smartReviewQueue panel" aria-labelledby="smart-review-queue-heading">
        <header className="connectedContextHeader">
          <div>
            <p className="eyebrow">{catalog["contextReview.prepared"]}</p>
            <h2 id="smart-review-queue-heading">{catalog["contextReview.title"]}</h2>
            <p>{catalog["contextReview.intro"]}</p>
          </div>
        </header>
        {error ? (
          <div role="alert">
            <p>{catalog["contextReview.recovery"]}</p>
            <button className="secondaryAction" onClick={() => void refresh()} type="button">
              {catalog["actions.retry"]}
            </button>
          </div>
        ) : null}
        {queue.items.length === 0 ? (
          <p className="emptyRow">{catalog["contextReview.empty"]}</p>
        ) : null}
        <div className="smartReviewList">
          {queue.items.map((item) =>
            item.kind === "project_match" ? (
              createElement(ProjectMatchCard, {
                key: item.handle,
                catalog,
                locale,
                projects: queue.projects,
                suggestion: item,
                busy: busy === item.handle,
                onConfirm: () =>
                  void act(item.handle, () =>
                    confirmProjectSuggestion({
                      handle: item.handle,
                      reason: catalog["contextReview.confirmLinkReason"],
                    }),
                  ),
                onCorrect: (projectHandle) =>
                  void act(item.handle, () =>
                    correctProjectSuggestion({
                      handle: item.handle,
                      projectHandle,
                      reason: catalog["contextReview.correctLinkReason"],
                    }),
                  ),
                onReject: () =>
                  void act(item.handle, () =>
                    correctProjectSuggestion({
                      handle: item.handle,
                      projectHandle: null,
                      reason: catalog["contextReview.rejectLinkReason"],
                    }),
                  ),
              })
            ) : (
              <article className="smartReviewItem" key={item.handle}>
                <p className="aiDraftLabel">{catalog["contextReview.needsReview"]}</p>
                <h3>{item.title}</h3>
                <p>{catalog["contextReview.taskDraftIntro"]}</p>
                <button className="primaryAction" onClick={() => setDraft(item)} type="button">
                  {catalog["contextReview.reviewTaskDraft"]}
                </button>
              </article>
            ),
          )}
        </div>
      </section>
      {draft === null
        ? null
        : createElement(TaskDraftSheet, {
            catalog,
            locale,
            draft,
            projects: queue.projects,
            onClose: () => setDraft(null),
            onConfirm: async (value) => {
              await confirmTaskDraft({
                handle: draft.handle,
                reason: catalog["contextReview.confirmTaskReason"],
                draft: {
                  title: value.title,
                  description: value.description,
                  projectHandle: value.projectHandle,
                  assignToYou: true,
                },
              });
              setDraft(null);
              await refresh();
            },
          })}
    </>
  );
}
