"use client";

import { createElement, useEffect, useRef, useState } from "react";

import { EvidenceReviewSchema } from "../../../platform/updates-evidence-contracts";

type SourceKind = "file" | "pasted_text" | "pasted_code" | "cli_snapshot" | "url";
type Review = Readonly<{
  supportedClaim: string;
  contributionContext: string;
  revision: number;
  sourceKind: string;
  sourceProvenance:
    | "github_automated"
    | "employee_text"
    | "employee_voice"
    | "employee_file"
    | "employee_code"
    | "employee_url"
    | "employee_github_snapshot"
    | "employee_mixed"
    | "human_decision";
  revisionKind: "ai_draft" | "employee_edit" | "manual_draft";
  project: Readonly<{ id: string; name: string }>;
  workstream: Readonly<{ id: string; name: string }> | null;
  workItem: Readonly<{ id: string; title: string }> | null;
  relatedKpiComponents: readonly Readonly<{ id: string; name: string }>[];
  relatedCriteria: readonly Readonly<{ id: string; name: string }>[];
  verificationState:
    "unverified" | "pending" | "supported" | "partial" | "conflicting" | "rejected";
}>;
type EvidenceContext = Readonly<{
  projectId: string;
  workstreamId: string | null;
  workItemId: string | null;
  updateSourceId: string | null;
  contextLabel: string;
  suggestedClaim: string;
  suggestedContributionContext: string;
  githubSourceEventId?: string;
  initialSourceText?: string;
  initialSourceUrl?: string;
  executionMode?: "manual" | "ai_assisted";
}>;

type ViewProperties = Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  contextLabel: string;
  sourceKind: SourceKind;
  review: Review | null;
  suggestedClaim?: string;
  suggestedContributionContext?: string;
  initialSourceText?: string;
  initialSourceUrl?: string;
  busy?: boolean;
  error?: boolean;
  githubSuggestion?: boolean;
  onClose?: () => void;
  onSourceKindChange?: (kind: SourceKind) => void;
  onCreate?: (event: import("react").FormEvent<HTMLFormElement>) => void;
  onRevise?: (event: import("react").FormEvent<HTMLFormElement>) => void;
  onConfirm?: () => void;
  onReject?: () => void;
}>;

export function EvidenceReviewSheetView({
  busy = false,
  catalog,
  contextLabel,
  error = false,
  githubSuggestion = false,
  onClose,
  onConfirm,
  onCreate,
  onReject,
  onRevise,
  onSourceKindChange,
  review,
  suggestedClaim = "",
  suggestedContributionContext = "",
  initialSourceText = "",
  initialSourceUrl = "",
  sourceKind,
}: ViewProperties) {
  return (
    <div className="drawerBackdrop evidenceBackdrop">
      <aside
        aria-labelledby="evidence-sheet-title"
        aria-modal="true"
        className="workItemDrawer evidenceReviewSheet"
        role="dialog"
      >
        <header className="drawerHeader">
          <div>
            <p className="eyebrow">{contextLabel}</p>
            <h2 id="evidence-sheet-title">{catalog["evidence.title"]}</h2>
          </div>
          <button autoFocus className="quietButton" onClick={onClose} type="button">
            {catalog["actions.close"]}
          </button>
        </header>
        <p>{catalog["evidence.intro"]}</p>
        {error ? (
          <p className="formError" role="alert">
            {catalog["evidence.error"]}
          </p>
        ) : null}
        {review === null ? (
          <form className="composerForm" onSubmit={onCreate}>
            {githubSuggestion ? (
              <p className="boundaryNote">{catalog["evidence.githubSuggestion"]}</p>
            ) : (
              <label>
                <span>{catalog["evidence.sourceKind"]}</span>
                <select
                  name="sourceKind"
                  onChange={(event) => onSourceKindChange?.(event.target.value as SourceKind)}
                  value={sourceKind}
                >
                  <option value="file">{catalog["evidence.source.file"]}</option>
                  <option value="pasted_text">{catalog["evidence.source.pasted_text"]}</option>
                  <option value="pasted_code">{catalog["evidence.source.pasted_code"]}</option>
                  <option value="cli_snapshot">{catalog["evidence.source.cli_snapshot"]}</option>
                  <option value="url">{catalog["evidence.source.url"]}</option>
                </select>
              </label>
            )}
            {githubSuggestion ? null : sourceKind === "file" ? (
              <label>
                <span>{catalog["evidence.file"]}</span>
                <input
                  accept=".png,.jpg,.jpeg,.webp,.txt,.pdf,.docx"
                  name="file"
                  required
                  type="file"
                />
              </label>
            ) : sourceKind === "url" ? (
              <label>
                <span>{catalog["evidence.url"]}</span>
                <input
                  defaultValue={initialSourceUrl}
                  dir="ltr"
                  name="sourceUrl"
                  required
                  type="url"
                />
              </label>
            ) : (
              <label>
                <span>{catalog["evidence.text"]}</span>
                <textarea
                  defaultValue={initialSourceText}
                  dir="auto"
                  name="sourceText"
                  required
                  rows={6}
                />
              </label>
            )}
            <label>
              <span>{catalog["evidence.claim"]}</span>
              <textarea
                defaultValue={suggestedClaim}
                dir="auto"
                name="supportedClaim"
                required
                rows={3}
              />
            </label>
            <label>
              <span>{catalog["evidence.contribution"]}</span>
              <textarea
                defaultValue={suggestedContributionContext}
                dir="auto"
                name="contributionContext"
                required
                rows={3}
              />
            </label>
            <button className="primaryAction" disabled={busy} type="submit">
              {busy ? catalog["evidence.uploading"] : catalog["evidence.create"]}
            </button>
          </form>
        ) : (
          <form
            className="composerForm"
            key={`evidence-review-${review.revision}`}
            onSubmit={onRevise}
          >
            {createElement(EvidenceReviewContext, { catalog, review })}
            <label>
              <span>{catalog["evidence.claim"]}</span>
              <textarea
                defaultValue={review.supportedClaim}
                dir="auto"
                name="supportedClaim"
                required
                rows={3}
              />
            </label>
            <label>
              <span>{catalog["evidence.contribution"]}</span>
              <textarea
                defaultValue={review.contributionContext}
                dir="auto"
                name="contributionContext"
                required
                rows={3}
              />
            </label>
            <p className="boundaryNote">{catalog["evidence.confirmRequired"]}</p>
            <div className="formActions">
              <button className="secondaryAction" disabled={busy} type="submit">
                {catalog["evidence.saveReview"]}
              </button>
              <button
                className="primaryAction"
                disabled={busy || review.revision < 2}
                onClick={onConfirm}
                type="button"
              >
                {catalog["evidence.confirm"]}
              </button>
              <button className="quietButton" disabled={busy} onClick={onReject} type="button">
                {catalog["evidence.reject"]}
              </button>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
}

function EvidenceReviewContext({
  catalog,
  review,
}: Readonly<{ catalog: import("@evaluation/localization").Catalog; review: Review }>) {
  return (
    <section aria-label={catalog["evidence.context"]} className="evidenceReviewContext">
      <div>
        <span>{catalog["evidence.provenance"]}</span>
        <strong>{catalog[`evidence.provenance.${review.sourceProvenance}`]}</strong>
      </div>
      <div>
        <span>{catalog["evidence.reviewState"]}</span>
        <strong>{catalog[`evidence.revision.${review.revisionKind}`]}</strong>
      </div>
      <div>
        <span>{catalog["evidence.project"]}</span>
        <strong dir="auto">{review.project.name}</strong>
      </div>
      <div>
        <span>{catalog["evidence.workstream"]}</span>
        <strong dir="auto">{review.workstream?.name ?? catalog["evidence.notLinked"]}</strong>
      </div>
      <div>
        <span>{catalog["evidence.workItem"]}</span>
        <strong dir="auto">{review.workItem?.title ?? catalog["evidence.notLinked"]}</strong>
      </div>
      <div>
        <span>{catalog["evidence.kpi"]}</span>
        <strong dir="auto">
          {review.relatedKpiComponents.map((item) => item.name).join(" · ") ||
            catalog["evidence.notLinked"]}
        </strong>
      </div>
      <div>
        <span>{catalog["evidence.criterion"]}</span>
        <strong dir="auto">
          {review.relatedCriteria.map((item) => item.name).join(" · ") ||
            catalog["evidence.notLinked"]}
        </strong>
      </div>
      <div>
        <span>{catalog["evidence.verification"]}</span>
        <strong>{catalog[`evidence.verification.${review.verificationState}`]}</strong>
      </div>
    </section>
  );
}

export function EvidenceReviewSheet({
  catalog,
  context,
  initialSourceKind = "file",
  onClose,
  onConfirmed,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  context: EvidenceContext;
  initialSourceKind?: SourceKind;
  onClose: () => void;
  onConfirmed: (evidenceId: string) => void;
}>) {
  const [sourceKind, setSourceKind] = useState<SourceKind>(initialSourceKind);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeRef.current();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  async function create(event: import("react").FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    try {
      const form = new FormData(event.currentTarget);
      const githubSuggestion = context.githubSourceEventId !== undefined;
      const source = githubSuggestion ? undefined : await evidenceSource(form, sourceKind, context);
      const response = await requestJson(
        githubSuggestion
          ? "/api/daily-work/evidence/github-suggestions"
          : "/api/daily-work/evidence",
        {
          idempotencyKey: crypto.randomUUID(),
          projectId: context.projectId,
          workstreamId: context.workstreamId,
          workItemId: context.workItemId,
          ...(githubSuggestion
            ? { sourceEventId: context.githubSourceEventId }
            : {
                capturedFromWorkItem: context.workItemId !== null,
                updateSourceId: context.updateSourceId,
                source,
              }),
          supportedClaim: requiredText(form, "supportedClaim"),
          relatedKpiComponentId: null,
          relatedCriterionId: null,
          contributionContext: requiredText(form, "contributionContext"),
          executionMode: context.executionMode ?? "ai_assisted",
        },
      );
      const createdEvidenceId = requiredString(response, "id");
      setEvidenceId(createdEvidenceId);
      setReview(await requestReview(createdEvidenceId));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function revise(event: import("react").FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (evidenceId === null || review === null) return;
    setBusy(true);
    setError(false);
    try {
      const form = new FormData(event.currentTarget);
      await requestJson(`/api/daily-work/evidence/${evidenceId}/revisions`, {
        expectedRevision: review.revision,
        supportedClaim: requiredText(form, "supportedClaim"),
        contributionContext: requiredText(form, "contributionContext"),
      });
      setReview(await requestReview(evidenceId));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (evidenceId === null || review === null || review.revision < 2) return;
    setBusy(true);
    setError(false);
    try {
      await requestJson(`/api/daily-work/evidence/${evidenceId}/confirm`, {
        expectedRevision: review.revision,
        reason: "Employee reviewed and confirmed the evidence",
      });
      onConfirmed(evidenceId);
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  async function reject() {
    if (evidenceId === null || review === null) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      await requestJson(`/api/daily-work/evidence/${evidenceId}/reject`, {
        expectedRevision: review.revision,
        reason: "Employee rejected the evidence draft",
      });
      onClose();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <EvidenceReviewSheetView
      busy={busy}
      catalog={catalog}
      contextLabel={context.contextLabel}
      error={error}
      githubSuggestion={context.githubSourceEventId !== undefined}
      onClose={onClose}
      onConfirm={confirm}
      onCreate={create}
      onReject={reject}
      onRevise={revise}
      onSourceKindChange={setSourceKind}
      review={review}
      suggestedClaim={context.suggestedClaim}
      suggestedContributionContext={context.suggestedContributionContext}
      {...(context.initialSourceText === undefined
        ? {}
        : { initialSourceText: context.initialSourceText })}
      {...(context.initialSourceUrl === undefined
        ? {}
        : { initialSourceUrl: context.initialSourceUrl })}
      sourceKind={sourceKind}
    />
  );
}

async function evidenceSource(
  form: FormData,
  kind: SourceKind,
  context: EvidenceContext,
): Promise<unknown> {
  if (kind === "file") {
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("file");
    const upload = new FormData();
    upload.set("file", file);
    upload.set(
      "metadata",
      JSON.stringify({
        projectId: context.projectId,
        workstreamId: context.workstreamId,
        reason: "Employee attached evidence for review",
      }),
    );
    const response = await fetch("/api/daily-work/evidence/uploads", {
      method: "POST",
      body: upload,
    });
    if (!response.ok) throw new Error("upload");
    const uploaded = (await response.json()) as Record<string, unknown>;
    return {
      kind: file.type.startsWith("image/") ? "screenshot" : "file",
      uploadedSourceId: requiredString(uploaded, "id"),
    };
  }
  if (kind === "url") return { kind, url: requiredText(form, "sourceUrl") };
  return { kind, text: requiredText(form, "sourceText") };
}

async function requestJson(path: string, body: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("request");
  return (await response.json()) as Record<string, unknown>;
}

function requiredText(form: FormData, name: string): string {
  const value = form.get(name);
  if (typeof value !== "string" || value.trim() === "") throw new Error(name);
  return value.trim();
}

function requiredString(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== "string" || field === "") throw new Error(key);
  return field;
}

function toReview(value: Record<string, unknown>): Review {
  const parsed = EvidenceReviewSchema.parse(value);
  return {
    supportedClaim: parsed.supportedClaim,
    contributionContext: parsed.contributionContext,
    revision: parsed.revision,
    sourceKind: parsed.sourceKind,
    sourceProvenance: parsed.sourceProvenance,
    revisionKind: parsed.revisionKind,
    project: parsed.project,
    workstream: parsed.workstream,
    workItem: parsed.workItem,
    relatedKpiComponents: parsed.relatedKpiComponents,
    relatedCriteria: parsed.relatedCriteria,
    verificationState: parsed.verificationState,
  };
}

async function requestReview(evidenceId: string): Promise<Review> {
  const response = await fetch(`/api/daily-work/evidence/${evidenceId}`, { cache: "no-store" });
  if (!response.ok) throw new Error("review");
  return toReview((await response.json()) as Record<string, unknown>);
}
