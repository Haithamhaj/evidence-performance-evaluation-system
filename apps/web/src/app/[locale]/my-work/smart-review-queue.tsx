"use client";

import type { Catalog, Locale } from "@evaluation/localization";
import { createElement, useEffect, useState } from "react";

import {
  confirmProjectSuggestion,
  confirmTaskDraft,
  correctProjectSuggestion,
  listContextReviewQueue,
  type ContextTaskDraft,
} from "../../../platform/context-intelligence-api";
import {
  listConnectedWorkContext,
  type ConnectedWorkContextItem,
} from "../../../platform/connected-work-context-api";
import type { ProjectOption } from "./connected-context";
import { ProjectMatchCard } from "./project-match-card";
import { TaskDraftSheet } from "./task-draft-sheet";

type Properties = Readonly<{
  catalog: Catalog;
  locale: Locale;
  projects: readonly ProjectOption[];
}>;

export function SmartReviewQueue({ catalog, locale, projects }: Properties) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof listContextReviewQueue>>["items"]>(
    [],
  );
  const [sources, setSources] = useState<readonly ConnectedWorkContextItem[]>([]);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<ContextTaskDraft | null>(null);

  async function refresh() {
    setError(false);
    try {
      const [queue, context] = await Promise.all([
        listContextReviewQueue(),
        listConnectedWorkContext(),
      ]);
      setItems(queue.items);
      setSources(context.items);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function act(id: string, operation: () => Promise<unknown>) {
    setBusyId(id);
    try {
      await operation();
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  const sourceFor = (sourceItemId: string) => sources.find(({ id }) => id === sourceItemId);

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
          <div className="smartReviewRecovery" role="alert">
            <p>{catalog["contextReview.recovery"]}</p>
            <button className="secondaryAction" onClick={() => void refresh()} type="button">
              {catalog["actions.retry"]}
            </button>
          </div>
        ) : null}
        {items.length === 0 ? <p className="emptyRow">{catalog["contextReview.empty"]}</p> : null}
        <div className="smartReviewList">
          {items.map((item) => {
            if (item.kind === "PROJECT_SUGGESTION") {
              return createElement(ProjectMatchCard, {
                busy: busyId === item.id,
                catalog,
                key: item.id,
                locale,
                projects,
                source: sourceFor(item.sourceItemId),
                suggestion: item,
                onConfirm: () =>
                  void act(item.id, () =>
                    confirmProjectSuggestion({
                      id: item.id,
                      expectedRevision: item.revision,
                      reason: catalog["contextReview.confirmLinkReason"],
                    }),
                  ),
                onCorrect: (projectId) =>
                  void act(item.id, () =>
                    correctProjectSuggestion({
                      id: item.id,
                      expectedRevision: item.revision,
                      projectId,
                      reason: catalog["contextReview.correctLinkReason"],
                    }),
                  ),
                onReject: () =>
                  void act(item.id, () =>
                    correctProjectSuggestion({
                      id: item.id,
                      expectedRevision: item.revision,
                      projectId: null,
                      reason: catalog["contextReview.rejectLinkReason"],
                    }),
                  ),
              });
            }
            return (
              <article className="smartReviewItem" key={item.id}>
                <p className="aiDraftLabel">{catalog["contextReview.needsReview"]}</p>
                <h3>{item.draft.title}</h3>
                <p>{catalog["contextReview.taskDraftIntro"]}</p>
                <button
                  className="primaryAction"
                  onClick={() => setSelectedDraft(item)}
                  type="button"
                >
                  {catalog["contextReview.reviewTaskDraft"]}
                </button>
              </article>
            );
          })}
        </div>
      </section>
      {selectedDraft === null
        ? null
        : createElement(TaskDraftSheet, {
            catalog,
            draft: selectedDraft,
            locale,
            onClose: () => setSelectedDraft(null),
            onConfirm: async (draft) => {
              await confirmTaskDraft({
                id: selectedDraft.id,
                expectedRevision: selectedDraft.revision,
                reason: catalog["contextReview.confirmTaskReason"],
                draft,
              });
              setSelectedDraft(null);
              await refresh();
            },
            projects,
            source: sourceFor(selectedDraft.sourceItemId),
          })}
    </>
  );
}
