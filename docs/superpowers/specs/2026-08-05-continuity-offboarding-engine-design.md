# Continuity & Offboarding Engine Design

**Status:** Product Owner approved as part of the Complete Engine Program on 2026-08-05  
**Program:** E6A  
**Capability scope:** CAP-037–CAP-038 and T064–T070

## 1. Outcome

Preserve fair work continuity and historical attribution during approved leave, planned/emergency delegation, return, account deactivation, and reassignment—without becoming an HR leave-balance system or allowing System Administrator reassignment decisions.

## 2. Domain ownership

Add one bounded Continuity domain for leave records, manager approval events, handover roots/revisions/items, delegate confirmations/access gaps, delegation roots/periods/scope, return handovers, reassignment-required cases, and retention-policy references.

Projects continues to own Project/Workstream responsibility windows and permanent ownership; Auth/Identity owns account activation; Evaluation owns cycle eligibility snapshots; Updates & Evidence owns substantive updates; Documents owns source artifacts. Continuity orchestrates them through transaction-aware public commands/readers and never updates their tables arbitrarily.

## 3. Leave workflow

States are `DRAFT → SUBMITTED → APPROVED/REJECTED → ACTIVE → RETURNED/CANCELLED`. The record contains employee, UTC interval, reason category with minimal private detail, affected scopes, and manager decision. It does not store leave balance, entitlement, payroll, or formal HR approval.

Approved leave suspends weekly check-in requirements, missing-update alerts, response/regularity analysis, and configured evaluation/upward-feedback obligations for the covered interval. The exclusion is explicit in eligibility/fact projections and never becomes negative performance evidence.

## 4. Handover

Each affected Project/Workstream requiring continuity gets a versioned handover with current/completed/open work, blockers/risks, immediate next step, key links/repositories, required access, pending decisions/external responses, proposed delegate, and period. AI may produce a completeness draft with cited confirmed sources; the employee corrects it. The manager approves delegation, not technical truth.

## 5. Delegation activation

The manager approves the scope/period/delegate. The delegate reviews, confirms receipt/access, and may report missing access/information. Normal activation occurs only after confirmation. Emergency activation requires a manager reason and audit.

Activation transactionally creates time- and scope-bounded Acting Owner authority and corresponding Project/Workstream responsibility windows. The delegate receives existing operational owner powers only within the approved scope and period. Every action remains attributed to the actual actor and marked with the active delegation/responsibility reference.

## 6. Return

Before expiry, the Acting Owner creates a Return Handover covering completed work, decisions, changes, open work, risks, and next steps. Original owner confirmation atomically ends acting authority and returns responsibility. If confirmation is missing, the manager may finalize return, extend delegation, or invoke the existing permanent owner-transfer command with a reason.

Expired authorization fails closed even if the UI/session is stale. No background job may extend access implicitly.

## 7. Deactivation and reassignment

System Administrator may deactivate an account immediately; authentication stops while all historical foreign keys and records remain. Active owned Projects/Workstreams generate `REASSIGNMENT_REQUIRED` cases and manager-critical notifications.

Only the manager decides new owner, pause, closure, merge, or permanent reassignment through owner-domain commands. The administrator cannot choose a replacement. Former employee identity remains visible in historical ownership, contribution, evaluation, reservation, and development records under policy.

## 8. Retention foundation

Versioned retention policies define future organization/data-type periods and archive/hide behavior. The pilot performs no automatic historical deletion. Archive changes operational discovery only and cannot break source references, audit, closed snapshots, or legal/operational holds.

## 9. Authorization, privacy, and audit

- Employee manages their draft/request and handover content.
- Manager approves leave/delegation, activates emergencies, resolves return/reassignment.
- Delegate reads only the proposed/active scoped handover and confirms access.
- System Administrator deactivates accounts and manages technical retention configuration, not reassignment.
- Leave detail is minimized; operational projections expose only needed availability/state.
- Approval, activation, emergency reason, access-gap report, Acting Owner action, return, deactivation, archive, and reassignment are audited.

## 10. Failure and recovery

- Activation/return/transfer are serializable and atomic with responsibility windows/audit.
- Duplicate confirmations and deactivation requests are idempotent.
- Access gaps keep delegation pending unless emergency override is authorized.
- If deactivation precedes handover, history remains and a manager queue item is created.
- Queue/notification failure never opens or extends authority.
- Clock-boundary tests cover start, end, timezone rendering, overlapping contributor windows, and expired sessions.

## 11. Extensibility

Leave categories, approval policy, required handover sections, delegation scope, emergency policy, return options, retention policy, and archive projection are versioned configuration. Future HRIS integration may supply approved leave through an adapter but cannot import balances/payroll logic into this domain.

## 12. Verification

- Leave/check-in/evaluation exemption tests.
- Planned/emergency delegation transaction and permission tests.
- Actual-actor attribution and responsibility-window tests.
- Return/extend/permanent-transfer concurrency tests.
- Deactivation/history/reassignment role-separation tests.
- Retention/archive reference-integrity tests.
- End-to-end planned leave, emergency delegation, return, and deactivation-before-reassignment journeys.

## 13. Exit gate

Planned and emergency continuity journeys pass with exact authority periods, attribution, historical preservation, and manager/admin separation; no employee is penalized for approved leave and no unresolved P0/P1 remains.
