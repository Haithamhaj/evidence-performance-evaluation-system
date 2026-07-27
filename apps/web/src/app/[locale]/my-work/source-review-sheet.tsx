"use client";

import type { Catalog } from "@evaluation/localization";
import { useEffect, useRef, useState } from "react";

import {
  linkContextProject,
  setContextExclusion,
  unlinkContextProject,
  type ConnectedWorkContextItem,
} from "../../../platform/connected-work-context-api";
import type { ProjectOption } from "./connected-context";

type ViewProperties = Readonly<{
  catalog: Catalog;
  item: ConnectedWorkContextItem;
  linkedProject?: ProjectOption;
  projects: readonly ProjectOption[];
  busy?: boolean;
  error?: boolean;
  onClose?: () => void;
  onExclude?: () => void;
  onLink?: (projectId: string) => void;
  onUnlink?: () => void;
}>;

export function SourceReviewSheetView({
  busy = false,
  catalog,
  error = false,
  item,
  linkedProject,
  onClose,
  onExclude,
  onLink,
  onUnlink,
  projects,
}: ViewProperties) {
  return (
    <div className="drawerBackdrop connectedContextBackdrop">
      <aside
        aria-labelledby="connected-source-title"
        aria-modal="true"
        className="workItemDrawer connectedContextBottomSheet"
        role="dialog"
      >
        <header className="drawerHeader">
          <div>
            <p className="eyebrow">{catalog["connectedContext.privateLabel"]}</p>
            <h2 id="connected-source-title">{item.title}</h2>
          </div>
          <button autoFocus className="quietButton" onClick={onClose} type="button">
            {catalog["actions.close"]}
          </button>
        </header>
        {item.summary === null ? null : <p>{item.summary}</p>}
        <p className="boundaryNote">{catalog["connectedContext.ownerOnly"]}</p>
        {error ? (
          <p className="formError" role="alert">
            {catalog["connectedContext.recovery"]}
          </p>
        ) : null}
        <section className="drawerSection">
          <h3>{catalog["connectedContext.projectLink"]}</h3>
          <p>{catalog["connectedContext.projectControl"]}</p>
          {linkedProject === undefined ? null : (
            <button className="quietButton" disabled={busy} onClick={onUnlink} type="button">
              {catalog["connectedContext.unlink"]} {linkedProject.name}
            </button>
          )}
          <label className="connectedContextProjectPicker">
            <span>{catalog["connectedContext.link"]}</span>
            <select disabled={busy} onChange={(event) => onLink?.(event.target.value)} value="">
              <option value="">{catalog["tasks.selectProject"]}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        </section>
        <section className="drawerSection">
          <button className="quietButton" disabled={busy} onClick={onExclude} type="button">
            {item.excluded
              ? catalog["connectedContext.restore"]
              : catalog["connectedContext.exclude"]}
          </button>
          {item.sourceUrl === null ? null : (
            <a className="quietLink" href={item.sourceUrl} rel="noreferrer" target="_blank">
              {catalog["connectedContext.openSource"]}
            </a>
          )}
        </section>
      </aside>
    </div>
  );
}

export function SourceReviewSheet({
  catalog,
  item,
  onChanged,
  onClose,
  projects,
}: Readonly<{
  catalog: Catalog;
  item: ConnectedWorkContextItem;
  onChanged: () => Promise<void>;
  onClose: () => void;
  projects: readonly ProjectOption[];
}>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [excluded, setExcluded] = useState(item.excluded);
  const [linkedProject, setLinkedProject] = useState<ProjectOption | undefined>(() =>
    item.projectId === null ? undefined : projects.find((project) => project.id === item.projectId),
  );
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  async function change(operation: () => Promise<unknown>) {
    setBusy(true);
    setError(false);
    try {
      await operation();
      await onChanged();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <SourceReviewSheetView
      catalog={catalog}
      item={{ ...item, excluded }}
      {...(linkedProject === undefined ? {} : { linkedProject })}
      projects={projects}
      busy={busy}
      error={error}
      onClose={onClose}
      onExclude={() =>
        void change(async () => {
          await setContextExclusion(item.id, !excluded);
          setExcluded(!excluded);
        })
      }
      onLink={(projectId) =>
        void change(async () => {
          await linkContextProject({
            id: item.id,
            projectId,
            reason: "Employee manually linked private context",
          });
          setLinkedProject(projects.find((project) => project.id === projectId));
        })
      }
      onUnlink={() =>
        void change(async () => {
          await unlinkContextProject({ id: item.id, reason: "Employee unlinked private context" });
          setLinkedProject(undefined);
        })
      }
    />
  );
}
