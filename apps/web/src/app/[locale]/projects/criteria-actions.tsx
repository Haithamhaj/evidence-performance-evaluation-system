"use client";

import type { CriteriaWorkspaceAction } from "@evaluation/contracts";
import type { Catalog, Locale } from "@evaluation/localization";
import { useActionState } from "react";

import {
  activateCriteriaAction,
  generateCriteriaAction,
  ownerReviewCriteriaAction,
  publishCriteriaAction,
  resolveCriteriaAction,
  respondToCriteriaAction,
} from "./actions";

export type CriteriaActionContext = {
  readonly locale: Locale;
  readonly kind: "project" | "workstream";
  readonly resourceId: string;
  readonly projectId: string;
  readonly proposalId: string | null;
  readonly proposalVersion: number | null;
  readonly documentVersionId: string | null;
  readonly replacementRequest: {
    readonly replacesProposalId: string;
    readonly ownerFeedback: string;
  } | null;
};

type CriteriaActionsProperties = {
  readonly allowedActions: readonly CriteriaWorkspaceAction[];
  readonly catalog: Catalog;
  readonly context: CriteriaActionContext;
};

const initialState: import("./actions").CriteriaActionState = { status: "idle" };

export function CriteriaActions({ allowedActions, catalog, context }: CriteriaActionsProperties) {
  const [generateState, generateAction, generatePending] = useActionState(
    generateCriteriaAction,
    initialState,
  );
  const [reviewState, reviewAction, reviewPending] = useActionState(
    ownerReviewCriteriaAction,
    initialState,
  );
  const [publishState, publishAction, publishPending] = useActionState(
    publishCriteriaAction,
    initialState,
  );
  const [acknowledgeState, acknowledgeAction, acknowledgePending] = useActionState(
    respondToCriteriaAction,
    initialState,
  );
  const [objectState, objectAction, objectPending] = useActionState(
    respondToCriteriaAction,
    initialState,
  );
  const [resolveState, resolveAction, resolvePending] = useActionState(
    resolveCriteriaAction,
    initialState,
  );
  const [activateState, activateAction, activatePending] = useActionState(
    activateCriteriaAction,
    initialState,
  );

  return (
    <div className="criteriaActions">
      {allowedActions.includes("generate") && context.documentVersionId !== null ? (
        <form action={generateAction} className="criteriaForm">
          {contextInputs(context)}
          <input name="documentVersionId" type="hidden" value={context.documentVersionId} />
          <input
            name="idempotencyKey"
            type="hidden"
            value={`criteria:${context.kind}:${context.resourceId}:${context.documentVersionId}`}
          />
          {context.replacementRequest === null ? null : (
            <>
              <input
                name="replacesProposalId"
                type="hidden"
                value={context.replacementRequest.replacesProposalId}
              />
              <input
                name="ownerFeedback"
                type="hidden"
                value={context.replacementRequest.ownerFeedback}
              />
            </>
          )}
          <button disabled={generatePending} type="submit">
            {catalog["workspace.criteriaAction.generate"]}
          </button>
          {actionStatus(catalog, generateState, generatePending)}
        </form>
      ) : null}

      {allowedActions.includes("owner_review") && context.proposalId !== null ? (
        <form action={reviewAction} className="criteriaForm">
          {contextInputs(context)}
          <input name="proposalId" type="hidden" value={context.proposalId} />
          <label>
            {catalog["workspace.criteriaAction.owner_review"]}
            <select name="action" required>
              <option value="reject">{catalog["workspace.form.reject"]}</option>
              <option value="request_correction">
                {catalog["workspace.form.requestCorrection"]}
              </option>
              <option value="request_alternative">
                {catalog["workspace.form.requestAlternative"]}
              </option>
              <option value="request_wording_improvement">
                {catalog["workspace.form.requestWording"]}
              </option>
            </select>
          </label>
          {reasonInput(catalog)}
          <label>
            {catalog["workspace.form.feedback"]}
            <textarea maxLength={4000} name="feedback" />
          </label>
          <button disabled={reviewPending} type="submit">
            {catalog["workspace.form.submit"]}
          </button>
          {actionStatus(catalog, reviewState, reviewPending)}
        </form>
      ) : null}

      {allowedActions.includes("publish") && context.proposalId !== null ? (
        <form action={publishAction} className="criteriaForm">
          {contextInputs(context)}
          <input name="proposalId" type="hidden" value={context.proposalId} />
          {reasonInput(catalog)}
          <button disabled={publishPending} type="submit">
            {catalog["workspace.criteriaAction.publish"]}
          </button>
          {actionStatus(catalog, publishState, publishPending)}
        </form>
      ) : null}

      {allowedActions.includes("respond") && context.proposalId !== null ? (
        <div className="responseForms">
          <h3>{catalog["workspace.criteriaAction.respond"]}</h3>
          <form action={acknowledgeAction} className="criteriaForm">
            {contextInputs(context)}
            <input name="proposalId" type="hidden" value={context.proposalId} />
            <input name="action" type="hidden" value="acknowledge" />
            <button disabled={acknowledgePending} type="submit">
              {catalog["workspace.form.acknowledge"]}
            </button>
            {actionStatus(catalog, acknowledgeState, acknowledgePending)}
          </form>
          <form action={objectAction} className="criteriaForm">
            {contextInputs(context)}
            <input name="proposalId" type="hidden" value={context.proposalId} />
            <input name="action" type="hidden" value="object" />
            {reasonInput(catalog)}
            <button disabled={objectPending} type="submit">
              {catalog["workspace.form.object"]}
            </button>
            {actionStatus(catalog, objectState, objectPending)}
          </form>
        </div>
      ) : null}

      {allowedActions.includes("manager_resolve") && context.proposalId !== null ? (
        <form action={resolveAction} className="criteriaForm">
          {contextInputs(context)}
          <input name="proposalId" type="hidden" value={context.proposalId} />
          <label>
            {catalog["workspace.criteriaAction.manager_resolve"]}
            <select name="decision" required>
              <option value="request_revision">{catalog["workspace.form.requestRevision"]}</option>
              <option value="accept_with_objections">
                {catalog["workspace.form.acceptWithObjections"]}
              </option>
            </select>
          </label>
          {reasonInput(catalog)}
          <button disabled={resolvePending} type="submit">
            {catalog["workspace.form.submit"]}
          </button>
          {actionStatus(catalog, resolveState, resolvePending)}
        </form>
      ) : null}

      {allowedActions.includes("activate") &&
      context.proposalId !== null &&
      context.proposalVersion !== null ? (
        <form action={activateAction} className="criteriaForm">
          {contextInputs(context)}
          <input name="proposalId" type="hidden" value={context.proposalId} />
          <input name="expectedProposalVersion" type="hidden" value={context.proposalVersion} />
          <label>
            {catalog["workspace.form.effectiveFrom"]}
            <input
              name="effectiveFrom"
              placeholder={catalog["workspace.form.effectiveExample"]}
              required
              type="text"
            />
          </label>
          {reasonInput(catalog)}
          <button disabled={activatePending} type="submit">
            {catalog["workspace.criteriaAction.activate"]}
          </button>
          {actionStatus(catalog, activateState, activatePending)}
        </form>
      ) : null}
    </div>
  );
}

function contextInputs(context: CriteriaActionContext) {
  return (
    <>
      <input name="locale" type="hidden" value={context.locale} />
      <input name="kind" type="hidden" value={context.kind} />
      <input name="resourceId" type="hidden" value={context.resourceId} />
      <input name="projectId" type="hidden" value={context.projectId} />
    </>
  );
}

function reasonInput(catalog: Catalog) {
  return (
    <label>
      {catalog["workspace.form.reason"]}
      <textarea maxLength={1000} name="reason" required />
    </label>
  );
}

function actionStatus(
  catalog: Catalog,
  state: import("./actions").CriteriaActionState,
  pending: boolean,
) {
  const message = pending
    ? catalog["workspace.actionPending"]
    : state.status === "success"
      ? catalog["workspace.actionSuccess"]
      : state.status === "error"
        ? safeErrorMessage(catalog, state.messageKey)
        : "";
  return (
    <div aria-live="polite" className="actionStatus">
      {message}
      {state.status === "error" && state.correlationId !== undefined ? (
        <span>
          {catalog["workspace.errorReference"].replace("{reference}", state.correlationId)}
        </span>
      ) : null}
    </div>
  );
}

function safeErrorMessage(
  catalog: Catalog,
  key: import("./actions").CriteriaActionState["messageKey"],
) {
  if (key === "errors.unauthorized") return catalog["errors.unauthorized"];
  if (key === "errors.forbidden") return catalog["errors.forbidden"];
  if (key === "errors.notFound") return catalog["errors.notFound"];
  if (key === "errors.validation") return catalog["errors.validation"];
  return catalog["errors.internal"];
}
