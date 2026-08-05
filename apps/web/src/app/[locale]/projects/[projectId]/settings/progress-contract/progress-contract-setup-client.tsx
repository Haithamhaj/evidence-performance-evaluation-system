"use client";

import { defaultTimeZone } from "@evaluation/localization";
import { createElement, useRef, useState } from "react";

import {
  AppliedProgressContractDraftSchema,
  PublicProgressContractDecisionResultSchema,
  PublicProgressContractDraftSchema,
} from "../../../../../../platform/progress-contract-drafts";
import { ComponentsStep } from "./components-step";
import { ReviewStep } from "./review-step";
import { RulesStep } from "./rules-step";
import { SourceStep } from "./source-step";

export type ProgressContractDraftSourceRequest = Readonly<{
  documentVersionId: string;
  sourceChecksum: string;
  sourceVersion: number;
}>;

export function ProgressContractSetupClient({
  catalog,
  initialDraft,
  locale,
  projectId,
  sourceRequest,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  initialDraft:
    | import("../../../../../../platform/progress-contract-drafts").PublicProgressContractDraft
    | null;
  locale: import("@evaluation/localization").Locale;
  projectId: string;
  sourceRequest: ProgressContractDraftSourceRequest | null;
}>) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(initialDraft === null ? 1 : 2);
  const [draft, setDraft] = useState(initialDraft);
  const [contract, setContract] = useState<
    import("../../../../../../platform/progress-contract-drafts").ProgressContractReviewState | null
  >(initialDraft?.contract ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const idempotencyKey = useRef<string | null>(null);

  async function prepareSource() {
    if (draft !== null) {
      setStep(2);
      return;
    }
    if (sourceRequest === null) return;
    await mutate(async () => {
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
      setStep(2);
    });
  }

  async function saveRules(event: import("react").FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft?.draft === null || draft?.revision === null || draft === null) return;
    const current = draft;
    const form = new FormData(event.currentTarget);
    await mutate(async () => {
      const result = await requestJson(
        `/api/daily-work/projects/${projectId}/progress-contract-drafts/${current.requestId}/revisions`,
        {
          expectedRevision: current.revision,
          content: editedContent(form, current.draft!),
          reason: requiredText(form, "reason"),
        },
        PublicProgressContractDraftSchema,
      );
      setDraft(result);
      setStep(4);
    });
  }

  async function apply(reason: string, calculationKind: "weighted" | "stage_gate") {
    if (draft?.revision === null || draft === null) return;
    const current = draft;
    await mutate(async () => {
      const result = await requestJson(
        `/api/daily-work/projects/${projectId}/progress-contract-drafts/${current.requestId}/apply`,
        {
          expectedRevision: current.revision,
          selectedRevision: current.revision,
          calculationKind,
          reason,
        },
        AppliedProgressContractDraftSchema,
      );
      setContract(result.contract);
      setDraft({ ...current, state: "applied", contract: result.contract });
    });
  }

  async function decide(action: "submit" | "approve", reason: string) {
    if (contract === null) return;
    const current = contract;
    await mutate(async () => {
      setContract(
        await requestJson(
          `/api/daily-work/projects/${projectId}/progress-contracts/${current.id}/${action}`,
          { expectedVersion: current.version, reason },
          PublicProgressContractDecisionResultSchema,
        ),
      );
    });
  }

  async function mutate(action: () => Promise<void>) {
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

  return (
    <div className="progressSetup">
      {error ? (
        <p className="formError" role="alert">
          {catalog["progressContract.error"]}
        </p>
      ) : null}
      {sourceRequest === null && draft === null ? (
        <section className="progressSetupStep">
          <h2>{catalog["progressSetup.step.source"]}</h2>
          <p>{catalog["progress.awaitingContract"]}</p>
        </section>
      ) : step === 1 ? (
        createElement(SourceStep, {
          busy,
          catalog,
          locale,
          onContinue: prepareSource,
          sourceVersion: sourceRequest?.sourceVersion ?? draft!.source.version,
        })
      ) : draft?.draft == null ? (
        <p>{catalog["progressContract.state.failed"]}</p>
      ) : step === 2 ? (
        createElement(ComponentsStep, {
          catalog,
          content: draft.draft,
          locale,
          onBack: () => setStep(1),
          onContinue: () => setStep(3),
        })
      ) : step === 3 ? (
        createElement(RulesStep, {
          busy,
          catalog,
          content: draft.draft,
          locale,
          onBack: () => setStep(2),
          onSave: saveRules,
        })
      ) : (
        createElement(ReviewStep, {
          busy,
          catalog,
          contract,
          draft,
          locale,
          onApply: apply,
          onBack: () => setStep(3),
          onDecision: decide,
        })
      )}
    </div>
  );
}

function editedContent(
  form: FormData,
  current: import("../../../../../../platform/progress-contract-drafts").PublicProgressContractDraftContent,
) {
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
  const values = value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (required && values.length === 0) throw new Error("Invalid form");
  return values;
}

function requiredChoice<const T extends readonly string[]>(
  form: FormData,
  name: string,
  choices: T,
) {
  const value = requiredText(form, name);
  if (!choices.includes(value)) throw new Error("Invalid form");
  return value as T[number];
}

function nullableChoice<const T extends readonly string[]>(
  form: FormData,
  name: string,
  choices: T,
): T[number] | null {
  const value = nullableText(form, name);
  if (value === null) return null;
  if (!choices.includes(value)) throw new Error("Invalid form");
  return value as T[number];
}

async function requestJson<T>(path: string, body: unknown, schema: { parse(value: unknown): T }) {
  const response = await fetch(path, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error("Request failed");
  return schema.parse(await response.json());
}
