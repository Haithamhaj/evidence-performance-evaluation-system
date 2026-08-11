# AI-Native Persona and Visibility Map

**Status:** Phase 0A protected projection definition  
**Rule:** UI visibility never grants authority. Every row assumes server-side role, scope,
responsibility-window, cycle-mode, and active-user enforcement.

## Positive and Negative Visibility

| Persona                  | May see                                                                                                                                                                                                                       | Must not see                                                                                                                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Employee                 | Own private Inbox and connected Gmail/Calendar summaries; own Tasks, Updates, Evidence, detailed Documentation Readiness; own self-assessment; accepted/private coaching according to choice                                  | Another employee’s private context, private coaching, draft self-assessment, or manager assessment before allowed comparison; AI rating advice                                                                           |
| Contributor              | Authorized Project/Workstream facts, shared documents, active criteria, relevant Tasks/Timeline/Evidence, own contribution and objections                                                                                     | Owner-only private drafts, unrelated Projects, another employee’s private context/readiness/self-rating/coaching                                                                                                         |
| Primary Project Owner    | Authorized Project state, members, documents, Progress Contract/snapshots, cross-workstream gaps, Project Timeline                                                                                                            | Manager authority, employee ratings, private connector context, individual readiness percentage/rank, private coaching                                                                                                   |
| Primary Workstream Owner | Authorized Workstream state, contributors, document/criteria/check-in/history, relevant Project context                                                                                                                       | Project-wide or managerial authority outside scope; private employee context/readiness/rating/coaching                                                                                                                   |
| Acting Owner             | The exact owner actions and facts allowed by active scope/time window, with handover context                                                                                                                                  | Any scope or time outside delegation; original-owner attribution for acting-period work; employee evaluation authority                                                                                                   |
| Manager                  | Department operational queues, Projects/Workstreams, coarse readiness states, authorized Evaluation Fact View and independent assessment; identified upward-feedback identity/status/ratings/comments/timestamps in the pilot | Employee private Gmail/Calendar/Inbox, detailed readiness values/rankings, private coaching/rejection reason, employee self-rating before manager initial submission, AI rating recommendation                           |
| System Administrator     | Users/roles, global configuration, integrations, AI routes, audit, retention/export and safe health/config status                                                                                                             | Manager’s performance-decision authority, project reassignment decision, employee private connected context, private coaching; unrestricted future-private feedback originals without configured permission/reason/audit |
| Operations               | Safe system health, queue/provider/connection status, backup/restore evidence and runbooks allowed by operational scope                                                                                                       | Business content, employee ratings/readiness/private context/coaching, destructive restore without direct human gate, provider secrets in normal UI                                                                      |
| Deactivated user         | No authentication; historical identity remains on authorized historical records viewed by others                                                                                                                              | Any active session, operational data access, new action, or private source access                                                                                                                                        |

## Protected Cross-Cutting Truths

### Private connected context

Gmail/Calendar compact summaries, exclusions, links, and correction history remain employee-only until
the employee confirms a shared Project object. Connection administration may expose health/config,
not content.

### Documentation Readiness

The employee may receive detailed dimensions and percentages. A manager receives only `Ready`,
`Needs Attention`, or `Missing Critical Information` in an operational context, never a percentage,
ranking, comparison, or value inside rating screens.

### Independent assessment

The employee’s rating and narrative remain hidden from the manager until the manager submits the
independent initial assessment. AI cannot normalize, challenge, predict, or recommend either rating.

### Coaching privacy

Unaccepted suggestions, rejection reasons, and private actions remain employee-only. Shared actions
expose only approved fields. The manager may support but cannot edit status/date or convert an action
to a formal plan without employee approval.

### Upward feedback truth

The pilot is `IDENTIFIED`. The authorized manager sees submitter identity, status, ratings, comments,
and timestamp. The interface must never claim anonymity or confidentiality. Future private modes
remain disabled/fail-closed until approved and frozen in a cycle snapshot.

## Visibility Failure Behavior

- Denied reads return a safe explanation without confirming hidden resource existence.
- Missing role/scope is not repaired by AI confidence, prior acceptance, personalization, or UI state.
- A stale role/responsibility/cycle projection is revalidated before showing protected content.
- Inspection Mode shows safe references and policy disposition only; no secrets, raw private bodies,
  prompts, model output, or chain-of-thought.
