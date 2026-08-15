"use client";

import { createElement, useEffect, useState } from "react";

import {
  confirmResearchDecision,
  confirmResearchProposals,
  createResearchExperiment,
  createResearchRecord,
  listResearchExperiments,
  listResearchRecords,
  startResearchSourceReview,
} from "../../../../../platform/research-experiments-api";
import { ExperimentSheet } from "./experiment-sheet";
import { ResearchSourceReviewSheet } from "./source-review-sheet";

type ProjectContext = Readonly<{ name: string }>;

export function ResearchWorkspace({
  catalog,
  locale,
  project,
  projectId,
  initialResearchRecords = [],
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  locale: import("@evaluation/localization").Locale;
  project: ProjectContext;
  projectId: string;
  initialResearchRecords?: readonly import("../../../../../platform/research-experiments-contracts").WebResearchRecord[];
}>) {
  const [review, setReview] = useState<
    import("../../../../../platform/research-experiments-contracts").WebResearchSourceReview | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatingExperiment, setCreatingExperiment] = useState<string | null>(null);
  const [confirmingDecision, setConfirmingDecision] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [researchRecords, setResearchRecords] = useState(initialResearchRecords);
  const [experiments, setExperiments] = useState<
    readonly import("../../../../../platform/research-experiments-contracts").WebExperimentRecord[]
  >([]);
  const [confirmationState, setConfirmationState] = useState<
    "idle" | "confirming" | "confirmed" | "failed"
  >("idle");

  useEffect(() => {
    let active = true;
    void listResearchRecords(projectId)
      .then((records) => {
        if (active) {
          setResearchRecords((current) => [
            ...current,
            ...records.filter((record) => !current.some(({ handle }) => handle === record.handle)),
          ]);
        }
      })
      .catch(() => {
        // Keep the last trustworthy local view; creation and source review remain available.
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (researchRecords.length === 0) return;
    let active = true;
    void Promise.all(researchRecords.map(({ handle }) => listResearchExperiments(handle)))
      .then((groups) => {
        if (active) setExperiments(groups.flat());
      })
      .catch(() => {
        // Preserve the last trustworthy Experiment view when refresh fails.
      });
    return () => {
      active = false;
    };
  }, [researchRecords]);

  return (
    <ResearchWorkspaceView
      catalog={catalog}
      locale={locale}
      project={project}
      researchRecords={researchRecords}
      review={review}
      experiments={experiments}
      busy={busy}
      confirmationState={confirmationState}
      error={error}
      onInvestigate={(value) => {
        let url: URL;
        try {
          url = new URL(value);
        } catch {
          setError(true);
          return;
        }
        setBusy(true);
        setError(false);
        void startResearchSourceReview({ projectId, url: url.toString() })
          .then((nextReview) => {
            setReview(nextReview);
            setConfirmationState("idle");
          })
          .catch(() => setError(true))
          .finally(() => setBusy(false));
      }}
      onConfirm={(proposalHandles) => {
        if (review === null) return;
        setConfirmationState("confirming");
        void confirmResearchProposals({
          reviewHandle: review.handle,
          expectedVersion: review.version,
          proposalHandles,
          reason: "Employee reviewed and confirmed the editable proposals.",
        })
          .then(() => setConfirmationState("confirmed"))
          .catch(() => setConfirmationState("failed"));
      }}
      onCreateResearch={(input) => {
        setCreating(true);
        setError(false);
        void createResearchRecord({
          projectId,
          question: input.question,
          relevance: input.relevance,
          assumptions: [...input.assumptions],
          constraints: [...input.constraints],
        })
          .then((record) => setResearchRecords((current) => [record, ...current]))
          .catch(() => setError(true))
          .finally(() => setCreating(false));
      }}
      onCreateExperiment={(researchHandle, input) => {
        setCreatingExperiment(researchHandle);
        setError(false);
        void createResearchExperiment(researchHandle, input)
          .then((experiment) => setExperiments((current) => [experiment, ...current]))
          .catch(() => setError(true))
          .finally(() => setCreatingExperiment(null));
      }}
      onConfirmDecision={(researchHandle, input) => {
        setConfirmingDecision(researchHandle);
        setError(false);
        void confirmResearchDecision(researchHandle, input)
          .then(() => listResearchRecords(projectId))
          .then((records) => setResearchRecords(records))
          .catch(() => setError(true))
          .finally(() => setConfirmingDecision(null));
      }}
      confirmingDecision={confirmingDecision}
      creatingExperiment={creatingExperiment}
      creating={creating}
    />
  );
}

export function ResearchWorkspaceView({
  busy = false,
  catalog,
  confirmationState = "idle",
  creating = false,
  creatingExperiment = null,
  confirmingDecision = null,
  error = false,
  experiments,
  locale,
  onConfirm,
  onConfirmDecision,
  onCreateExperiment,
  onCreateResearch,
  onInvestigate,
  project,
  researchRecords,
  review,
}: Readonly<{
  busy?: boolean;
  catalog: import("@evaluation/localization").Catalog;
  confirmationState?: "idle" | "confirming" | "confirmed" | "failed";
  creating?: boolean;
  creatingExperiment?: string | null;
  confirmingDecision?: string | null;
  error?: boolean;
  experiments: readonly import("./experiment-sheet").ResearchExperimentView[];
  locale: import("@evaluation/localization").Locale;
  onConfirm?: (proposalHandles: readonly string[]) => void;
  onConfirmDecision?: (researchHandle: string, input: ResearchDecisionDraft) => void;
  onCreateExperiment?: (
    researchHandle: string,
    input: Readonly<{
      title: string;
      hypothesis: string;
      baseline: string;
      measure: string;
      testCase: string;
      control: string;
      versions: string;
      reproducibility: string;
    }>,
  ) => void;
  onCreateResearch?: (
    input: Readonly<{
      question: string;
      relevance: string;
      assumptions: readonly string[];
      constraints: readonly string[];
    }>,
  ) => void;
  onInvestigate?: (value: string) => void;
  project: ProjectContext;
  researchRecords: readonly import("../../../../../platform/research-experiments-contracts").WebResearchRecord[];
  review:
    import("../../../../../platform/research-experiments-contracts").WebResearchSourceReview | null;
}>) {
  return (
    <section
      aria-labelledby="research-workspace-title"
      className="researchWorkspace researchWorkspaceMobileBoundary"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <header className="compactPageHeading">
        <div>
          <p className="eyebrow">{catalog["research.eyebrow"]}</p>
          <h1 id="research-workspace-title">{catalog["research.title"]}</h1>
          <p dir="auto">{project.name}</p>
        </div>
      </header>

      {createElement(ResearchQuestionPanel, {
        catalog,
        creating,
        ...(onCreateResearch === undefined ? {} : { onCreateResearch }),
      })}

      <form
        className="panel researchCapture"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          onInvestigate?.(String(form.get("research-input") ?? ""));
        }}
      >
        <label htmlFor="research-input">{catalog["research.captureLabel"]}</label>
        <div>
          <input
            id="research-input"
            name="research-input"
            placeholder={catalog["research.capturePlaceholder"]}
            required
            type="text"
          />
          <button className="primaryAction" disabled={busy} type="submit">
            {busy ? catalog["research.investigating"] : catalog["research.investigate"]}
          </button>
        </div>
        <p className="formHint">{catalog["research.oneQuestionAtATime"]}</p>
        {error ? (
          <p className="formError" role="alert">
            {catalog["research.safeError"]}
          </p>
        ) : null}
      </form>

      {review?.output === null || review === null ? null : (
        <article className="panel researchCitedCard">
          <header>
            <div>
              <p className="eyebrow">{catalog["research.sourceReview"]}</p>
              <h2 dir="auto">{review.output.summary}</h2>
            </div>
            <button className="quietButton" type="button">
              {catalog["research.editProposals"]}
            </button>
          </header>
          {review.displayUrl === null ? null : (
            <a href={review.displayUrl} rel="noreferrer" target="_blank">
              <bdi dir="ltr">
                {new URL(review.displayUrl).host + new URL(review.displayUrl).pathname}
              </bdi>
            </a>
          )}
          <div className="researchInsightGrid">
            {createElement(ResearchInsight, {
              title: catalog["research.whyHelpful"],
              values: [review.output.relevance, ...review.output.benefits],
            })}
            {createElement(ResearchInsight, {
              title: catalog["research.mismatch"],
              values: review.output.mismatches,
            })}
            {createElement(ResearchInsight, {
              title: catalog["research.risks"],
              values: review.output.risks,
            })}
            {createElement(ResearchInsight, {
              title: catalog["research.uncertainty"],
              values: review.output.uncertainties,
            })}
            {createElement(ResearchInsight, {
              title: catalog["research.nextActions"],
              values: review.output.proposals.map((proposal) => proposal.title),
            })}
          </div>
          <ul className="researchCitations">
            {review.output.citations.map((citation) => (
              <li key={`${citation.label}:${citation.locator}`}>
                {citation.label} · <bdi dir="auto">{citation.locator}</bdi>
              </li>
            ))}
          </ul>
          <section className="researchSafetyNote">
            <h3>{catalog["research.licensingPrivacy"]}</h3>
            <p>{catalog["research.licensingPrivacyBody"]}</p>
          </section>
          <p className="boundaryNote">{catalog["research.noAutomaticTask"]}</p>
        </article>
      )}

      {researchRecords.length === 0 ? (
        <section className="panel researchEmpty">
          <h2>{catalog["research.emptyTitle"]}</h2>
          <p>{catalog["research.emptyBody"]}</p>
        </section>
      ) : (
        <section aria-labelledby="research-questions-title" className="researchRecordList">
          <header className="researchSectionHeading">
            <div>
              <p className="eyebrow">{catalog["research.activeEyebrow"]}</p>
              <h2 id="research-questions-title">{catalog["research.activeQuestions"]}</h2>
            </div>
          </header>
          {researchRecords.map((record) =>
            createElement(ResearchRecordCard, {
              catalog,
              creating: creatingExperiment === record.handle,
              confirmingDecision: confirmingDecision === record.handle,
              key: record.handle,
              ...(onConfirmDecision === undefined ? {} : { onConfirmDecision }),
              ...(onCreateExperiment === undefined ? {} : { onCreateExperiment }),
              record,
              review,
            }),
          )}
        </section>
      )}

      {review?.output === null || review === null
        ? null
        : createElement(ResearchSynthesis, { catalog, review })}

      {createElement(ResearchAgentBrief, {
        catalog,
        experiments,
        researchRecords,
        review,
      })}

      {createElement(ResearchMeaningfulTrail, {
        catalog,
        experiments,
        researchRecords,
        review,
      })}

      <details className="panel researchDetails">
        <summary>{catalog["research.methodDetails"]}</summary>
        <p>{catalog["research.methodDetailsBody"]}</p>
        <p>
          <bdi dir="ltr">{catalog["research.modelName"]}</bdi>
        </p>
      </details>
      {createElement(ExperimentSheet, { catalog, experiments })}
      {confirmationState === "confirmed" ? (
        <section aria-live="polite" className="panel researchConfirmationResult">
          <h2>{catalog["research.confirmedTitle"]}</h2>
          <p>{catalog["research.confirmedBody"]}</p>
        </section>
      ) : null}
      {confirmationState === "failed" ? (
        <p className="formError" role="alert">
          {catalog["research.confirmationRecovery"]}
        </p>
      ) : null}
      {review === null || confirmationState === "confirmed"
        ? null
        : createElement(ResearchSourceReviewSheet, {
            catalog,
            confirming: confirmationState === "confirming",
            ...(onConfirm === undefined ? {} : { onConfirm }),
            review,
          })}
    </section>
  );
}

function ResearchQuestionPanel({
  catalog,
  creating,
  onCreateResearch,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  creating: boolean;
  onCreateResearch?: (
    input: Readonly<{
      question: string;
      relevance: string;
      assumptions: readonly string[];
      constraints: readonly string[];
    }>,
  ) => void;
}>) {
  return (
    <details className="panel researchQuestionPanel" open>
      <summary>{catalog["research.frameQuestion"]}</summary>
      <p>{catalog["research.frameQuestionBody"]}</p>
      <form
        className="researchQuestionForm"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          onCreateResearch?.({
            question: String(form.get("question") ?? ""),
            relevance: String(form.get("relevance") ?? ""),
            assumptions: lines(form.get("assumptions")),
            constraints: lines(form.get("constraints")),
          });
        }}
      >
        <label>
          <span>{catalog["research.questionLabel"]}</span>
          <textarea name="question" required />
        </label>
        <label>
          <span>{catalog["research.relevanceLabel"]}</span>
          <textarea name="relevance" required />
        </label>
        <div className="researchQuestionColumns">
          <label>
            <span>{catalog["research.assumptions"]}</span>
            <textarea name="assumptions" placeholder={catalog["research.onePerLine"]} />
          </label>
          <label>
            <span>{catalog["research.constraints"]}</span>
            <textarea name="constraints" placeholder={catalog["research.onePerLine"]} />
          </label>
        </div>
        <p className="boundaryNote">{catalog["research.humanOwnsQuestion"]}</p>
        <button className="primaryAction" disabled={creating} type="submit">
          {creating ? catalog["research.creatingQuestion"] : catalog["research.createQuestion"]}
        </button>
      </form>
    </details>
  );
}

function ResearchRecordCard({
  catalog,
  confirmingDecision,
  creating,
  onConfirmDecision,
  onCreateExperiment,
  record,
  review,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  confirmingDecision: boolean;
  creating: boolean;
  onConfirmDecision?: (researchHandle: string, input: ResearchDecisionDraft) => void;
  onCreateExperiment?: (
    researchHandle: string,
    input: Readonly<{
      title: string;
      hypothesis: string;
      baseline: string;
      measure: string;
      testCase: string;
      control: string;
      versions: string;
      reproducibility: string;
    }>,
  ) => void;
  record: import("../../../../../platform/research-experiments-contracts").WebResearchRecord;
  review:
    import("../../../../../platform/research-experiments-contracts").WebResearchSourceReview | null;
}>) {
  return (
    <article className="panel researchRecordCard">
      <header>
        <div>
          <p className="eyebrow">{catalog["research.questionHeading"]}</p>
          <h3 dir="auto">{record.question}</h3>
        </div>
        <span className="statusBadge">{catalog[`research.recordState.${record.state}`]}</span>
      </header>
      <p dir="auto">
        <strong>{catalog["research.relevanceLabel"]}: </strong>
        {record.objective}
      </p>
      <div className="researchInsightGrid">
        <ResearchInsight title={catalog["research.assumptions"]} values={record.assumptions} />
        <ResearchInsight title={catalog["research.constraints"]} values={record.constraints} />
        <ResearchInsight
          title={catalog["research.unansweredQuestions"]}
          values={record.knownUncertainty}
        />
      </div>
      <p className="researchNextStep" dir="auto">
        <strong>{catalog["research.decisionQuestion"]}: </strong>
        {record.decisionQuestion}
      </p>
      {record.decision === null ? null : (
        <section className="researchDecisionRecord">
          <header>
            <div>
              <p className="eyebrow">{catalog["research.employeeDecision"]}</p>
              <h4>{catalog[`research.decision.${record.decision.decision}`]}</h4>
            </div>
            <span className="statusBadge">{catalog["research.employeeConfirmed"]}</span>
          </header>
          <p dir="auto">{record.decision.answer}</p>
          <p dir="auto">
            <strong>{catalog["research.rationale"]}: </strong>
            {record.decision.rationale}
          </p>
          <p dir="auto">
            <strong>{catalog["research.nextAction"]}: </strong>
            {record.decision.nextAction}
          </p>
          <ResearchInsight
            title={catalog["research.remainingUncertainty"]}
            values={record.decision.remainingUncertainty}
          />
        </section>
      )}
      {record.appliedLearning.length === 0 ? null : (
        <section className="researchAppliedLearning">
          <h4>{catalog["research.appliedLearning"]}</h4>
          {record.appliedLearning.map((learning) => (
            <article key={`${learning.targetKind}:${learning.confirmedAt}`}>
              <span className="statusBadge">
                {catalog[`research.learningTarget.${learning.targetKind}`]}
              </span>
              <p dir="auto">{learning.whatChanged}</p>
              <p dir="auto">{learning.causalRationale}</p>
            </article>
          ))}
        </section>
      )}
      {record.decision !== null
        ? null
        : createElement(ResearchDecisionComposer, {
            catalog,
            confirming: confirmingDecision,
            ...(onConfirmDecision === undefined ? {} : { onConfirmDecision }),
            record,
            review,
          })}
      <details className="researchExperimentPlanner">
        <summary>{catalog["research.planExperiment"]}</summary>
        <form
          className="researchExperimentForm"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            onCreateExperiment?.(record.handle, {
              title: String(form.get("title") ?? ""),
              hypothesis: String(form.get("hypothesis") ?? ""),
              baseline: String(form.get("baseline") ?? ""),
              measure: String(form.get("measure") ?? ""),
              testCase: String(form.get("testCase") ?? ""),
              control: String(form.get("control") ?? ""),
              versions: String(form.get("versions") ?? ""),
              reproducibility: String(form.get("reproducibility") ?? ""),
            });
          }}
        >
          {[
            ["title", catalog["research.experimentTitle"]],
            ["hypothesis", catalog["research.hypothesis"]],
            ["baseline", catalog["research.baseline"]],
            ["measure", catalog["research.measures"]],
            ["testCase", catalog["research.testCases"]],
            ["control", catalog["research.controls"]],
            ["versions", catalog["research.versionsConditions"]],
            ["reproducibility", catalog["research.reproducibility"]],
          ].map(([name, label]) => (
            <label key={name}>
              <span>{label}</span>
              <textarea name={name} required />
            </label>
          ))}
          <p className="boundaryNote">{catalog["research.experimentBoundary"]}</p>
          <button className="primaryAction" disabled={creating} type="submit">
            {creating
              ? catalog["research.creatingExperiment"]
              : catalog["research.createExperiment"]}
          </button>
        </form>
      </details>
    </article>
  );
}

type ResearchDecisionDraft = Readonly<{
  synthesis: string;
  answer: string;
  remainingUncertainty: string[];
  decision: "ADOPT" | "REJECT" | "DEFER" | "REFINE" | "RUN_ANOTHER_EXPERIMENT" | "NO_DECISION";
  rationale: string;
  nextAction: string;
  source: Readonly<{ url: string; title: string; relevance: string; credibility: string }>;
  appliedChange: string;
}>;

function ResearchDecisionComposer({
  catalog,
  confirming,
  onConfirmDecision,
  record,
  review,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  confirming: boolean;
  onConfirmDecision?: (researchHandle: string, input: ResearchDecisionDraft) => void;
  record: import("../../../../../platform/research-experiments-contracts").WebResearchRecord;
  review:
    import("../../../../../platform/research-experiments-contracts").WebResearchSourceReview | null;
}>) {
  const output = review?.output ?? null;
  const existingSource = record.sources.at(-1) ?? null;
  const sourceUrl = review?.displayUrl ?? existingSource?.url ?? "";
  return (
    <details className="researchDecisionComposer">
      <summary>{catalog["research.reviewDecision"]}</summary>
      <p>{catalog["research.decisionDraftBody"]}</p>
      <form
        className="researchDecisionForm"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          onConfirmDecision?.(record.handle, {
            synthesis: String(form.get("synthesis") ?? ""),
            answer: String(form.get("answer") ?? ""),
            remainingUncertainty: lines(form.get("remainingUncertainty")),
            decision: String(
              form.get("decision") ?? "NO_DECISION",
            ) as ResearchDecisionDraft["decision"],
            rationale: String(form.get("rationale") ?? ""),
            nextAction: String(form.get("nextAction") ?? ""),
            source: {
              url: String(form.get("sourceUrl") ?? ""),
              title: String(form.get("sourceTitle") ?? ""),
              relevance: String(form.get("sourceRelevance") ?? ""),
              credibility: String(form.get("sourceCredibility") ?? ""),
            },
            appliedChange: String(form.get("appliedChange") ?? ""),
          });
        }}
      >
        <label>
          <span>{catalog["research.synthesis"]}</span>
          <textarea defaultValue={output?.summary ?? ""} name="synthesis" required />
        </label>
        <label>
          <span>{catalog["research.answer"]}</span>
          <textarea name="answer" required />
        </label>
        <label>
          <span>{catalog["research.decisionLabel"]}</span>
          <select defaultValue="REFINE" name="decision">
            {(
              [
                "ADOPT",
                "REJECT",
                "DEFER",
                "REFINE",
                "RUN_ANOTHER_EXPERIMENT",
                "NO_DECISION",
              ] as const
            ).map((decision) => (
              <option key={decision} value={decision}>
                {catalog[`research.decision.${decision}`]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{catalog["research.rationale"]}</span>
          <textarea defaultValue={output?.relevance ?? ""} name="rationale" required />
        </label>
        <label>
          <span>{catalog["research.remainingUncertainty"]}</span>
          <textarea
            defaultValue={output?.uncertainties.join("\n") ?? ""}
            name="remainingUncertainty"
          />
        </label>
        <label>
          <span>{catalog["research.nextAction"]}</span>
          <textarea
            defaultValue={output?.proposals.at(0)?.title ?? ""}
            name="nextAction"
            required
          />
        </label>
        <fieldset>
          <legend>{catalog["research.confirmedSource"]}</legend>
          <label>
            <span>{catalog["research.sourceUrl"]}</span>
            <input defaultValue={sourceUrl} name="sourceUrl" required type="url" />
          </label>
          <label>
            <span>{catalog["research.sourceTitle"]}</span>
            <input
              defaultValue={existingSource?.title ?? output?.summary ?? ""}
              name="sourceTitle"
              required
            />
          </label>
          <label>
            <span>{catalog["research.sourceRelevance"]}</span>
            <textarea
              defaultValue={existingSource?.relevance ?? output?.relevance ?? ""}
              name="sourceRelevance"
              required
            />
          </label>
          <label>
            <span>{catalog["research.sourceCredibility"]}</span>
            <textarea
              defaultValue={
                existingSource?.credibility ?? catalog["research.sourceCredibilityDraft"]
              }
              name="sourceCredibility"
              required
            />
          </label>
        </fieldset>
        <label>
          <span>{catalog["research.appliedChange"]}</span>
          <textarea name="appliedChange" required />
        </label>
        <p className="boundaryNote">{catalog["research.decisionHumanGate"]}</p>
        <button className="primaryAction" disabled={confirming} type="submit">
          {confirming
            ? catalog["research.confirmingDecision"]
            : catalog["research.confirmDecision"]}
        </button>
      </form>
    </details>
  );
}

function ResearchSynthesis({
  catalog,
  review,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  review: import("../../../../../platform/research-experiments-contracts").WebResearchSourceReview;
}>) {
  if (review.output === null) return null;
  return (
    <section className="panel researchSynthesis">
      <header>
        <div>
          <p className="eyebrow">{catalog["research.synthesisEyebrow"]}</p>
          <h2>{catalog["research.synthesis"]}</h2>
        </div>
      </header>
      <div className="researchInsightGrid">
        <ResearchInsight
          title={catalog["research.claims"]}
          values={[review.output.summary, ...review.output.benefits]}
        />
        <ResearchInsight
          title={catalog["research.contradictions"]}
          values={review.output.mismatches}
        />
        <ResearchInsight
          title={catalog["research.confidenceBoundaries"]}
          values={review.output.risks}
        />
        <ResearchInsight
          title={catalog["research.unansweredQuestions"]}
          values={review.output.uncertainties}
        />
      </div>
      <p className="boundaryNote">{catalog["research.synthesisBoundary"]}</p>
    </section>
  );
}

function ResearchAgentBrief({
  catalog,
  experiments,
  researchRecords,
  review,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  experiments: readonly import("./experiment-sheet").ResearchExperimentView[];
  researchRecords: readonly import("../../../../../platform/research-experiments-contracts").WebResearchRecord[];
  review:
    import("../../../../../platform/research-experiments-contracts").WebResearchSourceReview | null;
}>) {
  const [question, setQuestion] = useState<"focus" | "unknowns" | "experiment" | "decision">(
    "focus",
  );
  const output = review?.output ?? null;
  const unanswered =
    output?.uncertainties ?? researchRecords.flatMap((record) => record.knownUncertainty);
  const experimentProposal = output?.proposals.find((proposal) => proposal.kind === "EXPERIMENT");
  const hasResult = experiments.some(({ resultStatus }) => resultStatus !== null);
  const hasDecision = researchRecords.some(({ decision }) => decision !== null);
  const answer =
    question === "unknowns"
      ? (unanswered.at(0) ?? catalog["research.agentNoUnknowns"])
      : question === "experiment"
        ? (experimentProposal?.rationale ?? catalog["research.agentExperimentFallback"])
        : question === "decision"
          ? (output?.summary ?? catalog["research.agentDecisionFallback"])
          : !hasResult
            ? catalog["research.agentRunNext"]
            : !hasDecision
              ? catalog["research.agentReviewDecisionNext"]
              : catalog["research.agentApplyLearningNext"];
  return (
    <section className="panel researchAgentBrief">
      <header>
        <div>
          <p className="eyebrow">{catalog["research.agentEyebrow"]}</p>
          <h2>{catalog["research.agentTitle"]}</h2>
        </div>
        <span className="statusBadge">{catalog["research.sourceBacked"]}</span>
      </header>
      <div
        className="researchAgentQuestions"
        role="group"
        aria-label={catalog["research.agentTitle"]}
      >
        {(["focus", "unknowns", "experiment", "decision"] as const).map((item) => (
          <button
            aria-pressed={question === item}
            className="quietButton"
            key={item}
            onClick={() => setQuestion(item)}
            type="button"
          >
            {catalog[`research.agentQuestion.${item}`]}
          </button>
        ))}
      </div>
      <div className="researchAgentAnswer" role="status">
        <strong>{catalog["research.suggestedNextStep"]}</strong>
        <p dir="auto">{answer}</p>
      </div>
      <p className="boundaryNote">{catalog["research.agentBoundary"]}</p>
    </section>
  );
}

function ResearchMeaningfulTrail({
  catalog,
  experiments,
  researchRecords,
  review,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  experiments: readonly import("./experiment-sheet").ResearchExperimentView[];
  researchRecords: readonly import("../../../../../platform/research-experiments-contracts").WebResearchRecord[];
  review:
    import("../../../../../platform/research-experiments-contracts").WebResearchSourceReview | null;
}>) {
  const sourceReviewed = review?.output !== null && review !== null;
  const retainedResults = experiments.filter(({ resultStatus }) => resultStatus !== null);
  const decisions = researchRecords.flatMap((record) =>
    record.decision === null ? [] : [record.decision],
  );
  const learning = researchRecords.flatMap((record) => record.appliedLearning);
  const closureComplete = sourceReviewed && decisions.length > 0 && learning.length > 0;
  return (
    <section className="panel researchMeaningfulTrail">
      <header>
        <div>
          <p className="eyebrow">{catalog["research.trailEyebrow"]}</p>
          <h2>{catalog["research.meaningfulTrail"]}</h2>
        </div>
      </header>
      <ol>
        {sourceReviewed ? <li>{catalog["research.trailSourceReviewed"]}</li> : null}
        {retainedResults.map((experiment) => (
          <li dir="auto" key={experiment.handle}>
            {catalog[`research.resultStatus.${experiment.resultStatus!}`]} — {experiment.title}
          </li>
        ))}
        {decisions.map((decision) => (
          <li dir="auto" key={decision.confirmedAt}>
            {catalog["research.employeeDecision"]}: {decision.answer}
          </li>
        ))}
        {learning.map((item) => (
          <li dir="auto" key={`${item.targetKind}:${item.confirmedAt}`}>
            {catalog["research.appliedLearning"]}: {item.whatChanged}
          </li>
        ))}
      </ol>
      <section className="researchClosureCheck">
        <h3>{catalog["research.closureCheck"]}</h3>
        <ul>
          <li>
            {sourceReviewed ? catalog["research.checkDone"] : catalog["research.checkSource"]}
          </li>
          <li>
            {retainedResults.length > 0
              ? catalog["research.checkDone"]
              : catalog["research.checkResultOptional"]}
          </li>
          <li>
            {decisions.length > 0
              ? catalog["research.checkDone"]
              : catalog["research.checkDecision"]}
          </li>
          <li>
            {learning.length > 0
              ? catalog["research.checkDone"]
              : catalog["research.checkLearning"]}
          </li>
        </ul>
        <p className="boundaryNote">
          {closureComplete ? catalog["research.closureComplete"] : catalog["research.closureOpen"]}
        </p>
      </section>
    </section>
  );
}

function ResearchInsight({
  title,
  values,
}: Readonly<{ title: string; values: readonly string[] }>) {
  if (values.length === 0) return null;
  return (
    <section>
      <h3>{title}</h3>
      <ul>
        {values.map((value) => (
          <li dir="auto" key={value}>
            {value}
          </li>
        ))}
      </ul>
    </section>
  );
}

function lines(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
