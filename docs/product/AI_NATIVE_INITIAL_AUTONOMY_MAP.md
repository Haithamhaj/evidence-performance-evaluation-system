# AI-Native Initial Autonomy Map

**Status:** Phase 0A action-level bounds for H-001–H-016  
**Rule:** Each row records the strictest applicable class. `auto_with_undo` is disabled because Phase
0A selects no production action with a real compensation command.

## Classes

| Class              | Meaning                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------- |
| `observe`          | Read and explain authorized state; no draft or mutation                                 |
| `prepare`          | Produce an editable candidate/draft; a human decision is still required                 |
| `auto_maintenance` | Run approved deterministic upkeep with no consequential human decision                  |
| `auto_with_undo`   | Disabled in Phase 0A; requires an approved action and durable compensation command      |
| `confirm`          | A named human confirms/corrects/dismisses a prepared candidate through the owner domain |
| `human_only`       | The decision/action remains exclusively human or protected operator work                |

## Action Map

| Handoff | Action                           | Strictest class | Boundary                                                                                    |
| ------- | -------------------------------- | --------------- | ------------------------------------------------------------------------------------------- |
| H-001   | Recover session                  | `human_only`    | User/IdP administrator completes authentication; status routing is deterministic            |
| H-002   | Read Today                       | `observe`       | Deterministic composition may run; no user/business mutation                                |
| H-003   | Decide prepared item             | `confirm`       | Candidate is editable; owner-domain command and current version required                    |
| H-004   | Read change/status or retry      | `confirm`       | Receipts are observe-only; a user explicitly starts bounded retry/recovery                  |
| H-005   | Capture private input            | `confirm`       | Raw save is user command; AI output never promotes/shares itself                            |
| H-006   | Create official Task             | `human_only`    | Human selects/accepts Project, assignment, content, and create command                      |
| H-007   | Complete Task/dependency         | `human_only`    | Authorized Task owner/contributor changes shared state                                      |
| H-008   | Review private connected context | `confirm`       | Employee confirms/corrects/excludes/links; OAuth consent is human-only                      |
| H-009   | Decide GitHub suggestion         | `confirm`       | Employee confirms contribution Evidence; owner handles ambiguous progress                   |
| H-010   | Read Project overview            | `observe`       | Projects domain calculates progress deterministically                                       |
| H-011   | Draft/approve Progress Contract  | `human_only`    | AI may prepare; authorized owner/approver activates a version                               |
| H-012   | Confirm progress condition       | `human_only`    | Human confirms only a contract-defined qualitative condition; no direct percentage override |
| H-013   | Transfer ownership               | `human_only`    | Authorized manager selects and executes prospective transfer                                |
| H-014   | Correct document/review criteria | `confirm`       | Human changes source or confirms/objects; activation is human-only                          |
| H-015   | Research-to-decision progression | `confirm`       | Human confirms source disposition, method, conclusion, decision, and applied target         |
| H-016   | Resolve manager operational item | `human_only`    | The manager/owner executes the specific domain action; Agent only prepares context          |

## Initial Automatic Maintenance

Only deterministic presentation upkeep is eligible before a later production plan selects exact
commands: due/overdue ordering, dedupe, retirement of resolved Today projections, freshness/status
classification, and receipt curation. It does not alter Tasks, assignments, evidence, progress,
criteria, evaluation, ownership, or external systems.

## Inputs That Cannot Increase Authority

The following are prohibited inputs to permission or autonomy selection:

- AI/model confidence;
- user acceptance rate or prior confirmation history;
- inferred trust, inferred skill, or personalization;
- Product Telemetry or navigation behavior;
- activity volume, GitHub volume, readiness, or evaluation data;
- Agent recommendation.

The effective class is the strictest bound from the engine maximum, protected product rules,
organization policy, Project/Progress Contract, current permission/scope/version, and user preference
only where that preference can further restrict behavior. Unknown action/signal/output fails closed.

## Future `auto_with_undo` Gate

It remains disabled until a later Product Owner decision names one real action with explicit
permission, expected version, idempotency, bounded side effects, a genuine compensation command,
durable receipt, undo expiry, and partial-failure recovery. It cannot affect Evaluation, another
person, consequential ownership, or a shared deadline without separate approval.
