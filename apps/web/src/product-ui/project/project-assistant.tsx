/* eslint-disable no-unused-vars */
"use client";

import type { Catalog } from "@evaluation/localization";
import { useState } from "react";

import { askProject } from "../../platform/project-assistant-api";
import type {
  ProjectAssistantQuestion,
  WebProjectAssistantAnswer,
} from "../../platform/project-assistant-contracts";
import styles from "./project-workspace.module.css";

export function ProjectAssistant({
  ask = askProject,
  catalog,
  locale,
  projectId,
}: Readonly<{
  ask?(input: {
    projectId: string;
    locale: "ar" | "en";
    question: ProjectAssistantQuestion;
  }): Promise<WebProjectAssistantAnswer>;
  catalog: Catalog;
  locale: "ar" | "en";
  projectId: string;
}>) {
  const [answer, setAnswer] = useState<WebProjectAssistantAnswer | null>(null);
  const [loading, setLoading] = useState<ProjectAssistantQuestion | null>(null);
  const [failed, setFailed] = useState(false);

  const submit = (question: ProjectAssistantQuestion) => {
    setLoading(question);
    setFailed(false);
    void ask({ projectId, locale, question })
      .then(setAnswer)
      .catch(() => setFailed(true))
      .finally(() => setLoading(null));
  };

  return (
    <section className={styles.projectAssistant!} aria-label={catalog["project.assistant.title"]}>
      <p className={styles.eyebrow!}>{catalog["project.assistant.label"]}</p>
      <h2>{catalog["project.assistant.title"]}</h2>
      <p>{catalog["project.assistant.description"]}</p>
      <div className={styles.projectAssistantQuestions!}>
        <button disabled={loading !== null} onClick={() => submit("what_changed")} type="button">
          {catalog["project.assistant.whatChanged"]}
        </button>
        <button disabled={loading !== null} onClick={() => submit("why_blocked")} type="button">
          {catalog["project.assistant.whyBlocked"]}
        </button>
        <button
          disabled={loading !== null}
          onClick={() => submit("missing_evidence")}
          type="button"
        >
          {catalog["project.assistant.missingEvidence"]}
        </button>
        <button
          disabled={loading !== null}
          onClick={() => submit("explain_evidence_source")}
          type="button"
        >
          {catalog["project.assistant.explainEvidenceSource"]}
        </button>
        <button
          disabled={loading !== null}
          onClick={() => submit("revise_evidence_draft")}
          type="button"
        >
          {catalog["project.assistant.reviseEvidenceDraft"]}
        </button>
      </div>
      {loading === null ? null : <p aria-live="polite">{catalog["project.assistant.thinking"]}</p>}
      {failed ? (
        <p className={styles.projectAssistantError!} role="alert">
          {catalog["project.assistant.unavailable"]}
        </p>
      ) : null}
      {answer === null ? null : (
        <div className={styles.projectAssistantAnswer!} role="status">
          <p>{answer.answer}</p>
          <small>
            {answer.assistance === "ai_assisted"
              ? catalog["project.assistant.aiMode"]
              : catalog["project.assistant.fallbackMode"]}
            {" · "}
            {catalog["project.assistant.sources"].replace(
              "{count}",
              String(answer.sourceReferences.length),
            )}
          </small>
        </div>
      )}
      <small>{catalog["project.assistant.guardrail"]}</small>
    </section>
  );
}
