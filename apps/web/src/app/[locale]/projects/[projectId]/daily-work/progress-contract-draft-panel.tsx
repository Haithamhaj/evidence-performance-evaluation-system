"use client";

import {
  defaultTimeZone,
  localeMetadata,
  type Catalog,
  type Locale,
} from "@evaluation/localization";
import { createElement, useEffect, useRef, useState } from "react";

import {
  AppliedProgressContractDraftSchema,
  PublicProgressContractDecisionResultSchema,
  PublicProgressContractDraftSchema,
  type ProgressContractReviewState,
  type PublicProgressContractDraft,
} from "../../../../../platform/progress-contract-drafts";

export type ProgressContractDraftSourceRequest = Readonly<{
  documentVersionId: string;
  sourceChecksum: string;
  sourceVersion: number;
}>;

type Properties = Readonly<{
  catalog: Catalog;
  initialDraft: PublicProgressContractDraft | null;
  initialOpen?: boolean;
  locale: Locale;
  projectId: string;
  sourceRequest: ProgressContractDraftSourceRequest | null;
}>;

export function ProgressContractDraftPanel({
  catalog,
  initialDraft,
  initialOpen = false,
  locale,
  projectId,
  sourceRequest,
}: Properties) {
  const [open, setOpen] = useState(initialOpen);
  const [draft, setDraft] = useState(initialDraft);
  const [contract, setContract] = useState<ProgressContractReviewState | null>(
    initialDraft?.contract ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const idempotencyKey = useRef<string | null>(null);
  const dialog = useRef<HTMLElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const reviewForm = useRef<HTMLFormElement | null>(null);
  const direction = localeMetadata[locale].direction;

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }

  async function openReview() {
    setOpen(true);
    if (draft !== null || sourceRequest === null || busy) return;
    setBusy(true);
    setError(false);
    try {
      idempotencyKey.current ??= crypto.randomUUID();
      const result = await requestJson(
        `/api/daily-work/projects/${projectId}/progress-contract-drafts`,
        {
          idempotencyKey: idempotencyKey.current,
          documentVersionId: sourceRequest.documentVersionId,
          sourceChecksum: sourceRequest.sourceChecksum,
          locale,
          timezone: defaultTimeZone,
          effectiveAt: new Date().toISOString(),
          reason: catalog["progressContract.create"],
        },
        PublicProgressContractDraftSchema,
      );
      setDraft(result);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function saveRevision(event: import("react").FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft === null || draft.draft === null || draft.revision === null) return;
    const current = draft;
    const form = new FormData(event.currentTarget);
    await mutateDraft(async () => {
      const result = await requestJson(
        `/api/daily-work/projects/${projectId}/progress-contract-drafts/${current.requestId}/revisions`,
        {
          expectedRevision: current.revision!,
          content: editedContent(form, current.draft!),
          reason: requiredText(form, "reason"),
        },
        PublicProgressContractDraftSchema,
      );
      setDraft(result);
    });
  }

  async function applyAsDraft() {
    if (draft === null || draft.revision === null || reviewForm.current === null) return;
    const current = draft;
    const form = new FormData(reviewForm.current);
    if (
      current.origin !== "human" ||
      current.draft === null ||
      hasUnsavedDraftChanges(form, current.draft)
    ) {
      setError(true);
      return;
    }
    await mutateDraft(async () => {
      const result = await requestJson(
        `/api/daily-work/projects/${projectId}/progress-contract-drafts/${current.requestId}/apply`,
        {
          expectedRevision: current.revision!,
          selectedRevision: current.revision!,
          calculationKind: requiredChoice(form, "calculationKind", ["weighted", "stage_gate"]),
          reason: requiredText(form, "reason"),
        },
        AppliedProgressContractDraftSchema,
      );
      setContract(result.contract);
      setDraft({ ...current, state: "applied", contract: result.contract });
    });
  }

  async function rejectDraft() {
    if (draft === null || draft.revision === null || reviewForm.current === null) return;
    const current = draft;
    const form = new FormData(reviewForm.current);
    await mutateDraft(async () => {
      setDraft(
        await requestJson(
          `/api/daily-work/projects/${projectId}/progress-contract-drafts/${current.requestId}/reject`,
          {
            expectedRevision: current.revision!,
            reason: requiredText(form, "reason"),
          },
          PublicProgressContractDraftSchema,
        ),
      );
    });
  }

  async function decideContract(action: "submit" | "approve") {
    if (contract === null || reviewForm.current === null) return;
    const current = contract;
    const form = new FormData(reviewForm.current);
    await mutateDraft(async () => {
      setContract(
        await requestJson(
          `/api/daily-work/projects/${projectId}/progress-contracts/${current.id}/${action}`,
          {
            expectedVersion: current.version,
            reason: requiredText(form, "reason"),
          },
          PublicProgressContractDecisionResultSchema,
        ),
      );
    });
  }

  async function mutateDraft(action: () => Promise<void>) {
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

  function containFocus(event: import("react").KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const focusable = [
      ...(dialog.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]",
      ) ?? []),
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

  return (
    <section className="progressContractReviewEntry" aria-labelledby="contract-review-heading">
      <div>
        <h2 id="contract-review-heading">{catalog["progressContract.review"]}</h2>
        <p className="boundaryNote">{catalog["progressContract.activationRequired"]}</p>
      </div>
      <button
        className="primaryAction"
        disabled={sourceRequest === null && draft === null}
        onClick={openReview}
        ref={trigger}
        type="button"
      >
        {draft === null ? catalog["progressContract.create"] : catalog["progressContract.review"]}
      </button>
      {!open ? null : (
        <div
          className="drawerBackdrop progressContractDraftBackdrop"
          dir={direction}
          onMouseDown={(event) => event.target === event.currentTarget && close()}
        >
          <aside
            aria-labelledby="progress-contract-draft-title"
            aria-modal="true"
            className="workItemDrawer progressContractDraftSheet"
            onKeyDown={containFocus}
            ref={dialog}
            role="dialog"
          >
            <header className="drawerHeader">
              <div>
                <p className="aiDraftLabel">{catalog["progressContract.aiDraftLabel"]}</p>
                <h2 id="progress-contract-draft-title">{catalog["progressContract.review"]}</h2>
              </div>
              <button autoFocus className="quietButton" onClick={close} type="button">
                {catalog["actions.close"]}
              </button>
            </header>
            <p>{catalog["progressContract.intro"]}</p>
            {error ? (
              <p className="formError" role="alert">
                {catalog["progressContract.error"]}
              </p>
            ) : null}
            {busy && draft === null ? (
              <p aria-live="polite">{catalog["progressContract.requesting"]}</p>
            ) : draft === null ? (
              <p>{catalog["progress.awaitingContract"]}</p>
            ) : (
              createElement(DraftReviewForm, {
                busy,
                catalog,
                contract,
                draft,
                formRef: reviewForm,
                onActivate: () => decideContract("approve"),
                onApply: applyAsDraft,
                onReject: rejectDraft,
                onSave: saveRevision,
                onSubmitForApproval: () => decideContract("submit"),
              })
            )}
          </aside>
        </div>
      )}
    </section>
  );
}

function DraftReviewForm({
  busy,
  catalog,
  contract,
  draft,
  formRef,
  onActivate,
  onApply,
  onReject,
  onSave,
  onSubmitForApproval,
}: Readonly<{
  busy: boolean;
  catalog: Catalog;
  contract: ProgressContractReviewState | null;
  draft: PublicProgressContractDraft;
  formRef: import("react").RefObject<HTMLFormElement | null>;
  onActivate: () => void;
  onApply: () => void;
  onReject: () => void;
  onSave: (event: import("react").FormEvent<HTMLFormElement>) => void;
  onSubmitForApproval: () => void;
}>) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  useEffect(() => {
    setHasUnsavedChanges(false);
  }, [draft.requestId, draft.revision]);

  if (draft.state === "pending") {
    return <p aria-live="polite">{catalog["progressContract.state.pending"]}</p>;
  }
  if (draft.state === "rejected") {
    return <p>{catalog["progressContract.state.rejected"]}</p>;
  }
  if (draft.state === "failed" || draft.draft === null) {
    return (
      <p className={draft.state === "failed" ? "formError" : undefined}>
        {catalog["progressContract.state.failed"]}
      </p>
    );
  }
  const defaultCalculationKind = draft.draft.components.every(
    (component) => component.weight !== null,
  )
    ? "weighted"
    : "stage_gate";
  const mustSaveBeforeApply = draft.origin !== "human" || hasUnsavedChanges;
  return (
    <form
      className="progressContractDraftForm"
      onChange={(event) => {
        const target: EventTarget = event.target;
        if (
          !(target instanceof HTMLInputElement) &&
          !(target instanceof HTMLSelectElement) &&
          !(target instanceof HTMLTextAreaElement)
        ) {
          return;
        }
        const { name } = target;
        if (
          name.startsWith("component.") ||
          name === "ambiguities" ||
          name === "clarificationQuestions"
        ) {
          setHasUnsavedChanges(true);
        }
      }}
      onSubmit={onSave}
      ref={formRef}
    >
      <dl className="compactDetails sourceVersionCard">
        <dt>{catalog["progressContract.approvedSource"]}</dt>
        <dd>{catalog["progressContract.approvedProjectDocument"]}</dd>
        <dt>{catalog["progressContract.sourceVersion"]}</dt>
        <dd>{draft.source.version}</dd>
        <dt>{catalog["progressContract.revision"]}</dt>
        <dd>
          {draft.revision} · {catalog[`progressContract.origin.${draft.origin ?? "ai"}`]}
        </dd>
      </dl>
      <section className="drawerSection">
        <h3>{catalog["progressContract.components"]}</h3>
        <div className="progressContractComponentForms">
          {draft.draft.components.map((component) => (
            <fieldset key={component.position}>
              <legend>
                {component.position}. {component.name}
              </legend>
              <div className="progressContractFieldGrid">
                <label>
                  <span>{catalog["progressContract.componentKind"]}</span>
                  <select
                    defaultValue={component.kind}
                    name={`component.${component.position}.kind`}
                  >
                    {(["milestone", "deliverable", "operational_kpi"] as const).map((kind) => (
                      <option key={kind} value={kind}>
                        {catalog[`progressContract.kind.${kind}`]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{catalog["progressContract.name"]}</span>
                  <input
                    defaultValue={component.name}
                    dir="auto"
                    name={`component.${component.position}.name`}
                    required
                  />
                </label>
              </div>
              <label>
                <span>{catalog["progressContract.description"]}</span>
                <textarea
                  defaultValue={component.description}
                  dir="auto"
                  name={`component.${component.position}.description`}
                  required
                  rows={3}
                />
              </label>
              <div className="progressContractMetricGrid">
                {createElement(NumberField, {
                  label: catalog["progressContract.weight"],
                  name: `component.${component.position}.weight`,
                  value: component.weight,
                })}
                {createElement(NumberField, {
                  label: catalog["progressContract.baseline"],
                  name: `component.${component.position}.baseline`,
                  value: component.baseline,
                })}
                {createElement(NumberField, {
                  label: catalog["progressContract.target"],
                  name: `component.${component.position}.target`,
                  value: component.target,
                })}
                <label>
                  <span>{catalog["progressContract.unit"]}</span>
                  <input
                    defaultValue={component.unit ?? ""}
                    dir="auto"
                    name={`component.${component.position}.unit`}
                  />
                </label>
                <label>
                  <span>{catalog["progressContract.direction"]}</span>
                  <select
                    defaultValue={component.direction ?? ""}
                    name={`component.${component.position}.direction`}
                  >
                    <option value="">—</option>
                    {(["increase", "decrease", "maintain"] as const).map((direction) => (
                      <option key={direction} value={direction}>
                        {catalog[`progressContract.direction.${direction}`]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {createElement(ListEditor, {
                hint: catalog["progressContract.onePerLine"],
                label: catalog["progressContract.acceptanceConditions"],
                name: `component.${component.position}.acceptanceConditions`,
                values: component.acceptanceConditions,
              })}
              {createElement(ListEditor, {
                hint: catalog["progressContract.onePerLine"],
                label: catalog["progressContract.requiredEvidence"],
                name: `component.${component.position}.requiredEvidence`,
                values: component.requiredEvidence,
              })}
              <label>
                <span>{catalog["progressContract.confirmationMode"]}</span>
                <select
                  defaultValue={component.confirmationMode}
                  name={`component.${component.position}.confirmationMode`}
                >
                  {(["deterministic", "human_confirmed"] as const).map((mode) => (
                    <option key={mode} value={mode}>
                      {catalog[`progressContract.confirmation.${mode}`]}
                    </option>
                  ))}
                </select>
              </label>
              <section className="sourceCoverage">
                <h4>{catalog["progressContract.sources"]}</h4>
                <ul>
                  {component.sourceLabels.map((label) => (
                    <li dir="auto" key={label}>
                      {catalog["progressContract.approvedProjectDocument"]} ·{" "}
                      {catalog["progressContract.sourceVersion"]} {draft.source.version}
                    </li>
                  ))}
                </ul>
                {component.automationHints.map((hint) => (
                  <p dir="auto" key={`${hint.repositoryLabel}:${hint.event}`}>
                    <strong>{catalog["progressContract.automation"]}:</strong>{" "}
                    <bdi>{hint.repositoryLabel}</bdi> · <bdi>{hint.event}</bdi>
                  </p>
                ))}
              </section>
            </fieldset>
          ))}
        </div>
      </section>
      <section className="drawerSection">
        {createElement(ListEditor, {
          hint: catalog["progressContract.onePerLine"],
          label: catalog["progressContract.ambiguities"],
          name: "ambiguities",
          required: false,
          values: draft.draft.ambiguities,
        })}
        {createElement(ListEditor, {
          hint: catalog["progressContract.onePerLine"],
          label: catalog["progressContract.clarificationQuestions"],
          name: "clarificationQuestions",
          required: false,
          values: draft.draft.clarificationQuestions,
        })}
      </section>
      <label>
        <span>{catalog["progressContract.reason"]}</span>
        <textarea dir="auto" name="reason" required rows={3} />
      </label>
      <label>
        <span>{catalog["progressContract.calculationKind"]}</span>
        <select defaultValue={defaultCalculationKind} name="calculationKind">
          <option value="weighted">{catalog["progressContract.calculation.weighted"]}</option>
          <option value="stage_gate">{catalog["progressContract.calculation.stage_gate"]}</option>
        </select>
      </label>
      <p className="boundaryNote">{catalog["progressContract.activationRequired"]}</p>
      {contract === null ? (
        <>
          {mustSaveBeforeApply ? (
            <p className="boundaryNote">{catalog["progressContract.saveBeforeApply"]}</p>
          ) : null}
          <div className="formActions">
            <button className="secondaryAction" disabled={busy} type="submit">
              {busy ? catalog["progressContract.saving"] : catalog["progressContract.saveRevision"]}
            </button>
            <button
              className="primaryAction"
              disabled={busy || mustSaveBeforeApply}
              onClick={onApply}
              type="button"
            >
              {catalog["progressContract.applyAsDraft"]}
            </button>
            <button className="quietButton" disabled={busy} onClick={onReject} type="button">
              {catalog["progressContract.rejectDraft"]}
            </button>
          </div>
        </>
      ) : (
        <section className="humanApprovalGate" aria-labelledby="human-approval-heading">
          <h3 id="human-approval-heading">
            {contract.state === "draft"
              ? catalog["progressContract.contractDraft"]
              : contract.state === "pending_approval"
                ? catalog["progressContract.productOwnerApproval"]
                : catalog["progressContract.active"]}
          </h3>
          {contract.state === "draft" ? (
            <button
              className="secondaryAction"
              disabled={busy}
              onClick={onSubmitForApproval}
              type="button"
            >
              {catalog["progressContract.submitForApproval"]}
            </button>
          ) : contract.state === "pending_approval" ? (
            <>
              <p>{catalog["progressContract.pendingApproval"]}</p>
              <button className="primaryAction" disabled={busy} onClick={onActivate} type="button">
                {catalog["progressContract.activate"]}
              </button>
            </>
          ) : (
            <p className="statusBadge status-active">{catalog["progressContract.active"]}</p>
          )}
        </section>
      )}
    </form>
  );
}

function NumberField({
  label,
  name,
  value,
}: Readonly<{ label: string; name: string; value: number | null }>) {
  return (
    <label>
      <span>{label}</span>
      <input defaultValue={value ?? ""} inputMode="decimal" name={name} step="any" type="number" />
    </label>
  );
}

function ListEditor({
  hint,
  label,
  name,
  required = true,
  values,
}: Readonly<{
  hint: string;
  label: string;
  name: string;
  required?: boolean;
  values: readonly string[];
}>) {
  return (
    <label>
      <span>{label}</span>
      <textarea
        defaultValue={values.join("\n")}
        dir="auto"
        name={name}
        required={required}
        rows={Math.max(2, values.length + 1)}
      />
      <small>{hint}</small>
    </label>
  );
}

function editedContent(
  form: FormData,
  current: import("../../../../../platform/progress-contract-drafts").PublicProgressContractDraftContent,
): Omit<
  import("../../../../../platform/progress-contract-drafts").PublicProgressContractDraftContent,
  "components"
> & {
  components: Array<
    Omit<
      import("../../../../../platform/progress-contract-drafts").PublicProgressContractDraftContent["components"][number],
      "automationHints" | "sourceLabels"
    >
  >;
} {
  return {
    components: current.components.map((component) => {
      const key = `component.${component.position}`;
      return {
        position: component.position,
        kind: requiredChoice(form, `${key}.kind`, ["milestone", "deliverable", "operational_kpi"]),
        name: requiredText(form, `${key}.name`),
        description: requiredText(form, `${key}.description`),
        weight: nullableNumber(form, `${key}.weight`),
        baseline: nullableNumber(form, `${key}.baseline`),
        target: nullableNumber(form, `${key}.target`),
        unit: nullableText(form, `${key}.unit`),
        direction: nullableChoice(form, `${key}.direction`, ["increase", "decrease", "maintain"]),
        acceptanceConditions: lines(form, `${key}.acceptanceConditions`, true),
        requiredEvidence: lines(form, `${key}.requiredEvidence`, true),
        confirmationMode: requiredChoice(form, `${key}.confirmationMode`, [
          "deterministic",
          "human_confirmed",
        ]),
      };
    }),
    ambiguities: lines(form, "ambiguities", false),
    clarificationQuestions: lines(form, "clarificationQuestions", false),
  };
}

export function hasUnsavedDraftChanges(
  form: FormData,
  current: import("../../../../../platform/progress-contract-drafts").PublicProgressContractDraftContent,
): boolean {
  const currentEditable = {
    components: current.components.map(
      ({ automationHints: _automationHints, sourceLabels: _sourceLabels, ...component }) =>
        component,
    ),
    ambiguities: [...current.ambiguities],
    clarificationQuestions: [...current.clarificationQuestions],
  };
  return JSON.stringify(editedContent(form, current)) !== JSON.stringify(currentEditable);
}

function requiredText(form: FormData, name: string): string {
  const value = form.get(name);
  if (typeof value !== "string" || value.trim().length === 0) throw new Error("Invalid form");
  return value.trim();
}

function nullableText(form: FormData, name: string): string | null {
  const value = form.get(name);
  if (typeof value !== "string") throw new Error("Invalid form");
  return value.trim().length === 0 ? null : value.trim();
}

function nullableNumber(form: FormData, name: string): number | null {
  const value = nullableText(form, name);
  if (value === null) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error("Invalid form");
  return number;
}

function lines(form: FormData, name: string, required: boolean): string[] {
  const value = form.get(name);
  if (typeof value !== "string") throw new Error("Invalid form");
  const result = value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (required && result.length === 0) throw new Error("Invalid form");
  return result;
}

function requiredChoice<const T extends readonly string[]>(
  form: FormData,
  name: string,
  choices: T,
): T[number] {
  const value = requiredText(form, name);
  if (!choices.includes(value)) throw new Error("Invalid form");
  return value;
}

function nullableChoice<const T extends readonly string[]>(
  form: FormData,
  name: string,
  choices: T,
): T[number] | null {
  const value = nullableText(form, name);
  if (value === null) return null;
  if (!choices.includes(value)) throw new Error("Invalid form");
  return value;
}

async function requestJson<T>(
  path: string,
  body: unknown,
  schema: { parse(value: unknown): T },
): Promise<T> {
  const response = await fetch(path, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error("Request failed");
  return schema.parse(await response.json());
}
