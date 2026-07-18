"use client";

import type { WorkItemDetail } from "@evaluation/contracts";
import type { Catalog } from "@evaluation/localization";
import { createElement, useEffect, useRef, useState, type ReactNode } from "react";

import {
  ClarificationStateSchema,
  StructuredUpdateDraftSchema,
  type ClarificationState,
  type StructuredUpdateDraft,
} from "../../../platform/updates-evidence-contracts";
import { EvidenceReviewSheet } from "../evidence/evidence-review-sheet";
import { TimelineList } from "../timeline/timeline-list";

type ReviewViewDraft = Readonly<{
  summary: string;
  result: string;
  blocker: string | null;
  nextAction: string;
  contributionContext: string;
  comparison: Readonly<{ explanation: string; changedFields: readonly string[] }>;
}>;
type ViewStage =
  | Readonly<{ kind: "entry"; itemId: string }>
  | Readonly<{
      kind: "question";
      itemId: string;
      question: string;
      remainingFieldCount: number;
    }>
  | Readonly<{
      kind: "review";
      itemId: string;
      draft: ReviewViewDraft;
      saved: boolean;
      evidenceCount: number;
    }>
  | Readonly<{ kind: "complete"; itemId: string }>;

type ViewProperties = Readonly<{
  catalog: Catalog;
  items: readonly WorkItemDetail[];
  projectNames: Readonly<Record<string, string>>;
  stage: ViewStage;
  timeline?: ReactNode;
  busy?: boolean;
  error?: boolean;
  onClose?: () => void;
  onEntrySubmit?: (event: import("react").FormEvent<HTMLFormElement>) => void;
  onQuestionSubmit?: (event: import("react").FormEvent<HTMLFormElement>) => void;
  onReviewSubmit?: (event: import("react").FormEvent<HTMLFormElement>) => void;
  onAddEvidence?: () => void;
  onConfirm?: () => void;
  onNew?: () => void;
}>;

export function UpdateComposerView({
  busy = false,
  catalog,
  error = false,
  items,
  onAddEvidence,
  onClose,
  onConfirm,
  onEntrySubmit,
  onNew,
  onQuestionSubmit,
  onReviewSubmit,
  projectNames,
  stage,
  timeline,
}: ViewProperties) {
  const item = items.find((candidate) => candidate.id === stage.itemId) ?? items[0];
  const projectName =
    item === undefined ? "" : (projectNames[item.projectId] ?? catalog["updates.project"]);
  return (
    <div className="drawerBackdrop updateComposerBackdrop">
      <aside
        aria-labelledby="update-composer-title"
        aria-modal="true"
        className="workItemDrawer updateComposer"
        role="dialog"
      >
        <header className="drawerHeader">
          <div>
            <p className="eyebrow">{projectName}</p>
            <h2 id="update-composer-title">{catalog["updates.title"]}</h2>
          </div>
          <button autoFocus className="quietButton" onClick={onClose} type="button">
            {catalog["actions.close"]}
          </button>
        </header>
        {item === undefined ? null : (
          <div className="composerContext">
            <strong>{item.title}</strong>
            {item.workstreamId === null ? null : (
              <span>{catalog["updates.workstreamLinked"]}</span>
            )}
          </div>
        )}
        {error ? (
          <p className="formError" role="alert">
            {catalog["updates.error"]}
          </p>
        ) : null}
        {stage.kind === "entry" ? (
          <form className="composerForm" onSubmit={onEntrySubmit}>
            <p>{catalog["updates.intro"]}</p>
            <label>
              <span>{catalog["updates.workItem"]}</span>
              <select defaultValue={stage.itemId} name="itemId" required>
                {items.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.title} ·{" "}
                    {projectNames[candidate.projectId] ?? catalog["updates.project"]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{catalog["updates.rawText"]}</span>
              <textarea dir="auto" name="rawText" required rows={7} />
            </label>
            <button className="primaryAction" disabled={busy || items.length === 0} type="submit">
              {catalog["updates.start"]}
            </button>
          </form>
        ) : stage.kind === "question" ? (
          <form className="composerForm" onSubmit={onQuestionSubmit}>
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
        ) : stage.kind === "review" ? (
          <form className="composerForm" onSubmit={onReviewSubmit}>
            <h3>{catalog["updates.review"]}</h3>
            <label>
              <span>{catalog["updates.summary"]}</span>
              <textarea defaultValue={stage.draft.summary} dir="auto" name="summary" required />
            </label>
            <label>
              <span>{catalog["updates.result"]}</span>
              <textarea
                defaultValue={stage.draft.result}
                dir="auto"
                name="result"
                required
                rows={3}
              />
            </label>
            <label>
              <span>{catalog["updates.nextAction"]}</span>
              <textarea
                defaultValue={stage.draft.nextAction}
                dir="auto"
                name="nextAction"
                required
              />
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
            <section className="comparisonPanel">
              <h4>{catalog["updates.comparison"]}</h4>
              <p dir="auto">{stage.draft.comparison.explanation}</p>
            </section>
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
        ) : (
          <section className="completionPanel" aria-live="polite">
            <h3>{catalog["updates.complete"]}</h3>
            <p>{catalog["updates.completeNote"]}</p>
            <button className="primaryAction" onClick={onNew} type="button">
              {catalog["updates.new"]}
            </button>
          </section>
        )}
        {timeline}
      </aside>
    </div>
  );
}

type InternalStage =
  | Readonly<{ kind: "entry"; itemId: string }>
  | Readonly<{ kind: "question"; itemId: string; state: ClarificationState }>
  | Readonly<{
      kind: "review";
      itemId: string;
      draft: StructuredUpdateDraft;
      saved: boolean;
      evidenceIds: readonly string[];
    }>
  | Readonly<{ kind: "complete"; itemId: string }>;

export function UpdateComposer({
  catalog,
  initialItemId,
  items,
  locale,
  onAccepted,
  onClose,
  open,
  projectNames,
}: Readonly<{
  catalog: Catalog;
  initialItemId: string;
  items: readonly WorkItemDetail[];
  locale: import("@evaluation/localization").Locale;
  onAccepted: () => void;
  onClose: () => void;
  open: boolean;
  projectNames: Readonly<Record<string, string>>;
}>) {
  const firstId = items.find((item) => item.id === initialItemId)?.id ?? items[0]?.id ?? "";
  const [stage, setStage] = useState<InternalStage>({ kind: "entry", itemId: firstId });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [timelineKey, setTimelineKey] = useState(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (open && stage.kind === "entry" && initialItemId !== "") {
      setStage((current) =>
        current.kind === "entry" ? { kind: "entry", itemId: initialItemId } : current,
      );
    }
  }, [initialItemId, open, stage.kind]);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !evidenceOpen) closeRef.current();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [evidenceOpen, open]);

  if (!open) return null;
  const selected = items.find((item) => item.id === stage.itemId) ?? items[0];
  const viewStage = toViewStage(stage);

  async function start(event: import("react").FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const itemId = requiredText(form, "itemId");
    const item = items.find((candidate) => candidate.id === itemId);
    if (item === undefined) return;
    await perform(async () => {
      const state = await postState("/api/daily-work/updates/text", {
        idempotencyKey: crypto.randomUUID(),
        projectId: item.projectId,
        workstreamId: item.workstreamId,
        workItemId: item.id,
        rawText: requiredText(form, "rawText"),
        executionMode: "ai_assisted",
      });
      await applyClarification(item.id, state);
    });
  }

  async function answer(event: import("react").FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stage.kind !== "question" || stage.state.state !== "question") return;
    const questionState = stage.state;
    const itemId = stage.itemId;
    const form = new FormData(event.currentTarget);
    await perform(async () => {
      const state = await postState(
        `/api/daily-work/updates/${questionState.sessionId}/answers`,
        {
          expectedSessionVersion: questionState.sessionVersion,
          turnId: questionState.turnId,
          answer: requiredText(form, "answer"),
        },
      );
      await applyClarification(itemId, state);
    });
  }

  async function saveReview(event: import("react").FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stage.kind !== "review") return;
    const form = new FormData(event.currentTarget);
    await perform(async () => {
      const response = await post(
        `/api/daily-work/updates/${stage.draft.sessionId}/revisions`,
        {
          expectedDraftRevision: stage.draft.revision,
          summary: requiredText(form, "summary"),
          result: requiredText(form, "result"),
          blocker: optionalText(form, "blocker"),
          nextAction: requiredText(form, "nextAction"),
          contributionContext: requiredText(form, "contributionContext"),
          evidenceClaimDrafts: [],
        },
      );
      setStage({
        ...stage,
        draft: StructuredUpdateDraftSchema.parse(response),
        saved: true,
      });
    });
  }

  async function confirm() {
    if (stage.kind !== "review" || !stage.saved) return;
    await perform(async () => {
      await post(`/api/daily-work/updates/${stage.draft.sessionId}/confirm`, {
        expectedDraftRevision: stage.draft.revision,
        reason: "Employee reviewed and confirmed the structured update",
      });
      setStage({ kind: "complete", itemId: stage.itemId });
      setTimelineKey((value) => value + 1);
      onAccepted();
    });
  }

  async function applyClarification(itemId: string, state: ClarificationState) {
    if (state.state === "question") {
      setStage({ kind: "question", itemId, state });
      return;
    }
    const response = await fetch(`/api/daily-work/updates/${state.sessionId}/draft`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("draft");
    setStage({
      kind: "review",
      itemId,
      draft: StructuredUpdateDraftSchema.parse(await response.json()),
      saved: false,
      evidenceIds: [],
    });
  }

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError(false);
    try {
      await action();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const updateSourceId =
    stage.kind === "review" ? sourceIdFrom(stage.draft.sourceReferences) : null;
  const contextLabel =
    selected === undefined
      ? ""
      : `${projectNames[selected.projectId] ?? catalog["updates.project"]} · ${selected.title}`;

  return (
    <>
      <UpdateComposerView
        busy={busy}
        catalog={catalog}
        error={error}
        items={items}
        onAddEvidence={() => setEvidenceOpen(true)}
        onClose={onClose}
        onConfirm={confirm}
        onEntrySubmit={start}
        onNew={() =>
          setStage({ kind: "entry", itemId: selected?.id ?? items[0]?.id ?? "" })
        }
        onQuestionSubmit={answer}
        onReviewSubmit={saveReview}
        projectNames={projectNames}
        stage={viewStage}
        timeline={
          stage.kind !== "entry" && selected !== undefined
            ? createElement(TimelineList, {
                catalog,
                locale,
                projectId: selected.projectId,
                refreshKey: timelineKey,
                workstreamId: selected.workstreamId,
              })
            : null
        }
      />
      {!evidenceOpen || stage.kind !== "review" || selected === undefined ? null : (
        createElement(EvidenceReviewSheet, {
          catalog,
          context: {
            projectId: selected.projectId,
            workstreamId: selected.workstreamId,
            workItemId: selected.id,
            updateSourceId,
            contextLabel,
            suggestedClaim: stage.draft.result,
            suggestedContributionContext: stage.draft.contributionContext,
          },
          onClose: () => setEvidenceOpen(false),
          onConfirmed: (evidenceId) => {
            setStage({
              ...stage,
              evidenceIds: [...stage.evidenceIds, evidenceId],
            });
            setEvidenceOpen(false);
            setTimelineKey((value) => value + 1);
          },
        })
      )}
    </>
  );
}

function toViewStage(stage: InternalStage): ViewStage {
  if (stage.kind === "entry") return stage;
  if (stage.kind === "complete") return stage;
  if (stage.kind === "question") {
    if (stage.state.state !== "question") throw new Error("question");
    return {
      kind: "question",
      itemId: stage.itemId,
      question: stage.state.question,
      remainingFieldCount: stage.state.remainingFieldCount,
    };
  }
  return {
    kind: "review",
    itemId: stage.itemId,
    draft: stage.draft,
    saved: stage.saved,
    evidenceCount: stage.evidenceIds.length,
  };
}

async function postState(path: string, body: unknown): Promise<ClarificationState> {
  return ClarificationStateSchema.parse(await post(path, body));
}

async function post(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("request");
  return response.json();
}

function requiredText(form: FormData, name: string): string {
  const value = form.get(name);
  if (typeof value !== "string" || value.trim() === "") throw new Error(name);
  return value.trim();
}

function optionalText(form: FormData, name: string): string | null {
  const value = form.get(name);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function sourceIdFrom(references: readonly string[]): string | null {
  const value = references.find((reference) => reference.startsWith("update-source:"));
  const id = value?.slice("update-source:".length).split(":")[0] ?? "";
  return /^[0-9a-f-]{36}$/iu.test(id) ? id : null;
}
