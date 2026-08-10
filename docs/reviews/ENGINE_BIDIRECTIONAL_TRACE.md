# Engine Bidirectional Trace

**Audit date:** 2026-08-10

**Code baseline:** `main` at `a631eaa81a5b462f329e5917c5be3301281f970a`

**Scope:** production engine contracts, not final page design

## Result

Every approved pilot capability is owned by an existing module or an explicit program boundary.
No pilot engine capability remains `PLANNED`. No second activity/evidence store, client-owned product
rule, microservice, direct feature-to-provider AI call, or volume-based progress/performance input was
introduced.

## Source → capability → implementation

| Approved concern                                                    | Capability IDs | Production ownership                                                          | Primary executable evidence                                                    |
| ------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Identity, permission, audit, AI routing, localization, durable work | CAP-001–005    | auth, permissions, audit, ai-routing, localization, API/worker infrastructure | unit/integration suites; protected API matrix; AI boundary scan                |
| Projects, ownership, documents, readiness, criteria                 | CAP-006–010    | projects, documents, criteria                                                 | package integration, authorization, document-analysis and Phase 1 acceptance   |
| Progress Contract and operational progress                          | CAP-011–012    | projects                                                                      | progress-contract tests and Slice 5 acceptance                                 |
| Tasks, My Work, Updates, Evidence, check-ins                        | CAP-013–018    | work-items, updates-evidence, daily-work composition                          | package/API integration and Slices 1–6 acceptance                              |
| Google/GitHub inputs and context intelligence                       | CAP-019–022    | connected-work, github integration, context intelligence                      | deterministic adapter/API tests; live installation remains an external gate    |
| Manager operations and neutral facts                                | CAP-023–024    | daily-work/evaluation-preparation composition                                 | safe-projection and Fact View tests                                            |
| Research, Experiments, decisions, applied learning                  | CAP-025–027    | research-experiments                                                          | real PostgreSQL/API lifecycle and E3 acceptance                                |
| Employee evaluation and human final judgment                        | CAP-028–032    | employee-evaluation, reporting                                                | real-DB/API lifecycle, immutability tests, E4/E6B acceptance                   |
| Identified upward feedback and future-mode boundary                 | CAP-033–034    | manager-evaluation                                                            | real-DB/API authorization, future-mode fail-closed tests, E5A acceptance       |
| Coaching and development                                            | CAP-035–036    | coaching-development                                                          | real-DB/API/AI tests and E5B acceptance                                        |
| Leave, delegation, return, deactivation, reassignment               | CAP-037–038    | continuity with Auth/Projects public commands                                 | real-DB/API/cross-domain tests and E6A acceptance                              |
| Notifications, administration, health                               | CAP-039–041    | notifications, administration, observability                                  | package/API/worker tests and E6B acceptance                                    |
| Hardening, recovery, dry run                                        | CAP-042–044    | cross-cutting controls and operations scripts                                 | protected matrix, retention, restore drill, resilience checks, 8-stage dry run |

## Implementation → approved source

| Public implementation family                                   | Approved owner                                     | Register mapping     | Boundary decision                                               |
| -------------------------------------------------------------- | -------------------------------------------------- | -------------------- | --------------------------------------------------------------- |
| `/api/v1/projects`, Workstreams, documents, criteria, progress | Projects/Documents/Criteria                        | CAP-006–012          | Owner modules retain state and transaction rules                |
| `/api/v1/work-items`, daily work, updates/evidence             | Work Items/Updates & Evidence/composition          | CAP-013–018          | No generic activity platform or second store                    |
| Connected-work and GitHub routes/jobs                          | Connector adapters plus source-domain confirmation | CAP-019–022          | Imported data stays private/suggested until a human confirms it |
| Research/Experiment routes and AI drafts                       | Research & Experiments plus AI Router              | CAP-025–027          | Sources and results never become activity-volume metrics        |
| Employee and manager evaluation routes                         | Separate evaluation domains                        | CAP-028–034          | AI cannot select, predict, or recommend ratings                 |
| Coaching/development routes                                    | Coaching & Development                             | CAP-035–036          | Employee controls private/share/accept/reject decisions         |
| Continuity and offboarding routes                              | Continuity orchestrating public owner commands     | CAP-037–038          | Administrator deactivates; manager alone resolves ownership     |
| Notification/export/admin/health routes and workers            | Operations packages                                | CAP-032, CAP-039–043 | Composition does not transfer authority from source domains     |

## Protected separations confirmed

- Project progress follows an approved measurable contract; it is not employee performance.
- GitHub, Tasks, commits, files, lines, and update counts cannot calculate progress or ratings.
- Documentation Readiness remains a non-scoring aid and manager-safe projections omit individual values.
- Fact View separates source-supported facts from employee interpretation.
- Employee self-assessment and initial manager assessment stay independent until both are submitted.
- Final employee rating remains the manager’s human decision; AI schemas contain no rating output.
- Pilot upward feedback is truthfully `IDENTIFIED`; future private modes remain disabled and fail closed.
- Leave and acting responsibility use exact time/scope boundaries and preserve historical attribution.

## Approved non-engine gates

- Arabic employee evaluation: approved rubric content and semantic review (T016).
- Live Google/GitHub, identity, model, email, storage, telemetry, and backup services: production
  credentials/administrator setup.
- Final daily-use product interface: separate frontend design and Product Owner acceptance.
- Pilot launch and any shared/production restore: direct human approval.
