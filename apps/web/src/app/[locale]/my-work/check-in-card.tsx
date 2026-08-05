"use client";

import { createElement, useState } from "react";

export type CheckInObligationView = Readonly<{
  projectId: string;
  projectName: string;
  workstreamId: string;
  workstreamName: string;
  weekStartsAt: string;
  weekEndsAt: string;
  state: "not_due" | "required" | "satisfied_by_update" | "exempt_approved_leave";
  capture: Readonly<{
    projectId: string;
    workstreamId: string;
    workItemId: null;
  }> | null;
}>;

export type CheckInDraft = Readonly<{
  projectId: string;
  workstreamId: string;
  rawText: string;
}>;

export function CheckInCard({
  catalog,
  obligations,
  onStart,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  obligations: readonly CheckInObligationView[];
  onStart: (draft: CheckInDraft) => void;
}>) {
  const required = obligations.filter(
    (
      obligation,
    ): obligation is CheckInObligationView & { capture: NonNullable<typeof obligation.capture> } =>
      obligation.state === "required" && obligation.capture !== null,
  );
  if (required.length === 0) return null;
  return (
    <section className="panel checkInCard" aria-labelledby="check-in-title">
      <header>
        <h2 id="check-in-title">{catalog["checkIn.title"]}</h2>
        <p>{catalog["checkIn.subtitle"]}</p>
      </header>
      <div className="compactActionList">
        {required.map((obligation) =>
          createElement(RequiredCheckIn, {
            catalog,
            key: obligation.workstreamId,
            obligation,
            onStart,
          }),
        )}
      </div>
    </section>
  );
}

function RequiredCheckIn({
  catalog,
  obligation,
  onStart,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  obligation: CheckInObligationView & { capture: NonNullable<CheckInObligationView["capture"]> };
  onStart: (draft: CheckInDraft) => void;
}>) {
  const options = [
    catalog["checkIn.status.noChange"],
    catalog["checkIn.status.paused"],
    catalog["checkIn.status.priorityMoved"],
    catalog["checkIn.status.waiting"],
    catalog["checkIn.status.inProgress"],
    catalog["checkIn.status.completedNotClosed"],
    catalog["checkIn.status.noLongerActive"],
  ];
  const [status, setStatus] = useState(options[0]!);
  return (
    <article className="compactActionRow">
      <div>
        <strong>{obligation.workstreamName}</strong>
        <p>{obligation.projectName}</p>
      </div>
      <label>
        <span>{catalog["checkIn.status"]}</span>
        <select onChange={(event) => setStatus(event.currentTarget.value)} value={status}>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <button
        className="secondaryAction"
        onClick={() =>
          onStart({
            projectId: obligation.capture.projectId,
            workstreamId: obligation.capture.workstreamId,
            rawText: status,
          })
        }
        type="button"
      >
        {catalog["checkIn.start"]}
      </button>
    </article>
  );
}
