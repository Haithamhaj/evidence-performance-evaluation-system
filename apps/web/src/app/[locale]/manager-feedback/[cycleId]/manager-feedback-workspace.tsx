"use client";

import { useMemo, useState } from "react";

import styles from "./manager-feedback-workspace.module.css";

type Rating = 1 | 2 | 3 | 4 | 5;
type RubricCriterion = Readonly<{
  id: string;
  title: string;
  definition: string;
  commentPrompt: string;
  anchors: readonly Readonly<{ rating: Rating; text: string }>[];
}>;

export function ManagerFeedbackWorkspace({
  catalog,
  experience,
  locale,
  rubric,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  experience: import("../../../../platform/manager-evaluation-client").ManagerFeedbackExperience;
  locale: import("@evaluation/localization").Locale;
  rubric: readonly RubricCriterion[];
}>) {
  if (experience.kind === "manager") {
    return <ManagerView catalog={catalog} rubric={rubric} view={experience.view} />;
  }
  return (
    <ParticipantForm catalog={catalog} experience={experience} locale={locale} rubric={rubric} />
  );
}

// JSX-only references are removed before the repository's base unused-variable rule runs.
// eslint-disable-next-line no-unused-vars
function ParticipantForm({
  catalog,
  experience,
  locale,
  rubric,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  experience: Extract<
    import("../../../../platform/manager-evaluation-client").ManagerFeedbackExperience,
    { kind: "participant" }
  >;
  locale: import("@evaluation/localization").Locale;
  rubric: readonly RubricCriterion[];
}>) {
  const journey = experience.journey;
  const [activeIndex, setActiveIndex] = useState(0);
  const [responses, setResponses] = useState<
    Record<string, { rating: Rating | null; comment: string }>
  >(() =>
    Object.fromEntries(
      journey.criteria.map((criterion) => [criterion.criterionId, { rating: null, comment: "" }]),
    ),
  );
  const [confirmed, setConfirmed] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "submitted" | "error">("idle");
  const current = journey.criteria[activeIndex]!;
  const content = rubric.find(({ id }) => id === current.stableCriterionId)!;
  const response = responses[current.criterionId]!;
  const complete = useMemo(
    () =>
      journey.criteria.every((criterion) => {
        const value = responses[criterion.criterionId];
        return (
          value !== undefined &&
          value.rating !== null &&
          (!criterion.commentRequired || value.comment.trim() !== "")
        );
      }),
    [journey.criteria, responses],
  );

  if (journey.submittedResponse !== null || state === "submitted") {
    return (
      <article className={styles.workspace!} data-testid="manager-feedback-participant-receipt">
        <p className={styles.eyebrow!}>{catalog["managerFeedback.eyebrow"]}</p>
        <h1>{catalog["managerFeedback.submittedTitle"]}</h1>
        <p role="status">{catalog["managerFeedback.submittedTitle"]}</p>
        <p>{catalog["managerFeedback.submittedBody"]}</p>
      </article>
    );
  }

  async function submit() {
    if (!complete || !confirmed || state === "saving") return;
    setState("saving");
    try {
      const result = await fetch(`/api/manager-feedback/cycles/${journey.cycle.id}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: journey.eligibility.version,
          identifiedNoticeConfirmed: true,
          responses: journey.criteria.map((criterion) => ({
            criterionId: criterion.criterionId,
            rating: responses[criterion.criterionId]!.rating,
            comment: responses[criterion.criterionId]!.comment.trim(),
          })),
        }),
      });
      if (!result.ok) throw new Error("manager feedback submission failed");
      setState("submitted");
    } catch {
      setState("error");
    }
  }

  return (
    <article
      className={styles.workspace!}
      data-testid="manager-feedback-participant-form"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <header className={styles.header!}>
        <div>
          <p className={styles.eyebrow!}>{catalog["managerFeedback.eyebrow"]}</p>
          <h1>
            {catalog["managerFeedback.feedbackFor"].replace(
              "{manager}",
              journey.manager.displayName,
            )}
          </h1>
          <p>{catalog["managerFeedback.employeeIntro"]}</p>
        </div>
        <span className={styles.identified!}>{catalog["managerFeedback.identifiedBadge"]}</span>
      </header>
      <section className={styles.notice!} aria-label={catalog["managerFeedback.visibilityNotice"]}>
        <strong>{catalog["managerFeedback.visibilityNotice"]}</strong>
        <p>
          {catalog["managerFeedback.visibilityDetail"].replace(
            "{manager}",
            journey.manager.displayName,
          )}
        </p>
      </section>
      <div className={styles.progress!}>
        <span>
          {catalog["managerFeedback.criterionPosition"]
            .replace("{current}", String(activeIndex + 1))
            .replace("{total}", String(journey.criteria.length))}
        </span>
        <progress max={journey.criteria.length} value={activeIndex + 1} />
      </div>
      <section className={styles.criterion!} key={current.criterionId}>
        <h2>{content.title}</h2>
        <p>{content.definition}</p>
        <fieldset aria-label={`${catalog["managerFeedback.chooseRating"]} ${content.title}`}>
          <legend>{catalog["managerFeedback.chooseRating"]}</legend>
          <div className={styles.anchors!}>
            {current.anchors.map((anchor) => (
              <label data-selected={response.rating === anchor.rating} key={anchor.rating}>
                <input
                  checked={response.rating === anchor.rating}
                  name={`manager-feedback-${current.criterionId}`}
                  onChange={() =>
                    setResponses((values) => ({
                      ...values,
                      [current.criterionId]: { ...response, rating: anchor.rating },
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
        <label className={styles.comment!}>
          <span>{catalog["managerFeedback.commentLabel"]}</span>
          <small>{content.commentPrompt}</small>
          <textarea
            aria-label={catalog["managerFeedback.commentLabel"]}
            onChange={(event) =>
              setResponses((values) => ({
                ...values,
                [current.criterionId]: { ...response, comment: event.target.value },
              }))
            }
            value={response.comment}
          />
        </label>
      </section>
      <div className={styles.navigation!}>
        <button
          disabled={activeIndex === 0}
          onClick={() => setActiveIndex((value) => Math.max(0, value - 1))}
          type="button"
        >
          {catalog["managerFeedback.previousCriterion"]}
        </button>
        {activeIndex < journey.criteria.length - 1 ? (
          <button onClick={() => setActiveIndex((value) => value + 1)} type="button">
            {catalog["managerFeedback.nextCriterion"]}
          </button>
        ) : (
          <span>{catalog["managerFeedback.reviewConfirmation"]}</span>
        )}
      </div>
      <footer className={styles.confirmation!}>
        <label>
          <input
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            type="checkbox"
          />
          {catalog["managerFeedback.identifiedConfirmation"].replace(
            "{manager}",
            journey.manager.displayName,
          )}
        </label>
        <button
          disabled={!complete || !confirmed || state === "saving"}
          onClick={submit}
          type="button"
        >
          {state === "saving"
            ? catalog["managerFeedback.submitting"]
            : catalog["managerFeedback.submit"]}
        </button>
        <p aria-live="polite" role="status">
          {state === "error" ? catalog["managerFeedback.submitFailed"] : ""}
        </p>
      </footer>
      <p className={styles.boundary!}>{catalog["managerFeedback.noAiDecision"]}</p>
    </article>
  );
}

// JSX-only references are removed before the repository's base unused-variable rule runs.
// eslint-disable-next-line no-unused-vars
function ManagerView({
  catalog,
  rubric,
  view,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  rubric: readonly RubricCriterion[];
  view: import("../../../../platform/manager-evaluation-client").IdentifiedManagerView;
}>) {
  return (
    <article className={styles.workspace!} data-testid="manager-feedback-identified-view">
      <header className={styles.header!}>
        <div>
          <p className={styles.eyebrow!}>{catalog["managerFeedback.eyebrow"]}</p>
          <h1>{catalog["managerFeedback.managerTitle"]}</h1>
          <p>{catalog["feedback.identifiedNotice"]}</p>
        </div>
        <span className={styles.identified!}>{catalog["managerFeedback.identifiedBadge"]}</span>
      </header>
      <dl className={styles.summary!}>
        <div>
          <dt>{catalog["managerFeedback.submitted"]}</dt>
          <dd>{view.completion.submitted}</dd>
        </div>
        <div>
          <dt>{catalog["managerFeedback.pending"]}</dt>
          <dd>{view.completion.pending}</dd>
        </div>
        <div>
          <dt>{catalog["managerFeedback.approvedLeave"]}</dt>
          <dd>{view.completion.approvedLeave}</dd>
        </div>
      </dl>
      <section className={styles.originals!}>
        <h2>{catalog["managerFeedback.originals"]}</h2>
        {view.responses.map((response) => (
          <article key={response.responseId}>
            <header>
              <strong>{response.submitterDisplayName}</strong>
              <time>{response.submittedAt}</time>
            </header>
            {response.responses.map((entry, index) => {
              const content = rubric[index];
              return (
                <div key={entry.criterionId}>
                  <span>{content?.title ?? catalog["managerFeedback.rating"]}</span>
                  <strong>{entry.rating}/5</strong>
                  {entry.comment ? <p>{entry.comment}</p> : null}
                </div>
              );
            })}
          </article>
        ))}
      </section>
      <p className={styles.boundary!}>{catalog["managerFeedback.aiBoundary"]}</p>
    </article>
  );
}
