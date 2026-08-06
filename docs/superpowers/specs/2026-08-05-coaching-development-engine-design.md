# Coaching & Development Engine Design

**Status:** Product Owner approved as part of the Complete Engine Program on 2026-08-05  
**Program:** E5B  
**Capability scope:** CAP-035–CAP-036 and T060–T063

## 1. Outcome

Turn authorized, source-supported work patterns and completed human evaluation discussions into transparent non-scoring coaching and employee-controlled development actions, including optional shared actions and formal plans, without continuous performance judgment.

## 2. Domain ownership

Add one bounded Coaching & Development domain. It owns coaching insight revisions/sources, employee response, personal development action revisions/privacy/status, manager support comments/resources, and formal development plans/agreement/status/evidence links.

It consumes authorized public facts from Daily Work, Research & Experiments, Evaluation Preparation, completed Evaluation decisions, identified manager-feedback themes where policy permits, eligibility/responsibility, Work Items, Evidence, notifications, audit, and AI Router. It does not read source-domain tables or calculate performance ratings.

## 3. Coaching insight

An insight contains:

- observed pattern stated neutrally;
- cited source facts and period;
- affected Project/Workstream or development area when relevant;
- confidence category and basis;
- limitations, conflicting evidence, and missing context;
- what the engine cannot conclude;
- optional editable next-action draft;
- prompt/schema/model-route trace.

Patterns may cover documentation gaps, blocker repetition, research method, experiment completeness, applied learning, development-plan progress, or the employee’s own historical behavior. Volume alone, leave, one incident, Project prestige, or visibility cannot create a negative insight.

## 4. Audience and privacy

Employee insights are private drafts until the employee reviews them. A manager may receive separately authorized team/individual coaching projections derived only from manager-visible sources; the manager never receives a private employee action, rejection reason, personal note, or protected readiness value.

Manager feedback and Coaching remain separate: an identified upward response is not automatically converted into an employee coaching judgment.

## 5. Employee decision

The employee may `ACCEPT`, `EDIT_AND_ACCEPT`, `DEFER`, `REJECT`, or `SUPERSEDE` an insight/action. The decision and revision are append-only. Rejection reason and personal notes remain private. AI cannot impose the action or mark it accepted.

Accepted actions may remain `PRIVATE` or become `SHARED`. Sharing exposes only the approved title, status, target date, and employee-selected context.

## 6. Personal development action

An action stores objective, reason, expected benefit, concrete activity, optional related Project/Research/Task, target date, completion-evidence definition, privacy, status, and revision history. States are `DRAFT → ACCEPTED → ACTIVE → COMPLETED`, with `DEFERRED`, `CANCELLED`, and `SUPERSEDED` paths.

The action may appear through the existing Today/Work Item composition but remains a development record, not an ordinary task-volume or performance input.

## 7. Manager support

For a shared action the authorized manager may append a supportive comment, suggest training/resource/application opportunity, or request discussion. The manager cannot edit the employee action, change its status/date/privacy, disclose a private note, or convert it to a formal plan without employee approval.

## 8. Formal development plan

A formal plan is proposed after an evaluation/development discussion and requires employee and manager agreement. It includes development area, reason, expected behavior, activities/training/application, follow-up owner, target date, completion evidence, source evaluation/action references, and versioned status.

States are `DRAFT → EMPLOYEE_APPROVED → MANAGER_AGREED → ACTIVE → COMPLETED/CLOSED`, with reasoned revision or withdrawal. Completion links confirmed evidence; it does not infer improved performance or modify a closed evaluation.

## 9. AI behavior

AI may draft insights and action wording through versioned routes with citations. Output schemas reject rating, rank, productivity score, predicted evaluation, promotion/discipline recommendation, leave penalty, evidence quota, and unsupported causal claim. Provider failure preserves manual creation/review.

## 10. Failure and recovery

- Low confidence or conflicting sources produce a transparent review state, not a conclusion.
- Employee responses and edits use optimistic versions and idempotency.
- Sharing/revoking future sharing changes projection prospectively while preserving audit/history.
- Notification failure does not change action status.
- Source deletion/retention never breaks the stable source reference or silently rewrites an insight.

## 11. Extensibility

Insight types, action templates, privacy options, manager-support policy, formal-plan workflow, and AI routes are versioned configuration. Future training catalogs or learning connectors use public resource adapters; payroll, promotion, discipline, ranking, and forced plans remain outside scope.

## 12. Verification

- Pattern qualification and prohibited-analytics unit tests.
- Public source-reader and responsibility-period integration tests.
- Employee-private, manager-safe, share/revoke, and rejection-reason isolation tests.
- AI bilingual grounding/no-rating evaluations.
- Action and formal-plan state/concurrency/audit tests.
- Evidence-link and Today-composition tests proving no score/volume input.
- End-to-end insight → employee decision → shared support → agreed formal plan journey.

## 13. Exit gate

A realistic employee receives a source-explained insight, edits/accepts one private or shared action, completes the agreement flow for a formal plan, and preserves privacy/history without AI judgment or unresolved P0/P1.
