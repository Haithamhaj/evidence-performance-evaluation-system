"use client";

/* eslint-disable no-unused-vars */
import type { Catalog } from "@evaluation/localization";
import { ProductIcon } from "@evaluation/ui";
import { useMemo, useState } from "react";

import type {
  EvaluationEntry,
  EvaluationFactSummary,
  EvaluationJourney,
  EvaluationRating,
} from "./evaluation-experience-contracts";
import styles from "./evaluation-workspace.module.css";

type EditableEntry = Readonly<{
  rating: EvaluationRating | null;
  justification: string;
  sourceReferences: ReadonlyArray<string>;
  directObservationBasis: string;
}>;

export function EvaluationWorkspace({
  catalog,
  factView,
  journey,
  locale,
}: Readonly<{
  catalog: Catalog;
  factView: EvaluationFactSummary;
  journey: EvaluationJourney;
  locale: "ar" | "en";
}>) {
  const isSelf = journey.audience === "self";
  const assessmentKind = isSelf ? "SELF" : "MANAGER_INITIAL";
  const currentDraft = journey.drafts.find(({ kind }) => kind === assessmentKind);
  const currentSubmission = journey.submissions.find(({ kind }) => kind === assessmentKind);
  const selfSubmission = journey.submissions.find(({ kind }) => kind === "SELF");
  const managerSubmission = journey.submissions.find(({ kind }) => kind === "MANAGER_INITIAL");
  const criteria = useMemo(
    () =>
      [...(journey.templateSnapshot?.items ?? [])].sort(
        (left, right) => left.displayOrder - right.displayOrder,
      ),
    [journey.templateSnapshot],
  );
  const [entries, setEntries] = useState<Record<string, EditableEntry>>(() =>
    Object.fromEntries(
      (currentDraft?.entries ?? currentSubmission?.entries ?? []).map((entry) => [
        entry.criterionId,
        {
          rating: entry.rating,
          justification: entry.justification,
          sourceReferences: entry.sourceReferences,
          directObservationBasis: entry.directObservationBasis ?? "",
        },
      ]),
    ),
  );
  const [activeCriterionId, setActiveCriterionId] = useState(
    () =>
      criteria.find((criterion) => {
        const entry = currentDraft?.entries.find(({ criterionId }) => criterionId === criterion.id);
        return entry?.rating === undefined || entry.justification.trim() === "";
      })?.id ?? criteria[0]?.id,
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [reviewed, setReviewed] = useState(false);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "submitted" | "error">(
    "idle",
  );
  const [wordingState, setWordingState] = useState<
    Record<string, "idle" | "drafting" | "drafted" | "error">
  >({});
  const [wordingLimitations, setWordingLimitations] = useState<Record<string, string[]>>({});
  const [version, setVersion] = useState(currentDraft?.version ?? 1);
  const copy = copyFor(catalog);
  const submitted = currentSubmission !== undefined;
  const editableStage = isSelf
    ? journey.cycle.state === "SELF_ASSESSMENT"
    : journey.cycle.state === "MANAGER_ASSESSMENT";
  const canEdit = editableStage && !submitted;
  const factSourceIds = [
    ...factView.projectFacts,
    ...factView.confirmedEvidence,
    ...factView.researchFacts,
  ].map(({ sourceId }) => sourceId);
  const completedEntries = criteria.flatMap((criterion) => {
    const entry = entries[criterion.id];
    if (
      entry?.rating === null ||
      entry?.rating === undefined ||
      entry.justification.trim() === "" ||
      (!isSelf && entry.sourceReferences.length === 0 && entry.directObservationBasis.trim() === "")
    ) {
      return [];
    }
    return [
      {
        criterionId: criterion.id,
        rating: entry.rating,
        justification: entry.justification.trim(),
        sourceReferences: entry.sourceReferences,
        directObservationBasis:
          entry.directObservationBasis.trim() === "" ? null : entry.directObservationBasis.trim(),
      } satisfies EvaluationEntry,
    ];
  });
  const activeCriterionIndex = Math.max(
    0,
    criteria.findIndex(({ id }) => id === activeCriterionId),
  );
  const activeCriterion = criteria[activeCriterionIndex];

  async function saveDraft() {
    if (!canEdit || completedEntries.length === 0) return;
    setSaveState("saving");
    try {
      const response = await fetch(
        `/api/evaluation/assignments/${journey.assignment.id}/${isSelf ? "self-draft" : "manager-draft"}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ expectedVersion: version, entries: completedEntries }),
        },
      );
      const body = (await response.json()) as { version?: number };
      if (!response.ok || body.version === undefined) throw new Error("save failed");
      setVersion(body.version);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  async function submitAssessment() {
    if (
      !canEdit ||
      !reviewed ||
      saveState !== "saved" ||
      completedEntries.length !== criteria.length
    )
      return;
    setSubmitState("submitting");
    try {
      const response = await fetch(
        `/api/evaluation/assignments/${journey.assignment.id}/${isSelf ? "self-submit" : "manager-submit"}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ expectedVersion: version, reviewed: true }),
        },
      );
      if (!response.ok) throw new Error("submit failed");
      setSaveState("idle");
      setSubmitState("submitted");
      if (!isSelf) globalThis.location.reload();
    } catch {
      setSubmitState("error");
    }
  }

  async function draftWording(
    criterionId: string,
    selectedRating: EvaluationRating,
    selectedAnchor: string,
    userDraft: string,
  ) {
    if (!canEdit) return;
    setWordingState((current) => ({ ...current, [criterionId]: "drafting" }));
    try {
      const response = await fetch(
        `/api/evaluation/assignments/${journey.assignment.id}/wording-draft`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            criterionId,
            selectedRating,
            selectedAnchor,
            sourceReferences: factSourceIds,
            userDraft,
          }),
        },
      );
      const body = (await response.json()) as { draft?: string; limitations?: string[] };
      if (!response.ok || body.draft === undefined) throw new Error("draft failed");
      setEntries((current) => ({
        ...current,
        [criterionId]: {
          ...(current[criterionId] ?? {
            rating: selectedRating,
            sourceReferences: factSourceIds,
            directObservationBasis: "",
          }),
          justification: body.draft!,
          sourceReferences: factSourceIds,
        },
      }));
      setWordingLimitations((current) => ({
        ...current,
        [criterionId]: body.limitations ?? [],
      }));
      setWordingState((current) => ({ ...current, [criterionId]: "drafted" }));
    } catch {
      setWordingState((current) => ({ ...current, [criterionId]: "error" }));
    }
  }

  return (
    <section
      className={styles.workspace!}
      data-testid="evaluation-workspace"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <header className={styles.header!}>
        <div className={styles.titleIcon!}>
          <ProductIcon name="chart" size="large" />
        </div>
        <div>
          <p className={styles.eyebrow!}>{copy.eyebrow}</p>
          <h1>{isSelf ? copy.title : copy.managerTitle}</h1>
          <p>{isSelf ? copy.subtitle : copy.managerSubtitle}</p>
        </div>
      </header>

      <section className={styles.cycleOverview!} aria-label={copy.cycleOverview}>
        <div>
          <strong>{cycleType(copy, journey.cycle.type)}</strong>
          <span>{copy.humanDecision}</span>
        </div>
        <dl>
          <div>
            <dt>{copy.stage}</dt>
            <dd>{journey.audience === "self" ? copy.selfAssessment : copy.managerAssessment}</dd>
          </div>
          <div>
            <dt>{copy.deadline}</dt>
            <dd>{formatDate(journey.cycle.endsAt, locale)}</dd>
          </div>
          <div>
            <dt>{copy.visibility}</dt>
            <dd>{copy.identified}</dd>
          </div>
          <div>
            <dt>{copy.status}</dt>
            <dd>{stateLabel(journey.cycle.state)}</dd>
          </div>
        </dl>
        <p className={styles.visibilityNote!}>
          <ProductIcon name="shield" size="small" /> {copy.identifiedDetail}
        </p>
      </section>

      <section className={styles.facts!} aria-label={copy.sourceFacts}>
        <header>
          <div>
            <p className={styles.eyebrow!}>{copy.reviewFirst}</p>
            <h2>{copy.sourceFacts}</h2>
            <p>{copy.factBoundary}</p>
          </div>
          <a
            href={`/${locale}/evaluations/facts?cycle=${journey.cycle.id}&employee=${journey.assignment.employeeId}`}
          >
            {copy.openFactView}
          </a>
        </header>
        <div className={styles.factGrid!}>
          {factView.projectFacts.map((fact) => (
            <article key={fact.sourceId}>
              <span>
                <ProductIcon name="briefcase" size="small" /> {copy.workFact}
              </span>
              <strong>{fact.summary}</strong>
              {fact.result ? <p>{fact.result}</p> : null}
              <small>{copy.sourceSupported}</small>
            </article>
          ))}
          {factView.confirmedEvidence.map((fact) => (
            <article key={fact.sourceId}>
              <span>
                <ProductIcon name="document" size="small" /> {copy.evidence}
              </span>
              <strong>{fact.supportedClaim}</strong>
              <p>{fact.contributionContext}</p>
              <small>{copy.employeeConfirmed}</small>
            </article>
          ))}
          {factView.researchFacts.map((fact) => (
            <article key={fact.sourceId}>
              <span>
                <ProductIcon name="research" size="small" /> {copy.researchFact}
              </span>
              <strong>{fact.summary}</strong>
              <small>{copy.sourceSupported}</small>
            </article>
          ))}
        </div>
        {factView.sourceCoverageNotes.length === 0 ? null : (
          <aside className={styles.coverage!}>
            <strong>{copy.coverageNotes}</strong>
            <ul>
              {factView.sourceCoverageNotes.map((note) => (
                <li key={`${note.code}:${note.messageKey}`}>
                  {localizedCoverage(catalog, note.messageKey)}
                </li>
              ))}
            </ul>
          </aside>
        )}
      </section>

      <section className={styles.assessment!} aria-label={copy.yourAssessment}>
        <header>
          <div>
            <p className={styles.eyebrow!}>{copy.yourPerspective}</p>
            <h2>{copy.yourAssessment}</h2>
            <p>{copy.ratingBoundary}</p>
          </div>
          <span className={styles.progress!}>
            {completedEntries.length}/{criteria.length} {copy.complete}
          </span>
        </header>
        <nav className={styles.criterionNavigator!} aria-label={copy.criterionNavigation}>
          {criteria.map((criterion) => {
            const localized =
              criterion.locales.find((item) => item.locale === locale) ?? criterion.locales[0];
            if (!localized) return null;
            const entry = entries[criterion.id];
            const criterionState =
              entry?.rating !== null &&
              entry?.rating !== undefined &&
              entry.justification.trim() !== ""
                ? copy.criterionComplete
                : entry?.rating !== null && entry?.rating !== undefined
                  ? copy.criterionInProgress
                  : copy.criterionNotStarted;
            return (
              <button
                aria-current={criterion.id === activeCriterion?.id ? "step" : undefined}
                key={criterion.id}
                onClick={() => setActiveCriterionId(criterion.id)}
                type="button"
              >
                <span>{String(criterion.displayOrder).padStart(2, "0")}</span>
                <strong>{localized.title}</strong>
                <small>{criterionState}</small>
              </button>
            );
          })}
        </nav>
        {activeCriterion === undefined
          ? null
          : (() => {
              const localized =
                activeCriterion.locales.find((item) => item.locale === locale) ??
                activeCriterion.locales[0];
              if (!localized) return null;
              const entry = entries[activeCriterion.id] ?? {
                rating: null,
                justification: "",
                sourceReferences: [],
                directObservationBasis: "",
              };
              return (
                <article className={styles.criterion!} key={activeCriterion.id}>
                  <p className={styles.criterionPosition!}>
                    {copy.criterionPosition
                      .replace("{current}", String(activeCriterionIndex + 1))
                      .replace("{total}", String(criteria.length))}
                  </p>
                  <div className={styles.criterionHeading!}>
                    <span>{String(activeCriterion.displayOrder).padStart(2, "0")}</span>
                    <div>
                      <h3>{localized.title}</h3>
                      <p>{localized.definition}</p>
                    </div>
                  </div>
                  <fieldset
                    disabled={!canEdit}
                    aria-label={`${copy.ratingAnchors} ${localized.title}`}
                  >
                    <legend>{copy.chooseAnchor}</legend>
                    <div className={styles.anchors!}>
                      {localized.anchors.map((anchor) => (
                        <label key={anchor.rating} data-selected={entry.rating === anchor.rating}>
                          <input
                            checked={entry.rating === anchor.rating}
                            name={`rating-${activeCriterion.id}`}
                            onChange={() =>
                              setEntries((current) => ({
                                ...current,
                                [activeCriterion.id]: { ...entry, rating: anchor.rating },
                              }))
                            }
                            type="radio"
                          />
                          <strong>{anchor.rating}</strong>
                          <span>{anchor.text}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className={styles.reflection!}>
                    <span>{copy.reflection}</span>
                    <textarea
                      disabled={!canEdit}
                      onChange={(event) =>
                        setEntries((current) => ({
                          ...current,
                          [activeCriterion.id]: { ...entry, justification: event.target.value },
                        }))
                      }
                      placeholder={copy.reflectionPlaceholder}
                      value={entry.justification}
                    />
                  </label>
                  {!isSelf && entry.sourceReferences.length === 0 ? (
                    <label className={styles.reflection!}>
                      <span>{copy.directObservation}</span>
                      <textarea
                        disabled={!canEdit}
                        onChange={(event) =>
                          setEntries((current) => ({
                            ...current,
                            [activeCriterion.id]: {
                              ...entry,
                              directObservationBasis: event.target.value,
                            },
                          }))
                        }
                        placeholder={copy.directObservationPlaceholder}
                        value={entry.directObservationBasis}
                      />
                    </label>
                  ) : null}
                  {entry.rating === null ? null : (
                    <div className={styles.wordingSupport!}>
                      <button
                        disabled={!canEdit || wordingState[activeCriterion.id] === "drafting"}
                        onClick={() => {
                          const anchor = localized.anchors.find(
                            (candidate) => candidate.rating === entry.rating,
                          );
                          if (anchor) {
                            void draftWording(
                              activeCriterion.id,
                              entry.rating!,
                              anchor.text,
                              entry.justification,
                            );
                          }
                        }}
                        type="button"
                      >
                        <ProductIcon name="sparkles" size="small" />
                        {wordingState[activeCriterion.id] === "drafting"
                          ? copy.draftingReflection
                          : copy.draftReflection}
                      </button>
                      {wordingState[activeCriterion.id] === "drafted" ? (
                        <p role="status">{copy.reviewAssistantDraft}</p>
                      ) : null}
                      {wordingState[activeCriterion.id] === "error" ? (
                        <p role="alert">{copy.draftReflectionFailed}</p>
                      ) : null}
                      {(wordingLimitations[activeCriterion.id] ?? []).map((limitation) => (
                        <small key={limitation}>{limitation}</small>
                      ))}
                    </div>
                  )}
                  <div className={styles.criterionControls!}>
                    <button
                      disabled={activeCriterionIndex === 0}
                      onClick={() => setActiveCriterionId(criteria[activeCriterionIndex - 1]?.id)}
                      type="button"
                    >
                      {copy.previousCriterion}
                    </button>
                    <button
                      disabled={activeCriterionIndex === criteria.length - 1}
                      onClick={() => setActiveCriterionId(criteria[activeCriterionIndex + 1]?.id)}
                      type="button"
                    >
                      {copy.nextCriterion}
                    </button>
                  </div>
                </article>
              );
            })()}
        <footer className={styles.actions!}>
          <p>
            <ProductIcon name="sparkles" size="small" /> {copy.aiBoundary}
          </p>
          {saveState === "saved" ? <span role="status">{copy.saved}</span> : null}
          {saveState === "error" ? <span role="alert">{copy.saveFailed}</span> : null}
          {submitState === "submitted" ? <span role="status">{copy.submitted}</span> : null}
          {submitState === "error" ? <span role="alert">{copy.submitFailed}</span> : null}
          <button
            disabled={!canEdit || completedEntries.length === 0 || saveState === "saving"}
            onClick={saveDraft}
            type="button"
          >
            {saveState === "saving" ? copy.saving : copy.saveDraft}
          </button>
          {completedEntries.length === criteria.length && saveState === "saved" ? (
            <div className={styles.submitGate!}>
              <label>
                <input
                  checked={reviewed}
                  onChange={(event) => setReviewed(event.target.checked)}
                  type="checkbox"
                />
                <span>{copy.reviewed}</span>
              </label>
              <button
                disabled={!reviewed || submitState === "submitting"}
                onClick={submitAssessment}
                type="button"
              >
                {submitState === "submitting" ? copy.submitting : copy.submit}
              </button>
            </div>
          ) : null}
        </footer>
      </section>
      {selfSubmission !== undefined && managerSubmission !== undefined ? (
        <section className={styles.comparison!} aria-label={copy.comparisonTitle}>
          <header>
            <div>
              <p className={styles.eyebrow!}>{copy.comparisonEyebrow}</p>
              <h2>{copy.comparisonTitle}</h2>
              <p>{copy.comparisonBoundary}</p>
            </div>
          </header>
          <div className={styles.comparisonRows!}>
            {criteria.map((criterion) => {
              const localized =
                criterion.locales.find((item) => item.locale === locale) ?? criterion.locales[0];
              const self = selfSubmission.entries.find(
                ({ criterionId }) => criterionId === criterion.id,
              );
              const manager = managerSubmission.entries.find(
                ({ criterionId }) => criterionId === criterion.id,
              );
              if (!localized || self === undefined || manager === undefined) return null;
              return (
                <article key={criterion.id}>
                  <strong>{localized.title}</strong>
                  <span>
                    {copy.employeePosition}: {self.rating}
                  </span>
                  <span>
                    {copy.managerPosition}: {manager.rating}
                  </span>
                  <small>
                    {self.rating === manager.rating ? copy.positionsAligned : copy.discussionNeeded}
                  </small>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function formatDate(value: string, locale: "ar" | "en") {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Riyadh",
  }).format(new Date(value));
}

function stateLabel(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./u, (letter) => letter.toUpperCase());
}

function localizedCoverage(catalog: Catalog, key: string) {
  return (catalog as unknown as Record<string, string>)[key] ?? key;
}

function cycleType(copy: ReturnType<typeof copyFor>, type: EvaluationJourney["cycle"]["type"]) {
  return type === "CALIBRATION_NON_BASELINE" ? copy.calibration : copy.standard;
}

function copyFor(catalog: Catalog) {
  return {
    eyebrow: catalog["evaluation.workspace.eyebrow"],
    title: catalog["evaluation.workspace.title"],
    subtitle: catalog["evaluation.workspace.subtitle"],
    managerTitle: catalog["evaluation.workspace.managerTitle"],
    managerSubtitle: catalog["evaluation.workspace.managerSubtitle"],
    cycleOverview: catalog["evaluation.workspace.cycleOverview"],
    humanDecision: catalog["evaluation.workspace.humanDecision"],
    stage: catalog["evaluation.workspace.stage"],
    deadline: catalog["evaluation.workspace.deadline"],
    visibility: catalog["evaluation.workspace.visibility"],
    identified: catalog["evaluation.workspace.identified"],
    identifiedDetail: catalog["evaluation.workspace.identifiedDetail"],
    status: catalog["evaluation.workspace.status"],
    selfAssessment: catalog["evaluation.selfAssessment"],
    managerAssessment: catalog["evaluation.managerInitial"],
    calibration: catalog["evaluation.workspace.calibration"],
    standard: catalog["evaluation.workspace.standard"],
    reviewFirst: catalog["evaluation.workspace.reviewFirst"],
    sourceFacts: catalog["evaluation.workspace.sourceFacts"],
    factBoundary: catalog["evaluation.workspace.factBoundary"],
    openFactView: catalog["evaluation.workspace.openFactView"],
    workFact: catalog["evaluation.workspace.workFact"],
    evidence: catalog["evaluation.workspace.evidence"],
    researchFact: catalog["evaluation.workspace.researchFact"],
    sourceSupported: catalog["evaluation.workspace.sourceSupported"],
    employeeConfirmed: catalog["evaluation.workspace.employeeConfirmed"],
    coverageNotes: catalog["evaluation.coverageNotes"],
    yourPerspective: catalog["evaluation.workspace.yourPerspective"],
    yourAssessment: catalog["evaluation.workspace.yourAssessment"],
    ratingBoundary: catalog["evaluation.workspace.ratingBoundary"],
    complete: catalog["evaluation.workspace.complete"],
    criterionNavigation: catalog["evaluation.workspace.criterionNavigation"],
    criterionPosition: catalog["evaluation.workspace.criterionPosition"],
    criterionComplete: catalog["evaluation.workspace.criterionComplete"],
    criterionInProgress: catalog["evaluation.workspace.criterionInProgress"],
    criterionNotStarted: catalog["evaluation.workspace.criterionNotStarted"],
    previousCriterion: catalog["evaluation.workspace.previousCriterion"],
    nextCriterion: catalog["evaluation.workspace.nextCriterion"],
    ratingAnchors: catalog["evaluation.workspace.ratingAnchors"],
    chooseAnchor: catalog["evaluation.workspace.chooseAnchor"],
    reflection: catalog["evaluation.workspace.reflection"],
    reflectionPlaceholder: catalog["evaluation.workspace.reflectionPlaceholder"],
    directObservation: catalog["evaluation.workspace.directObservation"],
    directObservationPlaceholder: catalog["evaluation.workspace.directObservationPlaceholder"],
    draftReflection: catalog["evaluation.workspace.draftReflection"],
    draftingReflection: catalog["evaluation.workspace.draftingReflection"],
    reviewAssistantDraft: catalog["evaluation.workspace.reviewAssistantDraft"],
    draftReflectionFailed: catalog["evaluation.workspace.draftReflectionFailed"],
    aiBoundary: catalog["evaluation.workspace.aiBoundary"],
    saveDraft: catalog["evaluation.workspace.saveDraft"],
    saving: catalog["evaluation.workspace.saving"],
    saved: catalog["evaluation.workspace.saved"],
    saveFailed: catalog["evaluation.workspace.saveFailed"],
    reviewed: catalog["evaluation.workspace.reviewed"],
    submit: catalog["evaluation.workspace.submit"],
    submitting: catalog["evaluation.workspace.submitting"],
    submitted: catalog["evaluation.workspace.submitted"],
    submitFailed: catalog["evaluation.workspace.submitFailed"],
    comparisonEyebrow: catalog["evaluation.workspace.comparisonEyebrow"],
    comparisonTitle: catalog["evaluation.workspace.comparisonTitle"],
    comparisonBoundary: catalog["evaluation.workspace.comparisonBoundary"],
    employeePosition: catalog["evaluation.workspace.employeePosition"],
    managerPosition: catalog["evaluation.workspace.managerPosition"],
    positionsAligned: catalog["evaluation.workspace.positionsAligned"],
    discussionNeeded: catalog["evaluation.workspace.discussionNeeded"],
  };
}
