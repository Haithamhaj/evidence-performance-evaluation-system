# Protected API Matrix

Status: E6C machine-checked boundary register. The executable source is
`scripts/validate-protected-api-matrix.mjs`; this document explains the classifications.

| Route family                                    | Boundary                                       | Positive/negative evidence         | Audit rule                                            |
| ----------------------------------------------- | ---------------------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| `/health`                                       | Public, bounded                                | health controller tests            | No private diagnostics; status only                   |
| `/audit`                                        | System Administrator                           | audit authorization integration    | `audit.query`                                         |
| `/api/v1/projects`, documents, criteria         | Authenticated resource scope                   | owner module integration tests     | domain mutation/read-sensitive events                 |
| `/api/v1/work-items`, private inbox, daily work | Employee/resource scope                        | owner module tests                 | domain mutation events                                |
| `/api/v1/connected-work`, context               | Owner-only private source scope                | connected-work/context integration | private-source access and mutation events             |
| `/api/v1/updates`, timeline, evidence, voice    | Employee/resource scope                        | updates/evidence integration       | confirmation/access events                            |
| `/api/v1/github/webhook`                        | Signed external ingress                        | GitHub integration                 | idempotent webhook receipt/reconciliation             |
| `/api/v1/employee-evaluation` and fact view     | Frozen cycle/assignment scope                  | employee evaluation integration    | every protected transition/read-sensitive event       |
| `/api/v1/manager-evaluation`                    | Frozen visibility policy                       | manager evaluation integration     | original response access before return                |
| `/api/v1/coaching`                              | Employee/private/shared scope                  | coaching integration               | decisions, privacy changes, manager support           |
| `/api/v1/research`, experiments                 | Project/research participant scope             | research integration               | append-only lifecycle events                          |
| `/api/v1/continuity`                            | Employee/manager/admin plus exact acting scope | continuity integration             | leave, delegation, return, deactivation, reassignment |
| `/api/v1/operations`                            | Owner or System Administrator by exact action  | operations integration             | export/admin/health operations                        |

The validator scans every registered API controller. A new controller fails repository verification
until it is assigned to an explicit route family with an existing positive and negative test file and
an audit rule. Authentication alone never substitutes for resource authorization.

“Audit rule” means a mutation or sensitive read is appended to the owning domain/audit stream. Normal
bounded list reads may be covered by the server-side policy decision and request correlation rather
than a persistent read event. This avoids turning ordinary employee activity into surveillance data.
