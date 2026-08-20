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
                {view.mode === "manager" &&
                leave.state === "APPROVED" &&
                leave.handover?.confirmed &&
                !view.delegations.some(({ leaveId }) => leaveId === leave.id) &&
                (leave.affectedScopes?.length ?? 0) > 0 ? (
                  <DelegationApproval
                    busy={busy}
                    candidates={view.delegationCandidates}
                    catalog={catalog}
                    leave={leave}
                    submit={submit}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.panel} aria-labelledby="delegation-list-heading">
        <div className={styles.sectionHeading}>
          <h2 id="delegation-list-heading">{catalog["continuity.experience.delegationTitle"]}</h2>
          <span>{view.delegations.length}</span>
        </div>
        {view.delegations.length === 0 ? (
          <p className={styles.empty}>{catalog["continuity.experience.delegationEmpty"]}</p>
        ) : (
          <ul className={styles.list}>
            {view.delegations.map((delegation) => (
              <li className={styles.card} key={delegation.id}>
                <div className={styles.cardMain}>
                  <strong>
                    {delegation.ownerName} → {delegation.delegateName}
                  </strong>
                  <span>{formatRange(locale, delegation.startsAt, delegation.endsAt)}</span>
                  <small>
                    {catalog[`continuity.experience.delegationState.${delegation.state}`]}
                  </small>
                </div>
                <p>{catalog["continuity.experience.exactScopeBoundary"]}</p>
                <ul>
                  {delegation.scopes.map((scope) => (
                    <li key={`${scope.kind}:${scope.id}`}>
                      <strong>{scope.name}</strong> — {scope.actions.join(", ")}
                    </li>
                  ))}
                </ul>
                {delegation.role === "delegate" &&
                delegation.state === "PENDING_DELEGATE" &&
                !delegation.delegateConfirmed ? (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void submit("delegations/confirm", {
                        delegationId: delegation.id,
                        receiptConfirmed: true,
                        accessConfirmed: true,
                      })
                    }
                    type="button"
                  >
                    {catalog["continuity.experience.confirmDelegation"]}
                  </button>
                ) : null}
                {delegation.role === "manager" &&
                delegation.state === "PENDING_DELEGATE" &&
                delegation.delegateConfirmed &&
                delegation.openAccessGapCount === 0 ? (
                  <button
                    disabled={busy}
                    onClick={() => void submit(`delegations/${delegation.id}/activate`, {})}
                    type="button"
                  >
                    {catalog["continuity.experience.activateDelegation"]}
                  </button>
                ) : null}
                {delegation.role === "manager" && delegation.state === "ACTIVE" ? (
                  <button
                    className={styles.secondary}
                    disabled={busy}
                    onClick={() => void submit(`delegations/${delegation.id}/expire`, {})}
                    type="button"
                  >
                    {catalog["continuity.experience.expireDelegation"]}
                  </button>
                ) : null}
                {delegation.role === "delegate" &&
                delegation.state === "ACTIVE" &&
                delegation.returnHandover === null ? (
                  <ReturnEditor
                    busy={busy}
                    catalog={catalog}
                    delegationId={delegation.id}
                    submit={submit}
                  />
                ) : null}
                {delegation.role === "owner" && delegation.returnHandover?.state === "DRAFT" ? (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void submit(`delegations/${delegation.id}/return/confirm`, {
                        returnId: delegation.returnHandover!.id,
                        expectedVersion: delegation.returnHandover!.version,
                      })
                    }
                    type="button"
                  >
                    {catalog["continuity.experience.confirmReturn"]}
                  </button>
                ) : null}
                {delegation.role === "manager" &&
                delegation.returnHandover?.state === "OWNER_CONFIRMED" ? (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void submit(`delegations/${delegation.id}/return/finalize`, {
                        returnId: delegation.returnHandover!.id,
                        expectedVersion: delegation.returnHandover!.version,
                        choice: "RETURN",
                        occurredAt: new Date().toISOString(),
                        reason: catalog["continuity.experience.returnReason"],
                      })
                    }
                    type="button"
                  >
                    {catalog["continuity.experience.finalizeReturn"]}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function DelegationApproval({
  busy,
  candidates,
  catalog,
  leave,
  submit,
}: Readonly<{
  busy: boolean;
  candidates: WebContinuityExperience["delegationCandidates"];
  catalog: Catalog;
  leave: WebContinuityExperience["leaves"][number];
  submit(path: string, body: unknown): Promise<void>;
}>) {
  const scopes = leave.affectedScopes ?? [];
  const departmentId = scopes[0]?.departmentId;
  const available = candidates.filter(
    (candidate) => candidate.departmentId === departmentId && candidate.id !== leave.employeeId,
  );
  return (
    <form
      className={styles.decision}
      onSubmit={(event) => {
        event.preventDefault();
        if (!departmentId) return;
        const data = new FormData(event.currentTarget);
        const projectIds = scopes.filter(({ kind }) => kind === "PROJECT").map(({ id }) => id);
        const workstreamIds = scopes
          .filter(({ kind }) => kind === "WORKSTREAM")
          .map(({ id }) => id);
        void submit("delegations/approve", {
          id: crypto.randomUUID(),
          leaveId: leave.id,
          ownerId: leave.employeeId,
          delegateId: data.get("delegateId"),
          departmentId,
          startsAt: leave.startsAt,
          endsAt: leave.endsAt,
          projectIds,
          workstreamIds,
          actions: [
            ...(projectIds.length > 0 ? ["project.update"] : []),
            ...(workstreamIds.length > 0 ? ["workstream.update"] : []),
          ],
          emergency: false,
          emergencyReason: null,
        });
      }}
    >
      <label>
        {catalog["continuity.experience.delegate"]}
        <select name="delegateId" required defaultValue="">
          <option value="" disabled>
            {catalog["continuity.experience.chooseDelegate"]}
          </option>
          {available.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>
      </label>
      <p>{scopes.map(({ name }) => name).join(", ")}</p>
      <button disabled={busy || available.length === 0} type="submit">
        {catalog["continuity.experience.approveDelegation"]}
      </button>
    </form>
  );
}

function ReturnEditor({
  busy,
  catalog,
  delegationId,
  submit,
}: Readonly<{
  busy: boolean;
  catalog: Catalog;
  delegationId: string;
  submit(path: string, body: unknown): Promise<void>;
}>) {
  return (
    <details className={styles.editor}>
      <summary>{catalog["continuity.experience.prepareReturn"]}</summary>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void submit(`delegations/${delegationId}/return`, {
            id: crypto.randomUUID(),
            completedWork: data.get("completedWork"),
            decisionsAndChanges: data.get("decisionsAndChanges"),
            openWork: data.get("openWork"),
            risksAndNextSteps: data.get("risksAndNextSteps"),
          });
        }}
      >
        {[
          ["completedWork", "continuity.experience.completedWork"],
          ["decisionsAndChanges", "continuity.experience.decisionsAndChanges"],
          ["openWork", "continuity.experience.openWork"],
          ["risksAndNextSteps", "continuity.experience.risksAndNextSteps"],
        ].map(([name, label]) => (
          <label key={name}>
            {catalog[label!]}
            <textarea name={name} required rows={2} />
          </label>
        ))}
        <button disabled={busy} type="submit">
          {catalog["continuity.experience.saveReturnDraft"]}
        </button>
      </form>
    </details>
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
