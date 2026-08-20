"use client";

import { createElement, useEffect, useRef, useState } from "react";

import { EvidenceReviewSheet } from "../../app/[locale]/evidence/evidence-review-sheet";
import {
  sourceReviewGateway,
  type SourceReviewSource as ConnectedSource,
} from "../../platform/source-review-api";

export type SourceReviewGateway = import("../../platform/source-review-api").SourceReviewGateway;
export type SourceReviewSource = import("../../platform/source-review-api").SourceReviewSource;
type SourceReviewProject = import("../../platform/source-review-api").SourceReviewProject;

type ManualSource = Readonly<{
  id: string;
  employeeId: string;
  text: string;
  projectId: string | null;
  createdAt: string;
}>;
type ReviewSource =
  | ConnectedSource
  | Readonly<{
      kind: "manual";
      id: string;
      title: string;
      summary: string;
      occurredAt: string;
      projectId: string | null;
    }>;

export function SourceReview({
  catalog,
  gateway = sourceReviewGateway,
  locale,
  manualSources,
  projects,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  gateway?: SourceReviewGateway;
  locale: import("@evaluation/localization").Locale;
  manualSources: readonly ManualSource[];
  projects: readonly SourceReviewProject[];
}>) {
  const manual = manualSources.map<ReviewSource>((item) => ({
    kind: "manual",
    id: item.id,
    title: item.text,
    summary: item.text,
    occurredAt: item.createdAt,
    projectId: item.projectId,
  }));
  const [connected, setConnected] = useState<readonly ConnectedSource[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<ReviewSource | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let active = true;
    gateway
      .load(projects)
      .then((sources) => {
        if (!active) return;
        setConnected(sources);
        setLoadError(false);
      })
      .catch(() => {
        if (!active) return;
        setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [gateway, projects]);

  const sources = [...connected, ...manual];
  return (
    <section
      aria-label={catalog["sourceReview.title"]}
      className="sourceReviewPanel panel"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <header className="sourceReviewHeader">
        <div>
          <p className="eyebrow">{catalog["sourceReview.eyebrow"]}</p>
          <h2>{catalog["sourceReview.title"]}</h2>
          <p>{catalog["sourceReview.intro"]}</p>
        </div>
        <button
          className="secondaryAction"
          disabled={projects.length === 0}
          onClick={() =>
            setSelected({
              kind: "manual",
              id: "new-manual",
              title: catalog["sourceReview.manualNew"],
              summary: "",
              occurredAt: new Date().toISOString(),
              projectId: projects[0]?.id ?? null,
            })
          }
          type="button"
        >
          {catalog["sourceReview.addManual"]}
        </button>
      </header>
      <p className="boundaryNote">{catalog["sourceReview.privateBoundary"]}</p>
      {loadError ? (
        <p className="formError" role="alert">
          {catalog["sourceReview.connectorUnavailable"]}
        </p>
      ) : null}
      {confirmed ? (
        <div className="sourceReviewReceipt" role="status">
          <strong>{catalog["sourceReview.confirmed"]}</strong>
          <span>{catalog["sourceReview.noProgress"]}</span>
        </div>
      ) : null}
      <ul className="sourceReviewList">
        {sources.map((source) => (
          <li key={`${source.kind}:${source.id}`}>
            <button className="sourceReviewRow" onClick={() => setSelected(source)} type="button">
              <span>
                <strong dir="auto">{source.title}</strong>
                <small>{catalog[`sourceReview.source.${source.kind}`]}</small>
              </span>
              <span className="privateBadge">
                {source.kind === "github"
                  ? catalog["sourceReview.suggestedOnly"]
                  : catalog["sourceReview.private"]}
              </span>
              <span className="sourceReviewProject" dir="auto">
                {projectName(projects, source.projectId) ?? catalog["sourceReview.needsProject"]}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {sources.length === 0 ? <p>{catalog["sourceReview.empty"]}</p> : null}
      {selected === null
        ? null
        : createElement(SourceDecisionSheet, {
            catalog,
            gateway,
            onClose: () => setSelected(null),
            onConfirmed: () => {
              setSelected(null);
              setConfirmed(true);
            },
            onDismissed: (sourceId: string) => {
              setConnected((current) => current.filter((item) => item.id !== sourceId));
              setSelected(null);
            },
            projects,
            source: selected,
          })}
    </section>
  );
}

function SourceDecisionSheet({
  catalog,
  gateway,
  onClose,
  onConfirmed,
  onDismissed,
  projects,
  source,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  gateway: SourceReviewGateway;
  onClose: () => void;
  onConfirmed: () => void;
  onDismissed: (sourceId: string) => void;
  projects: readonly SourceReviewProject[];
  source: ReviewSource;
}>) {
  const [projectId, setProjectId] = useState(source.projectId ?? projects[0]?.id ?? "");
  const [projectConfirmed, setProjectConfirmed] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [relinkRecovery, setRelinkRecovery] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !evidenceOpen) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [evidenceOpen, onClose]);

  async function confirmProject() {
    if (projectId === "") return;
    setBusy(true);
    setError(false);
    setRelinkRecovery(false);
    try {
      if (source.kind === "google") {
        await gateway.correctGoogleProject({
          sourceId: source.id,
          previousProjectId: source.projectId,
          projectId,
          reason: "Employee confirmed source Project during evidence review",
        });
      }
      setProjectConfirmed(true);
    } catch (caught) {
      setError(true);
      setRelinkRecovery(
        typeof caught === "object" &&
          caught !== null &&
          "previousLinkRemoved" in caught &&
          caught.previousLinkRemoved === true,
      );
    } finally {
      setBusy(false);
    }
  }

  if (evidenceOpen && projectId !== "") {
    const project = projects.find(({ id }) => id === projectId);
    return createElement(EvidenceReviewSheet, {
      catalog,
      context: {
        projectId,
        workstreamId: null,
        workItemId: null,
        updateSourceId: null,
        contextLabel: project?.name ?? catalog["sourceReview.needsProject"],
        suggestedClaim: source.title,
        suggestedContributionContext: "",
        executionMode: "manual" as const,
        ...(source.kind === "github"
          ? { githubSourceEventId: source.id }
          : { initialSourceText: source.summary ?? source.title }),
      },
      initialSourceKind: source.kind === "github" ? "url" : "pasted_text",
      onClose: () => setEvidenceOpen(false),
      onConfirmed: () => onConfirmed(),
    });
  }

  return (
    <div className="drawerBackdrop sourceReviewBackdrop">
      <aside
        aria-labelledby="source-review-title"
        aria-modal="true"
        className="workItemDrawer sourceReviewDrawer"
        role="dialog"
      >
        <header className="drawerHeader">
          <div>
            <p className="eyebrow">{catalog[`sourceReview.source.${source.kind}`]}</p>
            <h2 dir="auto" id="source-review-title">
              {source.title}
            </h2>
          </div>
          <button className="quietButton" onClick={onClose} ref={closeButton} type="button">
            {catalog["actions.close"]}
          </button>
        </header>
        {source.summary === "" ? null : <p dir="auto">{source.summary}</p>}
        <p className="boundaryNote">
          {source.kind === "github"
            ? catalog["sourceReview.githubBoundary"]
            : catalog["sourceReview.evidenceBoundary"]}
        </p>
        {error ? (
          <p className="formError" role="alert">
            {relinkRecovery
              ? catalog["sourceReview.relinkRecovery"]
              : catalog["sourceReview.projectError"]}
          </p>
        ) : null}
        <label className="sourceReviewProjectPicker">
          <span>{catalog["evidence.project"]}</span>
          <select
            disabled={busy || source.kind === "github"}
            onChange={(event) => {
              setProjectId(event.target.value);
              setProjectConfirmed(false);
            }}
            value={projectId}
          >
            <option value="">{catalog["tasks.selectProject"]}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        {source.kind === "github" ? (
          <p className="formHint">
            {catalog["sourceReview.verifiedProject"]}: {source.projectName}
          </p>
        ) : null}
        <div className="formActions">
          <button
            className="secondaryAction"
            disabled={busy || projectId === ""}
            onClick={() => void confirmProject()}
            type="button"
          >
            {catalog["sourceReview.confirmProject"]}
          </button>
          <button
            className="primaryAction"
            disabled={busy || projectId === "" || !projectConfirmed}
            onClick={() => setEvidenceOpen(true)}
            type="button"
          >
            {catalog["sourceReview.reviewEvidence"]}
          </button>
          {source.kind === "google" ? (
            <button
              className="quietButton"
              disabled={busy}
              onClick={() =>
                void (async () => {
                  setBusy(true);
                  try {
                    await gateway.excludeGoogleSource(source.id);
                    onDismissed(source.id);
                  } catch {
                    setError(true);
                    setBusy(false);
                  }
                })()
              }
              type="button"
            >
              {catalog["sourceReview.dismiss"]}
            </button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function projectName(projects: readonly SourceReviewProject[], projectId: string | null) {
  return projects.find((project) => project.id === projectId)?.name;
}
