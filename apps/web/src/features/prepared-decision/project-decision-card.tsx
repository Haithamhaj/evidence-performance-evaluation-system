/* eslint-disable no-unused-vars */
"use client";

import { ActionButton, ProductIcon } from "@evaluation/ui";
import { useState } from "react";

import { ContextDecisionError } from "../../platform/context-intelligence-api";
import styles from "../../product-ui/today/intelligent-today.module.css";

type Suggestion = import("../../platform/context-intelligence-api").ContextProjectSuggestion;

export type DecisionGateway = Readonly<{
  confirm(input: { readonly handle: string; readonly reason: string }): Promise<unknown>;
  correct(input: {
    readonly handle: string;
    readonly projectHandle: string;
    readonly reason: string;
  }): Promise<unknown>;
  dismiss(input: { readonly handle: string; readonly reason: string }): Promise<unknown>;
}>;

export function ProjectDecisionCard({
  catalog,
  gateway,
  onDecided,
  onReload,
  projects,
  suggestion,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  gateway: DecisionGateway;
  onDecided(kind: "confirmed" | "corrected" | "dismissed"): Promise<void>;
  onReload(): Promise<void>;
  projects: readonly { readonly handle: string; readonly name: string }[];
  suggestion: Suggestion;
}>) {
  const [correcting, setCorrecting] = useState(false);
  const [projectHandle, setProjectHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState(false);

  async function decide(kind: "confirm" | "dismiss") {
    setBusy(true);
    setError(false);
    setStale(false);
    try {
      if (kind === "dismiss") {
        await gateway.dismiss({
          handle: suggestion.handle,
          reason: catalog["contextReview.rejectLinkReason"],
        });
        await onDecided("dismissed");
      } else if (correcting) {
        if (projectHandle === "") return;
        await gateway.correct({
          handle: suggestion.handle,
          projectHandle,
          reason: catalog["contextReview.correctLinkReason"],
        });
        await onDecided("corrected");
      } else {
        await gateway.confirm({
          handle: suggestion.handle,
          reason: catalog["contextReview.confirmLinkReason"],
        });
        await onDecided("confirmed");
      }
    } catch (caught) {
      if (caught instanceof ContextDecisionError && caught.status === 409) setStale(true);
      else setError(true);
    } finally {
      setBusy(false);
    }
  }

  const provider =
    suggestion.source.provider === null
      ? catalog["today.intelligent.provider.private"]
      : catalog[`today.intelligent.provider.${suggestion.source.provider}`];

  return (
    <article className={`${styles.card!} ${styles.decisionCard!}`}>
      <span className={styles.icon!}>
        <ProductIcon name="globe" size="large" />
      </span>
      <div className={styles.cardBody!}>
        <h3 dir="auto">{suggestion.source.title}</h3>
        <p className={styles.meta!}>
          {catalog["today.intelligent.source"]}: {provider}
          {suggestion.projectName === null ? null : ` · ${suggestion.projectName}`}
        </p>
        <dl className={styles.explanation!}>
          <div>
            <dt>{catalog["today.intelligent.why"]}</dt>
            <dd>{suggestion.explanation}</dd>
          </div>
          <div>
            <dt>{catalog["today.intelligent.freshness"]}</dt>
            <dd>
              {suggestion.source.observedAt === null ? (
                catalog["today.intelligent.freshnessUnknown"]
              ) : (
                <time dateTime={suggestion.source.observedAt}>{suggestion.source.observedAt}</time>
              )}
            </dd>
          </div>
          <div>
            <dt>{catalog["today.intelligent.consequence"]}</dt>
            <dd>{catalog["today.intelligent.linkConsequence"]}</dd>
          </div>
        </dl>
        {correcting ? (
          <label className={styles.correctionField!}>
            <span>{catalog["today.intelligent.chooseProject"]}</span>
            <select
              disabled={busy}
              onChange={(event) => setProjectHandle(event.target.value)}
              value={projectHandle}
            >
              <option value="">{catalog["tasks.selectProject"]}</option>
              {projects.map((project) => (
                <option key={project.handle} value={project.handle}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {stale ? (
          <div className={styles.recovery!} role="alert">
            <p>{catalog["today.intelligent.stale"]}</p>
            <ActionButton onPress={() => void onReload()} variant="secondary">
              {catalog["today.intelligent.reload"]}
            </ActionButton>
          </div>
        ) : null}
        {error ? (
          <p className={styles.recovery!} role="alert">
            {catalog["today.intelligent.decisionError"]}
          </p>
        ) : null}
      </div>
      <div className={styles.actions!}>
        <ActionButton
          isDisabled={
            busy ||
            (!correcting && suggestion.projectName === null) ||
            (correcting && projectHandle === "")
          }
          onPress={() => void decide("confirm")}
          variant="primary"
        >
          {catalog["today.intelligent.confirm"]}
        </ActionButton>
        <ActionButton isDisabled={busy} onPress={() => setCorrecting(true)} variant="secondary">
          {catalog["today.intelligent.correct"]}
        </ActionButton>
        <ActionButton isDisabled={busy} onPress={() => void decide("dismiss")} variant="quiet">
          {catalog["today.intelligent.dismiss"]}
        </ActionButton>
      </div>
    </article>
  );
}
