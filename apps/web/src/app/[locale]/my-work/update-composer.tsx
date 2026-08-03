"use client";

import type { Catalog } from "@evaluation/localization";
import { createElement, useEffect, useRef, useState } from "react";

import {
  AcceptedUpdateEventSchema,
  ClarificationStateSchema,
  StructuredUpdateDraftSchema,
  UpdateResultCardSchema,
  type ClarificationState,
  type StructuredUpdateDraft,
  type UpdateResultCard,
} from "../../../platform/updates-evidence-contracts";
import { EvidenceReviewSheet } from "../evidence/evidence-review-sheet";
import { TimelineList } from "../timeline/timeline-list";
import {
  loadUpdateDraft,
  removeUpdateDraft,
  saveUpdateDraft,
  type StoredUpdateSource,
} from "./update-draft-storage";
import {
  collectCaptureSources,
  mergeResumedCaptureSources,
  recoverableCaptureSources,
  updateDraftText,
} from "./update-capture-sources";
import { UpdateComposerView, type UpdateSelection } from "./update-composer-view";

const DRAFT_STORAGE_KEY = "employee-current";

type InternalStage =
  | Readonly<{
      kind: "entry";
      selection: UpdateSelection;
      rawText: string;
      sources: readonly StoredUpdateSource[];
    }>
  | Readonly<{
      kind: "draft_with_question";
      selection: UpdateSelection;
      state: Extract<ClarificationState, { state: "draft_with_question" }>;
    }>
  | Readonly<{
      kind: "review";
      selection: UpdateSelection;
      draft: StructuredUpdateDraft;
      saved: boolean;
      evidenceIds: readonly string[];
    }>
  | Readonly<{
      kind: "complete";
      result: UpdateResultCard;
      selection: UpdateSelection;
    }>;

type EvidenceContext = Readonly<{
  projectId: string;
  workstreamId: string | null;
  workItemId: string | null;
  updateSourceId: string | null;
  contextLabel: string;
  suggestedClaim: string;
  suggestedContributionContext: string;
  initialSourceKind: "file" | "pasted_text" | "pasted_code" | "cli_snapshot" | "url";
}>;

export function UpdateComposer({
  catalog,
  context,
  initialItemId,
  locale,
  onAccepted,
  onClose,
  open,
}: Readonly<{
  catalog: Catalog;
  context: import("../../../platform/updates-evidence-contracts").UpdateComposerContext;
  initialItemId: string;
  items: readonly import("@evaluation/contracts").WorkItemDetail[];
  locale: import("@evaluation/localization").Locale;
  onAccepted: () => void;
  onClose: () => void;
  open: boolean;
  projectNames: Readonly<Record<string, string>>;
}>) {
  const initial = initialSelection(context, initialItemId);
  const [stage, setStage] = useState<InternalStage>({
    kind: "entry",
    selection: initial,
    rawText: "",
    sources: [],
  });
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<keyof Catalog | null>(null);
  const [evidenceContext, setEvidenceContext] = useState<EvidenceContext | null>(null);
  const [timelineKey, setTimelineKey] = useState(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const stored = loadUpdateDraft(DRAFT_STORAGE_KEY);
    if (stored !== null && validSelection(context, stored)) {
      setStage({
        kind: "entry",
        selection: stored,
        rawText: stored.rawText,
        sources: stored.sources ?? [],
      });
      return;
    }
    setStage((current) =>
      current.kind === "entry"
        ? {
            kind: "entry",
            selection: initialSelection(context, initialItemId),
            rawText: current.rawText,
            sources: current.sources,
          }
        : current,
    );
  }, [context, initialItemId, open]);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && evidenceContext === null) closeRef.current();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [evidenceContext, open]);

  if (!open) return null;

  async function start(event: import("react").FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selection = selectionFrom(form, context);
    const rawText = optionalText(form, "rawText") ?? "";
    const recoveredSources = stage.kind === "entry" ? stage.sources : [];
    const resumableSources = mergeResumedCaptureSources(recoveredSources, []);
    const sourceMetadata = recoverableCaptureSources(form);
    const hasFile = form
      .getAll("sourceFiles")
      .some((value) => value instanceof File && value.name !== "" && value.size > 0);
    if (rawText === "" && sourceMetadata.length === 0 && !hasFile && resumableSources.length === 0) {
      setErrorKey("updates.error.validation");
      return;
    }

    await perform(async () => {
      const sources = mergeResumedCaptureSources(
        recoveredSources,
        await collectCaptureSources(form, selection),
      );
      if (rawText === "" && sources.length === 0) {
        setErrorKey("updates.error.validation");
        return;
      }
      persistEntry(selection, rawText, sources);
      const state = await postState("/api/daily-work/updates/text", {
        idempotencyKey: crypto.randomUUID(),
        projectId: selection.projectId,
        workstreamId: selection.workstreamId,
        workItemId: selection.workItemId,
        rawText,
        ...(sources.length === 0 ? {} : { sources }),
        executionMode: "ai_assisted",
      });
      applyClarification(selection, state);
    });
  }

  async function answer(event: import("react").FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stage.kind !== "draft_with_question") return;
    const questionState = stage.state;
    const selection = stage.selection;
    const form = new FormData(event.currentTarget);
    await perform(async () => {
      const state = await postState(`/api/daily-work/updates/${questionState.sessionId}/answers`, {
        expectedSessionVersion: questionState.sessionVersion,
        turnId: questionState.turnId,
        answer: requiredText(form, "answer"),
      });
      applyClarification(selection, state);
    });
  }

  async function saveReview(event: import("react").FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stage.kind !== "review") return;
    const form = new FormData(event.currentTarget);
    await perform(async () => {
      const response = await post(`/api/daily-work/updates/${stage.draft.sessionId}/revisions`, {
        expectedDraftRevision: stage.draft.revision,
        summary: requiredText(form, "summary"),
        result: requiredText(form, "result"),
        blocker: optionalText(form, "blocker"),
        nextAction: requiredText(form, "nextAction"),
        contributionContext: requiredText(form, "contributionContext"),
        evidenceClaimDrafts: [],
        documentationNeeds: stage.draft.documentationNeeds,
        relatedProgressComponentIds: stage.draft.relatedProgressComponentIds,
      });
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
      const accepted = AcceptedUpdateEventSchema.parse(
        await post(`/api/daily-work/updates/${stage.draft.sessionId}/confirm`, {
          expectedDraftRevision: stage.draft.revision,
          reason: "Employee reviewed and confirmed the structured update",
        }),
      );
      const response = await request(`/api/daily-work/updates/${accepted.id}/result`);
      removeUpdateDraft(DRAFT_STORAGE_KEY);
      setStage({
        kind: "complete",
        result: UpdateResultCardSchema.parse(response),
        selection: stage.selection,
      });
      setTimelineKey((value) => value + 1);
      onAccepted();
    });
  }

  function applyClarification(selection: UpdateSelection, state: ClarificationState) {
    if (state.state === "draft_with_question") {
      setStage({ kind: "draft_with_question", selection, state });
      return;
    }
    setStage({
      kind: "review",
      selection,
      draft: state.draft,
      saved: false,
      evidenceIds: [],
    });
  }

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setErrorKey(null);
    try {
      await action();
    } catch (error) {
      const status = error instanceof RequestFailure ? error.status : 0;
      setErrorKey(updateErrorCatalogKey(status));
      if (status === 401) window.location.assign("/api/auth/login");
    } finally {
      setBusy(false);
    }
  }

  function persistEntry(
    selection: UpdateSelection,
    rawText: string,
    sources: readonly StoredUpdateSource[] = [],
  ) {
    const envelope = {
      ...selection,
      rawText,
      sources,
      returnPath: `${window.location.pathname}${window.location.search}`,
    };
    saveUpdateDraft(DRAFT_STORAGE_KEY, envelope);
    setStage({ kind: "entry", selection, rawText, sources });
  }

  const viewStage = toViewStage(stage, context);
  const activeSelection = stage.selection;
  const updateSourceId =
    stage.kind === "review" ? sourceIdFrom(stage.draft.sourceReferences) : null;

  return (
    <>
      {createElement(UpdateComposerView, {
        busy,
        catalog,
        errorKey,
        locale,
        ...(stage.kind === "review"
          ? {
              onAddEvidence: () =>
                setEvidenceContext({
                  ...stage.selection,
                  updateSourceId,
                  contextLabel: selectionLabel(context, stage.selection),
                  suggestedClaim: stage.draft.result,
                  suggestedContributionContext: stage.draft.contributionContext,
                  initialSourceKind: "file",
                }),
            }
          : {}),
        onClose,
        onConfirm: confirm,
        onEntrySubmit: start,
        onNew: () => {
          const selection = initialSelection(context, "");
          removeUpdateDraft(DRAFT_STORAGE_KEY);
          setStage({ kind: "entry", selection, rawText: "", sources: [] });
        },
        onQuestionSubmit: answer,
        onRawTextChange: (rawText) => {
          if (stage.kind === "entry") {
            const entry = updateDraftText(stage, rawText);
            persistEntry(entry.selection, entry.rawText, entry.sources);
          }
        },
        onSourcesChange: (form) => {
          if (stage.kind === "entry") {
            const metadata = recoverableCaptureSources(form);
            const uploaded = stage.sources.filter((source) => source.uploadedSourceId !== undefined);
            persistEntry(stage.selection, stage.rawText, [...uploaded, ...metadata]);
          }
        },
        onReviewSubmit: saveReview,
        stage: viewStage,
        timeline:
          activeSelection === null
            ? null
            : createElement(TimelineList, {
                catalog,
                locale,
                projectId: activeSelection.projectId,
                refreshKey: timelineKey,
                workstreamId: activeSelection.workstreamId,
              }),
      })}
      {evidenceContext === null
        ? null
        : createElement(EvidenceReviewSheet, {
            catalog,
            context: evidenceContext,
            initialSourceKind: evidenceContext.initialSourceKind,
            onClose: () => setEvidenceContext(null),
            onConfirmed: (evidenceId) => {
              if (stage.kind === "review") {
                setStage({
                  ...stage,
                  evidenceIds: [...stage.evidenceIds, evidenceId],
                });
              }
              setEvidenceContext(null);
              setTimelineKey((value) => value + 1);
            },
          })}
    </>
  );
}

function toViewStage(
  stage: InternalStage,
  context: import("../../../platform/updates-evidence-contracts").UpdateComposerContext,
): import("./update-composer-view").UpdateComposerViewStage {
  if (stage.kind === "entry") return { ...stage, context };
  if (stage.kind === "complete") return { kind: "complete", result: stage.result };
  if (stage.kind === "draft_with_question") {
    return {
      kind: "draft_with_question",
      context,
      selection: stage.selection,
      draft: stage.state.draft,
      question: stage.state.question,
      remainingFieldCount: stage.state.remainingFieldCount,
    };
  }
  return {
    kind: "review",
    context,
    selection: stage.selection,
    draft: stage.draft,
    saved: stage.saved,
    evidenceCount: stage.evidenceIds.length,
  };
}

function initialSelection(
  context: import("../../../platform/updates-evidence-contracts").UpdateComposerContext,
  initialItemId: string,
): UpdateSelection {
  for (const project of context.projects) {
    const item = project.workItems.find((candidate) => candidate.id === initialItemId);
    if (item !== undefined) {
      return {
        projectId: project.id,
        workstreamId: item.workstreamId,
        workItemId: item.id,
      };
    }
  }
  return {
    projectId: context.projects[0]?.id ?? "",
    workstreamId: null,
    workItemId: null,
  };
}

function selectionFrom(
  form: FormData,
  context: import("../../../platform/updates-evidence-contracts").UpdateComposerContext,
): UpdateSelection {
  const selection = {
    projectId: requiredText(form, "projectId"),
    workstreamId: optionalText(form, "workstreamId"),
    workItemId: optionalText(form, "workItemId"),
  };
  if (!validSelection(context, selection)) throw new RequestFailure(400);
  return selection;
}

function validSelection(
  context: import("../../../platform/updates-evidence-contracts").UpdateComposerContext,
  selection: Readonly<{
    projectId: string;
    workstreamId: string | null;
    workItemId: string | null;
  }>,
): selection is UpdateSelection {
  const project = context.projects.find((candidate) => candidate.id === selection.projectId);
  if (project === undefined) return false;
  if (
    selection.workstreamId !== null &&
    !project.workstreams.some((candidate) => candidate.id === selection.workstreamId)
  ) {
    return false;
  }
  if (selection.workItemId === null) return true;
  const item = project.workItems.find((candidate) => candidate.id === selection.workItemId);
  return (
    item !== undefined &&
    (selection.workstreamId === null || item.workstreamId === selection.workstreamId)
  );
}

function selectionLabel(
  context: import("../../../platform/updates-evidence-contracts").UpdateComposerContext,
  selection: UpdateSelection,
): string {
  const project = context.projects.find((candidate) => candidate.id === selection.projectId);
  const workstream = project?.workstreams.find(
    (candidate) => candidate.id === selection.workstreamId,
  );
  const item = project?.workItems.find((candidate) => candidate.id === selection.workItemId);
  return [project?.name, workstream?.name, item?.title].filter(Boolean).join(" · ");
}

async function postState(path: string, body: unknown): Promise<ClarificationState> {
  return ClarificationStateSchema.parse(await post(path, body));
}

async function post(path: string, body: unknown): Promise<unknown> {
  return request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, init);
  if (!response.ok) throw new RequestFailure(response.status);
  return response.json();
}

class RequestFailure extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Request failed with status ${status}`);
    this.status = status;
  }
}

export function updateErrorCatalogKey(status: number): keyof Catalog {
  if (status === 400) return "updates.error.validation";
  if (status === 401) return "updates.error.session";
  if (status === 403) return "updates.error.scope";
  if (status === 409) return "updates.error.stale";
  if (status === 413) return "updates.error.size";
  if (status === 415) return "updates.error.type";
  if (status === 422) return "updates.error.ai";
  if (status === 503) return "updates.error.dependency";
  return "updates.error.unknown";
}

function requiredText(form: FormData, name: string): string {
  const value = form.get(name);
  if (typeof value !== "string" || value.trim() === "") throw new RequestFailure(400);
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
