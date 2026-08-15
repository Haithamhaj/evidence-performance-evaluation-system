# Engine Capability Matrix

**Baseline:** `main` at `a631eaa81a5b462f329e5917c5be3301281f970a`
**Detailed source:** `docs/product/ENGINE_FEATURE_REGISTER.md`

## What the baseline says

| Status            |  Count | Meaning                                                                                  |
| ----------------- | -----: | ---------------------------------------------------------------------------------------- |
| COMPLETE          |     39 | Protected behavior and relevant recovery are implemented and technically verified        |
| PARTIAL           |      2 | Engine depth is intentionally gated by approved human/frontend launch work               |
| EXTERNAL_GATE     |      2 | Engine exists; live use needs an external administrator, credential, consent, or service |
| DEFERRED_APPROVED |      1 | Future private manager-feedback modes are intentionally outside the pilot                |
| SUPERSEDED        |      0 | Superseded directions are listed separately, not counted as capabilities                 |
| **Total**         | **44** |                                                                                          |

This is not a percentage-complete score. The capabilities have different sizes, dependencies, and risks.

## Employee capability view

| Daily employee outcome                                      | Register IDs     | Baseline           | Missing dependency or constraint                                               |
| ----------------------------------------------------------- | ---------------- | ------------------ | ------------------------------------------------------------------------------ |
| Sign in and use the chosen language                         | CAP-001, CAP-004 | Complete / partial | Arabic evaluation remains blocked by T016                                      |
| See Needs My Action, Today, Overdue, and private capture    | CAP-013–014      | Complete           | Final frontend still intentionally absent                                      |
| Create and manage normal Tasks                              | CAP-013          | Complete           | None at engine level                                                           |
| Connect private Gmail/Calendar context                      | CAP-019          | External gate      | Production OAuth approval, admin consent, and credential vault                 |
| Receive explainable Project links and confirm Task drafts   | CAP-020          | Complete           | Real context depends on CAP-019                                                |
| Add text/code/file/voice Updates with AI help               | CAP-015–016      | Complete           | Live model availability                                                        |
| Confirm Evidence and see a source-labelled Timeline         | CAP-017, CAP-022 | Complete           | Live GitHub input depends on CAP-021                                           |
| Complete only necessary Thursday check-ins/readiness action | CAP-018          | Complete           | Full leave lifecycle is pending CAP-037                                        |
| Conduct Research and Experiments as first-class work        | CAP-025–027      | Complete           | Real production API+PostgreSQL E3 checkpoint; final lifecycle UX remains later |
| Review neutral facts before self-assessment                 | CAP-024, CAP-028 | Complete           | English Command Brief journey complete; Arabic remains gated by T016           |
| Submit self-assessment                                      | CAP-028–029      | Complete           | English human-rated journey complete; Arabic remains gated by T016             |
| Compare, discuss, acknowledge, or reserve                   | CAP-031          | Complete           | Human comparison/finalization/acknowledgment journey complete                  |
| Receive coaching and maintain development actions           | CAP-035–036      | Complete           | Shared/formal manager support visible; employee-private context remains hidden |
| Manage leave, handover, and return                          | CAP-037          | Complete           | Exact-scope delegation, expiry, and human-confirmed return UX complete         |

## Project and Workstream owner capability view

| Owner outcome                                                 | Register IDs     | Baseline | Missing dependency or constraint                                  |
| ------------------------------------------------------------- | ---------------- | -------- | ----------------------------------------------------------------- |
| Manage Projects, Workstreams, members, and ownership          | CAP-006–007      | Complete | None at engine level                                              |
| Maintain main documents and safe private artifacts            | CAP-008–009      | Complete | Production object storage/ClamAV configuration                    |
| Review and activate dynamic criteria prospectively            | CAP-010          | Complete | None at engine level                                              |
| Define and approve a measurable Progress Contract             | CAP-011          | Complete | None at engine level                                              |
| Review honest progress and ambiguous source proposals         | CAP-012, CAP-022 | Complete | Live GitHub/Google sources can be externally gated                |
| Confirm Project-level state without duplicating Workstreams   | CAP-018          | Complete | Full leave exemption workflow is pending                          |
| Coordinate Research/Experiment decisions and applied learning | CAP-025–027      | Complete | Real production API+PostgreSQL checkpoint; no final UX acceptance |
| Prepare delegated ownership and handover                      | CAP-037–038      | Complete | Exact scope/window/actions and expiry are visible                 |

## Manager capability view

| Manager outcome                                                | Register IDs     | Baseline | Missing dependency or constraint                                 |
| -------------------------------------------------------------- | ---------------- | -------- | ---------------------------------------------------------------- |
| See operational action queues without employee scoring         | CAP-023          | Complete | Command Brief home, Project context, and source details complete |
| Read source-supported employee facts without readiness leakage | CAP-024, CAP-028 | Complete | English fact-first manager journey complete                      |
| Independently assess an employee                               | CAP-028, CAP-030 | Complete | Independent human manager journey complete                       |
| Compare, discuss, finalize, and preserve human judgment        | CAP-031          | Complete | Human-only finalization journey complete                         |
| Read identified upward feedback truthfully                     | CAP-033          | Complete | Named originals and completion are available to the manager      |
| Support coaching and formal development                        | CAP-035–036      | Complete | Shared/formal support visible; private details remain hidden     |
| Approve leave/delegation and resolve reassignment              | CAP-037–038      | Complete | Human-gated delegation/return and deactivation queue are connected |
| Generate authorized reports without ranking                    | CAP-032          | Complete | Live storage configuration; Arabic evaluation blocked at T016    |

## System administrator and operations capability view

| Operational outcome                                   | Register IDs     | Baseline       | Missing dependency or constraint                                                           |
| ----------------------------------------------------- | ---------------- | -------------- | ------------------------------------------------------------------------------------------ |
| Govern identity, permissions, and protected audit     | CAP-001–002      | Complete       | Production OIDC administrator configuration                                                |
| Govern AI routes without exposing provider secrets    | CAP-003          | Complete       | Live provider/service credentials                                                          |
| Operate durable jobs and correlation                  | CAP-005          | Complete       | Production Redis/worker deployment                                                         |
| Configure Google and GitHub connectors                | CAP-019, CAP-021 | External gate  | Provider consoles, administrator approvals, and secrets                                    |
| Configure organizations, templates, routes, retention | CAP-040          | Complete       | Production identity/integration administrators remain externally required                  |
| Monitor health and investigate safely                 | CAP-041–042      | Complete       | Engine controls/runbooks pass; production telemetry and secrets remain external gates      |
| Notify users                                          | CAP-039          | Complete       | Live email provider remains an external gate                                               |
| Back up and restore                                   | CAP-043          | Complete/local | Encrypted isolated drill passes; production target/key custody/human restore gate remain   |
| Run and launch the pilot                              | CAP-044          | Partial        | Technical dry run passes; E7, final frontend, external setup and Product Owner gate remain |

## Dependency spine

```text
Governance foundation (CAP-001–005)
  └─ Projects/Documents/Criteria (CAP-006–010)
      ├─ Progress Contract and operational progress (CAP-011–012)
      ├─ Daily Tasks/Inbox/Updates/Evidence (CAP-013–018)
      │   ├─ Google + Context Intelligence (CAP-019–020)
      │   └─ GitHub + Suggested Evidence (CAP-021–022)
      ├─ Manager Operations + Fact View (CAP-023–024)
      └─ Research & Experiments (CAP-025–027)
          └─ Evaluation cycle and assessments (CAP-028–033)
              └─ Coaching and Development (CAP-035–036)

Continuity, notifications, administration, security, recovery, and launch
(CAP-037–044) cross-cut every branch and finish after the core workflows.
```

## Concepts that look similar but must not be merged

| Concept A                    | Concept B                           | Required separation                                                                             |
| ---------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| Project operational progress | Employee performance rating         | Progress follows an approved measurable contract; rating is quarterly/semiannual human judgment |
| Documentation Readiness      | Evaluation or performance score     | Readiness only reveals representation gaps; it never becomes a score or quota                   |
| GitHub source event          | Employee contribution evidence      | GitHub is a suggestion until the employee confirms contribution context                         |
| Source-supported fact        | Employee interpretation             | Fact View labels and displays them separately                                                   |
| Work Item completion         | Milestone/KPI progress              | A Task may propose a change but cannot calculate progress by volume                             |
| Project/Workstream owner     | People manager                      | Ownership coordinates work; it does not grant managerial evaluation authority                   |
| Private Inbox/context        | Manager operations                  | Private employee context never crosses to the manager                                           |
| Evaluation readiness         | Evaluation workflow                 | Readiness is monthly operational aid; evaluation is a frozen human decision cycle               |
| Research source consumption  | Applied learning                    | Reading volume is not value; a confirmed change/decision/transfer is required                   |
| Activity Timeline            | Generic activity/analytics platform | Timeline is append-only work history; no second store or volume analytics                       |

## Existing verification surfaces that are not final product UX

| Route                                                       | What it proves technically                  | What it does not prove                             |
| ----------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------- |
| `/[locale]/my-work`                                         | daily composition, update/evidence flows    | final low-friction employee home                   |
| `/[locale]/tasks`                                           | Work Item API and task interaction          | final task-management information architecture     |
| `/[locale]/settings/connections`                            | Google connection privacy/recovery contract | production OAuth approval or final settings design |
| `/[locale]/projects/[projectId]/settings/progress-contract` | draft/review/approval contract              | final guided Project setup                         |
| `/[locale]/projects/[projectId]/readiness`                  | readiness-safe projection                   | employee scoring or final dashboard                |
| `/[locale]/manager/operations`                              | role-safe operational queues                | final manager product experience                   |
| `/[locale]/evaluations/facts`                               | neutral Fact View and privacy contract      | Arabic employee release before T016                |
| `/[locale]/evaluations/[cycleId]`                           | full fact-first human evaluation journey    | Arabic employee release before T016                |
| `/[locale]/manager-feedback/[cycleId]`                      | identified employee/manager feedback path   | future blinded or anonymous modes                  |

## Engine capabilities awaiting final product entry points

The engine contracts are present; these are frontend-design needs, not missing engines:

- CAP-025–027: dedicated everyday Research/Experiment progression.
- CAP-039: notification interactions and preference entry points remain in Phase 8.
- CAP-040–043: administrator console and protected operations views.
- CAP-044: Product Owner acceptance and production launch controls.

## E7 handoff conclusion

E3–E6 are technically complete. E7 reconciled all 44 records with no `PLANNED` pilot engine
capability remaining. The next program is final intelligent-frontend design, followed by Product
Owner acceptance and external production setup; temporary verification routes are not the design
baseline.
