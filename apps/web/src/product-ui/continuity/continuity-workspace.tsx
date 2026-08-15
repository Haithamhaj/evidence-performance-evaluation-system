"use client";
/* eslint-disable no-unused-vars */

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { WebContinuityExperience } from "../../platform/continuity-contracts";
import styles from "./continuity-workspace.module.css";

type Catalog = Readonly<Record<string, string>>;

export function ContinuityWorkspace({
  catalog,
  locale,
  view,
}: Readonly<{ catalog: Catalog; locale: "en" | "ar"; view: WebContinuityExperience }>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(path: string, body: unknown) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/continuity/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("request_failed");
      setMessage(catalog["continuity.experience.saved"] ?? "Saved");
      router.refresh();
    } catch {
      setMessage(catalog["continuity.experience.recovery"] ?? "Try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.workspace} dir={locale === "ar" ? "rtl" : "ltr"}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{catalog["continuity.experience.eyebrow"]}</p>
          <h1>
            {
              catalog[
                view.mode === "manager"
                  ? "continuity.experience.managerTitle"
                  : "continuity.experience.employeeTitle"
              ]
            }
          </h1>
          <p className={styles.summary}>{catalog["continuity.experience.summary"]}</p>
        </div>
        <aside className={styles.boundary}>
          {
            catalog[
              view.mode === "manager"
                ? "continuity.experience.fairnessBoundary"
                : "continuity.experience.draftBoundary"
            ]
          }
        </aside>
      </header>

      {message ? (
        <p role="status" className={styles.status}>
          {message}
        </p>
      ) : null}

      {view.mode === "employee" ? (
        <section className={styles.panel} aria-labelledby="leave-request-heading">
          <h2 id="leave-request-heading">{catalog["continuity.experience.requestTitle"]}</h2>
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const scope = view.availableScopes.find(({ id }) => id === data.get("scopeId"));
              const startsAt = new Date(String(data.get("startsAt"))).toISOString();
              const endsAt = new Date(String(data.get("endsAt"))).toISOString();
              if (!scope) return;
              void submit("leaves", {
                id: crypto.randomUUID(),
                departmentId: scope.departmentId,
                startsAt,
                endsAt,
                reasonCategory: data.get("reasonCategory"),
                affectedScopes: [{ kind: scope.kind, id: scope.id }],
              });
            }}
          >
            <label>
              {catalog["continuity.experience.startsAt"]}
              <input name="startsAt" type="datetime-local" required />
            </label>
            <label>
              {catalog["continuity.experience.endsAt"]}
              <input name="endsAt" type="datetime-local" required />
            </label>
            <label>
              {catalog["continuity.experience.reasonCategory"]}
              <select name="reasonCategory" defaultValue="PLANNED_LEAVE">
                <option value="PLANNED_LEAVE">{catalog["continuity.experience.planned"]}</option>
                <option value="UNPLANNED_LEAVE">
                  {catalog["continuity.experience.unplanned"]}
                </option>
                <option value="OTHER_APPROVED_ABSENCE">
                  {catalog["continuity.experience.other"]}
                </option>
              </select>
            </label>
            <label>
              {catalog["continuity.experience.scope"]}
              <select name="scopeId" required defaultValue="">
                <option value="" disabled>
                  {catalog["continuity.experience.chooseScope"]}
                </option>
                {view.availableScopes.map((scope) => (
                  <option key={`${scope.kind}:${scope.id}`} value={scope.id}>
                    {scope.name}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={busy || view.availableScopes.length === 0} type="submit">
              {catalog["continuity.experience.submitLeave"]}
            </button>
          </form>
        </section>
      ) : null}

      <section className={styles.panel} aria-labelledby="continuity-list-heading">
        <div className={styles.sectionHeading}>
          <h2 id="continuity-list-heading">{catalog["continuity.experience.activeTitle"]}</h2>
          <span>{view.leaves.length}</span>
        </div>
        {view.leaves.length === 0 ? (
          <p className={styles.empty}>{catalog["continuity.experience.empty"]}</p>
        ) : (
          <ul className={styles.list}>
            {view.leaves.map((leave) => (
              <li className={styles.card} key={leave.id}>
                <div className={styles.cardMain}>
                  <strong>{leave.employeeName}</strong>
                  <span>{formatRange(locale, leave.startsAt, leave.endsAt)}</span>
                  <small>{catalog[`continuity.experience.state.${leave.state}`]}</small>
                </div>
                <dl className={styles.facts}>
                  <div>
                    <dt>{catalog["continuity.experience.affected"]}</dt>
                    <dd>{leave.affectedScopeCount}</dd>
                  </div>
                  <div>
                    <dt>{catalog["continuity.experience.handover"]}</dt>
                    <dd>
                      {leave.handover === null
                        ? catalog["continuity.experience.handoverMissing"]
                        : leave.handover.confirmed
                          ? catalog["continuity.experience.handoverConfirmed"]
                          : catalog["continuity.experience.handoverReview"]}
                    </dd>
                  </div>
                </dl>
                {view.mode === "manager" && leave.state === "SUBMITTED" ? (
                  <form
                    className={styles.decision}
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      void submit(`leaves/${leave.id}/decision`, {
                        decision: data.get("decision"),
                        reason: data.get("reason"),
                      });
                    }}
                  >
                    <input
                      aria-label={catalog["continuity.experience.reason"]}
                      name="reason"
                      placeholder={catalog["continuity.experience.reason"]}
                      required
                    />
                    <button disabled={busy} name="decision" value="APPROVED">
                      {catalog["continuity.experience.approve"]}
                    </button>
                    <button
                      className={styles.secondary}
                      disabled={busy}
                      name="decision"
                      value="REJECTED"
                    >
                      {catalog["continuity.experience.reject"]}
                    </button>
                  </form>
                ) : null}
                {view.mode === "employee" &&
                leave.handover !== null &&
                !leave.handover.confirmed ? (
                  <button
                    className={styles.secondary}
                    disabled={busy}
                    onClick={() =>
                      void submit(`handovers/${leave.handover!.id}/confirm`, {
                        expectedRevision: leave.handover!.revision,
                      })
                    }
                    type="button"
                  >
                    {catalog["continuity.experience.confirmHandover"]}
                  </button>
                ) : null}
                {view.mode === "employee" &&
                ["APPROVED", "ACTIVE"].includes(leave.state) &&
                !leave.handover?.confirmed &&
                (leave.affectedScopes?.length ?? 0) > 0 ? (
                  <HandoverEditor busy={busy} catalog={catalog} leave={leave} submit={submit} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function HandoverEditor({
  busy,
  catalog,
  leave,
  submit,
}: Readonly<{
  busy: boolean;
  catalog: Catalog;
  leave: WebContinuityExperience["leaves"][number];
  submit(path: string, body: unknown): Promise<void>;
}>) {
  return (
    <details className={styles.editor}>
      <summary>{catalog["continuity.experience.prepareHandover"]}</summary>
      <p>{catalog["continuity.experience.handoverDraftBoundary"]}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const handoverId = leave.handover?.id ?? crypto.randomUUID();
          const items = (leave.affectedScopes ?? []).map((scope, index) => ({
            scope: { kind: scope.kind, id: scope.id },
            currentState: data.get(`currentState-${index}`),
            completedWork: data.get(`completedWork-${index}`),
            openWork: data.get(`openWork-${index}`),
            blockersAndRisks: data.get(`blockersAndRisks-${index}`),
            immediateNextStep: data.get(`immediateNextStep-${index}`),
            keyLinks: [],
            requiredAccess: [],
            pendingDecisions: [],
            proposedDelegateId: null,
          }));
          void submit(`handovers/${handoverId}/revisions`, {
            leaveId: leave.id,
            expectedRevision: leave.handover?.revision ?? 0,
            items,
          });
        }}
      >
        {(leave.affectedScopes ?? []).map((scope, index) => (
          <fieldset key={`${scope.kind}:${scope.id}`}>
            <legend>{scope.name}</legend>
            {[
              ["currentState", "continuity.experience.currentState"],
              ["completedWork", "continuity.experience.completedWork"],
              ["openWork", "continuity.experience.openWork"],
              ["blockersAndRisks", "continuity.experience.blockers"],
              ["immediateNextStep", "continuity.experience.nextStep"],
            ].map(([name, label]) => (
              <label key={name}>
                {catalog[label!]}
                <textarea name={`${name}-${index}`} required rows={2} />
              </label>
            ))}
          </fieldset>
        ))}
        <button disabled={busy} type="submit">
          {catalog["continuity.experience.saveHandoverDraft"]}
        </button>
      </form>
    </details>
  );
}

function formatRange(locale: "en" | "ar", startsAt: string, endsAt: string) {
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "Asia/Riyadh",
  });
  return `${formatter.format(new Date(startsAt))} — ${formatter.format(new Date(endsAt))}`;
}
