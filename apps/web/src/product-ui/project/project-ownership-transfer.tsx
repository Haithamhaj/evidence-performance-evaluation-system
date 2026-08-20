"use client";

/* eslint-disable no-unused-vars */

import type { Catalog } from "@evaluation/localization";
import { useActionState, useState } from "react";

import {
  transferProjectOwnershipAction,
  type OwnershipTransferState,
} from "../../app/[locale]/projects/ownership-actions";

const initialState: OwnershipTransferState = { status: "idle" };

export function ProjectOwnershipTransfer({
  catalog,
  locale,
  ownership,
  projectId,
}: Readonly<{ catalog: Catalog; locale: "ar" | "en"; ownership: any; projectId: string }>) {
  const [state, action, pending] = useActionState(transferProjectOwnershipAction, initialState);
  const [kind, setKind] = useState<"permanent" | "acting">("permanent");
  const returnOwner = ownership.plannedReturnOwnerName ?? ownership.currentOwner?.displayName;
  const continuityImpact =
    kind === "permanent"
      ? catalog["project.experience.permanentContinuityImpact"]
      : catalog["project.experience.actingContinuityImpact"].replace("{owner}", returnOwner);
  return (
    <form action={action}>
      <input name="locale" type="hidden" value={locale} />
      <input name="projectId" type="hidden" value={projectId} />
      <input name="expectedVersion" type="hidden" value={ownership.transfer.expectedVersion} />
      <label>
        {catalog["project.experience.newOwner"]}
        <select aria-label={catalog["project.experience.newOwner"]} name="toUserId" required>
          {ownership.transfer.candidates.map((candidate: any) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.displayName}
            </option>
          ))}
        </select>
      </label>
      <label>
        {catalog["project.experience.transferType"]}
        <select
          aria-label={catalog["project.experience.transferType"]}
          name="transferKind"
          onChange={(event) => setKind(event.target.value as "permanent" | "acting")}
        >
          <option value="permanent">{catalog["project.experience.permanentTransfer"]}</option>
          <option value="acting">{catalog["project.experience.actingTransfer"]}</option>
        </select>
      </label>
      <label>
        {catalog["project.experience.effectiveAt"]}
        <input name="effectiveAt" placeholder="2026-08-20T09:00:00.000+03:00" required />
      </label>
      {kind === "acting" ? (
        <>
          <input name="delegationType" type="hidden" value="approved_leave" />
          <label>
            {catalog["project.experience.endsAt"]}
            <input name="endsAt" placeholder="2026-08-27T09:00:00.000+03:00" required />
          </label>
        </>
      ) : null}
      <label>
        {catalog["workspace.form.reason"]}
        <input name="reason" required />
      </label>
      <output aria-label={catalog["project.experience.expectedVersion"]}>
        {ownership.transfer.expectedVersion}
      </output>
      <output aria-label={catalog["project.experience.continuityImpact"]}>
        {continuityImpact}
      </output>
      <p>{catalog["project.experience.transferHumanGate"]}</p>
      {state.status === "stale" ? (
        <p role="alert">
          {catalog["project.experience.transferStale"]}{" "}
          <button type="button" onClick={() => window.location.reload()}>
            {catalog["actions.retry"]}
          </button>
        </p>
      ) : null}
      {state.status === "error" ? <p role="alert">{catalog["errors.internal"]}</p> : null}
      <button disabled={pending} type="submit">
        {catalog["project.experience.submitTransfer"]}
      </button>
    </form>
  );
}
