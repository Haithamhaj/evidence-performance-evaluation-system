# AI-Native Phase 1–3 Experience Handoffs

**Status:** Phase 0A experience definition  
**Authority:** `ENGINE_FEATURE_REGISTER.md`, `ENGINE_FRONTEND_HANDOFF_SCHEMA.md`, and the approved
AI-Native Frontend master plan  
**Scope:** Important Phase 1–3 user moments only; no production runtime contract is created here.

Persona-level positive/negative visibility is defined in `AI_NATIVE_PERSONA_VISIBILITY_MAP.md`.
Action-level strictest autonomy is defined in `AI_NATIVE_INITIAL_AUTONOMY_MAP.md`; these experience
classifications never replace server-side permission or owner-domain authority.

## Reading Rules

- A handoff describes one user moment and smallest useful action, not an entire backend capability.
- Deterministic sorting, authorization, progress calculation, health, and state recovery never
  require an Agent.
- A Work Signal is a real domain/source/scheduled/user-domain event. A click or page view is not a
  Work Signal.
- Every AI or Agent output is a draft or explanation until the named human gate is satisfied.
- `telemetry_key` values are only eligible for future minimized product analytics; collection is not
  enabled in Phase 0A.

## H-001 — Recover an expired or invalid session

- **Capabilities:** CAP-001, CAP-002
- **User/persona:** Any authenticated user
- **Primary action/outcome:** Return safely to sign-in, then resume the intended authorized location.
- **Assistance Mode:** `contextual_status_recovery`
- **Assistance Owner:** `auth_session_domain`
- **Trigger/Activation:** `session_state_changed` or explicit `user_retry`
- **Work Signal:** `none` — authentication status is not work evidence.
- **Experience Workflow Event:** `recovery`
- **Product Telemetry:** `session_recovery_completed` (eligible, minimized)
- **Protected visibility:** Show safe reason and recovery action; never callback JSON, tokens, hidden resource identity, or another user’s state.
- **Freshness requirement:** Revalidate session and active-user state before redirect.
- **Inspection projection:** Mode, safe reason code, correlation ID, and result only.
- **Manual fallback:** Start sign-in again or contact the identity administrator when setup is unavailable.
- **Recovery:** Preserve only the safe return path; stale state fails closed and never loops on the callback.

## H-002 — Read Today

- **Capabilities:** CAP-013, CAP-014, CAP-018, CAP-020
- **User/persona:** Employee or authorized contributor
- **Primary action/outcome:** Understand the smallest useful next action without scanning every Project.
- **Assistance Mode:** `deterministic_assistance`, `proactive_agent_assistance`
- **Assistance Owner:** `work_agent` after deterministic daily composition
- **Trigger/Activation:** `today_read`, `work_domain_event`, or `scheduled_refresh`
- **Work Signal:** `domain` or `scheduled_work_check`; the page view itself is `none`.
- **Experience Workflow Event:** `none`
- **Product Telemetry:** `today_loaded` (eligible without item content or counts tied to performance)
- **Protected visibility:** Own work/private Inbox only; no peer private context, hidden readiness value, rating, or employee rank.
- **Freshness requirement:** Show evaluation time and mark possibly stale source zones.
- **Inspection projection:** Zone reason, source refs, mode, freshness, and owner domain.
- **Manual fallback:** Open My Work/Projects directly and use deterministic due/overdue ordering.
- **Recovery:** One unavailable source becomes an explicit gap; the rest of Today remains usable.

## H-003 — Decide a prepared or ambiguous Today item

- **Capabilities:** CAP-014, CAP-020, CAP-022
- **User/persona:** Employee; Project owner only for ambiguous Project progress
- **Primary action/outcome:** Confirm, correct, or dismiss one clearly explained proposal.
- **Assistance Mode:** `proactive_agent_assistance`
- **Assistance Owner:** `work_agent`, `evidence_research_agent`, or `project_agent` according to the item type
- **Trigger/Activation:** `reviewable_candidate_created`
- **Work Signal:** `connector` or `domain`
- **Experience Workflow Event:** `confirm`, `correct`, or `dismiss`
- **Product Telemetry:** `prepared_item_decided` (eligible; decision content excluded)
- **Protected visibility:** Only authorized source label, reason, confidence/limitations, Project context, and proposed change.
- **Freshness requirement:** Expected version and source freshness must be current before confirmation.
- **Inspection projection:** Capability, mode, Agent/service, safe refs, candidate version, and command result.
- **Manual fallback:** Open the owning Task/Evidence/Project flow and complete the same action manually.
- **Recovery:** Preserve the candidate and correction; stale confirmation reloads authoritative state without duplicating effects.

## H-004 — Review What Changed or deterministic status

- **Capabilities:** CAP-005, CAP-014
- **User/persona:** Employee or authorized operational reader
- **Primary action/outcome:** Understand a meaningful completed change or a recoverable queued/failed state.
- **Assistance Mode:** `deterministic_assistance`, `contextual_status_recovery`
- **Assistance Owner:** `experience_orchestrator` and the owning domain/job service
- **Trigger/Activation:** `durable_job_changed` or `domain_entity_changed`
- **Work Signal:** `domain`; technical retries are not employee work evidence.
- **Experience Workflow Event:** `retry` or `recovery` when user action is required.
- **Product Telemetry:** `change_receipt_opened` (eligible; no work volume or content)
- **Protected visibility:** Meaningful result and smallest next action; no raw queue payload, provider error, prompt/output, or secret.
- **Freshness requirement:** Receipt must reference current authoritative state and dedupe replayed events.
- **Inspection projection:** Operation ID, safe status, correlation ID, owner, and failure code.
- **Manual fallback:** Refresh the owning record or continue the manual workflow while AI is unavailable.
- **Recovery:** Bounded retry; completed operations never rerun merely because the receipt was reopened.

## H-005 — Capture a private thought or new work

- **Capabilities:** CAP-014, CAP-015, CAP-016
- **User/persona:** Employee
- **Primary action/outcome:** Save text, voice, code, file, or link immediately without prematurely sharing it.
- **Assistance Mode:** `on_demand_ai_assistance`
- **Assistance Owner:** `work_agent` and `voice_service` when voice is selected
- **Trigger/Activation:** `capture_requested`
- **Work Signal:** `user_domain_action` only after the raw input is safely stored; typing is not a signal.
- **Experience Workflow Event:** `submit` for private capture; later `confirm` for promotion.
- **Product Telemetry:** `capture_completed` (eligible; input type only, never body)
- **Protected visibility:** Owner-only raw input and connector context until explicit promotion.
- **Freshness requirement:** Draft version is checked before promotion or overwrite.
- **Inspection projection:** Input type, safe storage state, route/schema version when AI was requested, and result.
- **Manual fallback:** Save private Inbox text without AI, Project, or Task creation.
- **Recovery:** Raw input remains safe after AI/transcription failure and can be edited or retried.

## H-006 — Create an official Task

- **Capabilities:** CAP-013, CAP-014, CAP-020
- **User/persona:** Employee, owner, or authorized manager
- **Primary action/outcome:** Create a Project-linked Task with clear owner, state, and optional Workstream.
- **Assistance Mode:** `manual_only`, `on_demand_ai_assistance`
- **Assistance Owner:** `work_items_domain`; `work_agent` may prepare a draft
- **Trigger/Activation:** `task_create_requested` or `task_draft_requested`
- **Work Signal:** `user_domain_action`
- **Experience Workflow Event:** `submit` or `confirm`
- **Product Telemetry:** `task_created` (eligible; no title/body)
- **Protected visibility:** Project scope and assignment policy; private source text is not shared automatically.
- **Freshness requirement:** Project/member scope and expected draft version checked before creation.
- **Inspection projection:** Mode, source refs, draft version, owner domain, and authoritative Task ref.
- **Manual fallback:** Complete the normal Task form without AI.
- **Recovery:** Draft is retained; idempotency prevents duplicate Tasks after retry.

## H-007 — Complete a Task or resolve a dependency

- **Capabilities:** CAP-013, CAP-014
- **User/persona:** Task owner or authorized contributor
- **Primary action/outcome:** Confirm completion or unblock dependent work and see the authoritative result.
- **Assistance Mode:** `deterministic_assistance`, `proactive_agent_assistance`
- **Assistance Owner:** `work_items_domain`; `work_agent` may prepare a follow-up
- **Trigger/Activation:** `task_state_commanded` or `work_dependency_changed`
- **Work Signal:** `user_domain_action` or `domain`
- **Experience Workflow Event:** `confirm` or `submit`
- **Product Telemetry:** `task_state_changed` (eligible; status class only)
- **Protected visibility:** Authorized Task/Project fields only; completion volume is never performance or Project progress.
- **Freshness requirement:** Expected Task version is mandatory before mutation.
- **Inspection projection:** Deterministic dependency result, optional prepared follow-up, and command receipt.
- **Manual fallback:** Change Task state and dependencies directly without AI.
- **Recovery:** Stale version reloads; successful completion is not replayed; follow-up remains optional.

## H-008 — Review private connected context

- **Capabilities:** CAP-019, CAP-020
- **User/persona:** Employee only
- **Primary action/outcome:** Confirm, correct, exclude, or unlink a Gmail/Calendar item and optional Project suggestion.
- **Assistance Mode:** `contextual_status_recovery`, `proactive_agent_assistance`
- **Assistance Owner:** `connected_context_domain` and `work_agent`
- **Trigger/Activation:** `connector_state_changed` or `context_review_requested`
- **Work Signal:** `connector`; opening the review surface is `none`.
- **Experience Workflow Event:** `confirm`, `correct`, `dismiss`, or `recovery`
- **Product Telemetry:** `connected_context_reviewed` (eligible; source content/project excluded)
- **Protected visibility:** Employee-only compact metadata; managers and other roles receive nothing from private context.
- **Freshness requirement:** Sync time and connection health shown; revoked/stale items cannot silently relink.
- **Inspection projection:** Connector type, safe source ref, reason, correction state, and freshness—never email body/attachment.
- **Manual fallback:** Link a Project manually or create a Task/private Inbox item without the connector.
- **Recovery:** Reconnect without duplicates; exclusions and manual corrections persist.

## H-009 — Review a GitHub evidence suggestion

- **Capabilities:** CAP-021, CAP-022
- **User/persona:** Employee; Project owner for ambiguous progress
- **Primary action/outcome:** Accept/correct/reject suggested evidence or review a contract-bound progress proposal.
- **Assistance Mode:** `proactive_agent_assistance`, `contextual_status_recovery`
- **Assistance Owner:** `evidence_research_agent`, `project_agent`, and GitHub integration domain
- **Trigger/Activation:** `github_source_fact_verified`
- **Work Signal:** `connector`
- **Experience Workflow Event:** `confirm`, `correct`, `dismiss`, or `retry`
- **Product Telemetry:** `github_suggestion_decided` (eligible; repository/source data excluded)
- **Protected visibility:** Source ID/URL, supported claim, contribution context, verification state; never “verified performance.”
- **Freshness requirement:** Installation/binding health and source/rule version checked before decision.
- **Inspection projection:** Delivery/source ref, binding/rule version, matcher disposition, candidate state, and owner.
- **Manual fallback:** Upload a snapshot/link/code/file as manual evidence and describe contribution.
- **Recovery:** Reconciliation repairs missed events; duplicates dedupe; revoked connection routes to administrator setup.

## H-010 — Understand Project overview

- **Capabilities:** CAP-006, CAP-008, CAP-009, CAP-012, CAP-017
- **User/persona:** Authorized contributor, Project/Workstream owner, or manager operational reader
- **Primary action/outcome:** Understand purpose, official progress basis, next milestone/gap, and own actions.
- **Assistance Mode:** `deterministic_assistance`, `proactive_agent_assistance`
- **Assistance Owner:** `project_agent` after Projects-domain calculation
- **Trigger/Activation:** `project_overview_requested` or `project_context_changed`
- **Work Signal:** `domain`
- **Experience Workflow Event:** `none`
- **Product Telemetry:** `project_overview_loaded` (eligible; no performance inference)
- **Protected visibility:** Approved contract/snapshot and role-safe gaps; no employee readiness values, rank, or task/activity-derived progress.
- **Freshness requirement:** Active document/contract/snapshot versions and source coverage time are visible.
- **Inspection projection:** Contract/snapshot version, rule refs, source freshness, mode, and owner domain.
- **Manual fallback:** Open documents, contract, timeline, and Tasks through their normal views.
- **Recovery:** Missing sources preserve prior official progress and identify the required evidence/confirmation.

## H-011 — Draft or approve a Progress Contract

- **Capabilities:** CAP-008, CAP-009, CAP-011
- **User/persona:** Project/Workstream owner and authorized approver
- **Primary action/outcome:** Review a source-derived measurable contract and approve a prospective version.
- **Assistance Mode:** `on_demand_ai_assistance`, `manual_only`
- **Assistance Owner:** `project_agent`; Projects domain owns approval/activation
- **Trigger/Activation:** `approved_document_changed` or `progress_contract_draft_requested`
- **Work Signal:** `domain` or `user_domain_action`
- **Experience Workflow Event:** `submit`, `correct`, or `confirm`
- **Product Telemetry:** `progress_contract_reviewed` (eligible; rules/values excluded)
- **Protected visibility:** Authorized source document, draft rule, impact, version, owner, approver; no employee performance language.
- **Freshness requirement:** Draft must cite current approved document version; activation rejects stale versions.
- **Inspection projection:** Source/document version, route/schema, draft version, human disposition, and result.
- **Manual fallback:** Author the measurable contract manually using the approved document.
- **Recovery:** AI failure leaves manual editing available; material changes create a new prospective version only.

## H-012 — Confirm a Project progress change

- **Capabilities:** CAP-012, CAP-022
- **User/persona:** Authorized Project/Workstream owner or approver
- **Primary action/outcome:** Confirm a rule-defined condition or reject/correct an ambiguous proposal.
- **Assistance Mode:** `deterministic_assistance`, `manual_only`
- **Assistance Owner:** `projects_progress_domain`; an Agent may explain but never calculate or decide
- **Trigger/Activation:** `progress_rule_matched` or `progress_review_requested`
- **Work Signal:** `domain` or `connector`
- **Experience Workflow Event:** `confirm`, `correct`, or `dismiss`
- **Product Telemetry:** `progress_proposal_decided` (eligible; values/source excluded)
- **Protected visibility:** Rule, source, calculation basis, prior/current snapshot, and ambiguity; never activity volume or employee score.
- **Freshness requirement:** Active contract/rule/source versions and expected proposal version required.
- **Inspection projection:** Deterministic matcher, rule refs, source refs, snapshot result, and human decision.
- **Manual fallback:** Confirm only the qualitative condition defined by the approved contract; no direct percentage entry.
- **Recovery:** Missing/ambiguous source preserves the prior snapshot; stale decisions reload without overwriting history.

## H-013 — Transfer Project or Workstream ownership

- **Capabilities:** CAP-006, CAP-007
- **User/persona:** Authorized manager; owners as readers
- **Primary action/outcome:** Transfer responsibility prospectively with a complete, visible responsibility window.
- **Assistance Mode:** `deterministic_assistance`, `manual_only`
- **Assistance Owner:** `projects_domain`
- **Trigger/Activation:** `ownership_transfer_requested` or `responsibility_gap_detected`
- **Work Signal:** `user_domain_action` or `scheduled_work_check`
- **Experience Workflow Event:** `submit` or `confirm`
- **Product Telemetry:** `ownership_transfer_completed` (eligible; identities excluded)
- **Protected visibility:** Authorized scope, current/new owner, effective date, continuity impact; AI cannot choose the owner.
- **Freshness requirement:** Current responsibility version checked in the atomic command.
- **Inspection projection:** Scope, safe actor refs, expected version, audit receipt, and result.
- **Manual fallback:** Manager completes the owner-transfer form without AI.
- **Recovery:** Conflict preserves both historical windows and reloads current ownership; no retroactive fact reassignment.

## H-014 — Correct a document or review criteria

- **Capabilities:** CAP-008, CAP-009, CAP-010
- **User/persona:** Employee, owner, contributor, or manager resolver according to scope
- **Primary action/outcome:** Correct the source document or confirm/object to source-bound criteria.
- **Assistance Mode:** `proactive_agent_assistance`, `on_demand_ai_assistance`
- **Assistance Owner:** `project_agent`
- **Trigger/Activation:** `document_analysis_changed` or `criteria_review_required`
- **Work Signal:** `domain`
- **Experience Workflow Event:** `correct`, `confirm`, or `submit`
- **Product Telemetry:** `document_criteria_reviewed` (eligible; content and readiness values excluded)
- **Protected visibility:** Missing section/reason, criteria source/effective date/objections; manager sees only safe readiness state.
- **Freshness requirement:** Document and criteria versions must be current before write.
- **Inspection projection:** Safe source refs, route/schema, version, review state, and owner domain.
- **Manual fallback:** Update the authoritative document and review criteria without AI.
- **Recovery:** Source document remains truth; failed analysis never creates a competing internal answer or retroactive criterion.

## H-015 — Move Research from source to decision

- **Capabilities:** CAP-025, CAP-026, CAP-027
- **User/persona:** Employee/research or experiment contributor; authorized owner/manager reader
- **Primary action/outcome:** Review a source, define a question/experiment, record a conclusion, and link applied learning.
- **Assistance Mode:** `proactive_agent_assistance`, `on_demand_ai_assistance`
- **Assistance Owner:** `evidence_research_agent`
- **Trigger/Activation:** `research_lifecycle_changed` or `research_review_requested`
- **Work Signal:** `domain` or `user_domain_action`
- **Experience Workflow Event:** `submit`, `correct`, `confirm`, or `dismiss`
- **Product Telemetry:** `research_progression_completed` (eligible; source/result content excluded)
- **Protected visibility:** Project-scoped source, method, result, limitations, conclusion, decision, and applied target; private drafts remain owner-only.
- **Freshness requirement:** Source/research/experiment/target versions checked; revoked sources are marked unavailable.
- **Inspection projection:** Safe source lineage, route/schema, lifecycle versions, human confirmations, and result.
- **Manual fallback:** Add links/files/notes, author method and conclusion, then link Task/Document/next Experiment manually.
- **Recovery:** Failed/inconclusive runs remain visible; stale or cross-Project writes fail closed; unapplied learning stays a neutral gap.

## H-016 — Read a manager operational queue

- **Capabilities:** CAP-018, CAP-023
- **User/persona:** Manager; contributor actions only under a separate authorized role
- **Primary action/outcome:** Understand and resolve one blocker, check-in, ownership, or Project gap.
- **Assistance Mode:** `deterministic_assistance`, `proactive_agent_assistance`
- **Assistance Owner:** `manager_operations_agent` after manager-safe owner-domain composition
- **Trigger/Activation:** `manager_queue_requested` or `manager_operation_changed`
- **Work Signal:** `domain`
- **Experience Workflow Event:** `confirm`, `submit`, or `dismiss` according to the owning command.
- **Product Telemetry:** `manager_queue_item_resolved` (eligible; employee identity/content excluded)
- **Protected visibility:** Operational facts only; no individual readiness percentage, productivity score, ranking, leaderboard, private coaching, or private connector context.
- **Freshness requirement:** Queue reason and source state revalidated before action.
- **Inspection projection:** Safe reason, owner domain, source freshness, authorized action, and result.
- **Manual fallback:** Navigate to the owning Project/check-in/continuity record and act there.
- **Recovery:** Unavailable source becomes an explicit gap; unauthorized contributor action remains hidden and server-denied.

## Phase 1–3 Boundary Summary

Deterministic rules own ordering, due/overdue, dedupe, permissions, progress calculation, stale checks,
health, and recovery routing. Agents may understand, connect, summarize, or prepare bounded drafts.
Every protected mutation still executes through the owner-domain command with current version,
idempotency where needed, and the named human gate.
