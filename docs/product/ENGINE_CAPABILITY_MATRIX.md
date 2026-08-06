# Engine Capability Matrix

**Baseline:** `main` at `1db6bb1372c7e9d91cf09f770728034f6dc3fe57`
**Detailed source:** `docs/product/ENGINE_FEATURE_REGISTER.md`

## What the baseline says

| Status            |  Count | Meaning                                                                                  |
| ----------------- | -----: | ---------------------------------------------------------------------------------------- |
| COMPLETE          |     21 | Protected behavior and relevant recovery are implemented and tested                      |
| PARTIAL           |      6 | Useful foundations exist, but the approved user capability is not complete               |
| PLANNED           |     14 | Required by the approved product, with no complete production capability                 |
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
| Review neutral facts before self-assessment                 | CAP-024          | Complete           | Immutable cycle snapshot depends on CAP-028                                    |
| Submit self-assessment                                      | CAP-028–029      | Partial / planned  | Evaluation cycle engine and self-assessment are missing                        |
| Compare, discuss, acknowledge, or reserve                   | CAP-031          | Planned            | Depends on both submitted assessments                                          |
| Receive coaching and maintain development actions           | CAP-035–036      | Planned            | Depends on verified fact sources and human acceptance                          |
| Manage leave, handover, and return                          | CAP-037          | Planned            | Continuity domain is missing                                                   |

## Project and Workstream owner capability view

| Owner outcome                                                 | Register IDs     | Baseline        | Missing dependency or constraint                                  |
| ------------------------------------------------------------- | ---------------- | --------------- | ----------------------------------------------------------------- |
| Manage Projects, Workstreams, members, and ownership          | CAP-006–007      | Complete        | None at engine level                                              |
| Maintain main documents and safe private artifacts            | CAP-008–009      | Complete        | Production object storage/ClamAV configuration                    |
| Review and activate dynamic criteria prospectively            | CAP-010          | Complete        | None at engine level                                              |
| Define and approve a measurable Progress Contract             | CAP-011          | Complete        | None at engine level                                              |
| Review honest progress and ambiguous source proposals         | CAP-012, CAP-022 | Complete        | Live GitHub/Google sources can be externally gated                |
| Confirm Project-level state without duplicating Workstreams   | CAP-018          | Complete        | Full leave exemption workflow is pending                          |
| Coordinate Research/Experiment decisions and applied learning | CAP-025–027      | Complete        | Real production API+PostgreSQL checkpoint; no final UX acceptance |
| Prepare delegated ownership and handover                      | CAP-037–038      | Planned/partial | E6                                                                |

## Manager capability view

| Manager outcome                                                | Register IDs     | Baseline          | Missing dependency or constraint            |
| -------------------------------------------------------------- | ---------------- | ----------------- | ------------------------------------------- |
| See operational action queues without employee scoring         | CAP-023          | Complete          | Final manager UX not designed               |
| Read source-supported employee facts without readiness leakage | CAP-024          | Complete          | Cycle snapshot must be completed in CAP-028 |
| Independently assess an employee                               | CAP-028, CAP-030 | Partial / planned | E4                                          |
| Compare, discuss, finalize, and preserve human judgment        | CAP-031          | Planned           | E4                                          |
| Read identified upward feedback truthfully                     | CAP-033          | Planned           | E5 and active cycle engine                  |
| Support coaching and formal development                        | CAP-035–036      | Planned           | E5                                          |
| Approve leave/delegation and resolve reassignment              | CAP-037–038      | Planned/partial   | E6                                          |
| Generate authorized reports without ranking                    | CAP-032          | Planned           | Closed evaluation snapshot required         |

## System administrator and operations capability view

| Operational outcome                                   | Register IDs     | Baseline      | Missing dependency or constraint                                  |
| ----------------------------------------------------- | ---------------- | ------------- | ----------------------------------------------------------------- |
| Govern identity, permissions, and protected audit     | CAP-001–002      | Complete      | Production OIDC administrator configuration                       |
| Govern AI routes without exposing provider secrets    | CAP-003          | Complete      | Live provider/service credentials                                 |
| Operate durable jobs and correlation                  | CAP-005          | Complete      | Production Redis/worker deployment                                |
| Configure Google and GitHub connectors                | CAP-019, CAP-021 | External gate | Provider consoles, administrator approvals, and secrets           |
| Configure organizations, templates, routes, retention | CAP-040          | Partial       | Unified admin domain/API is missing                               |
| Monitor health and investigate safely                 | CAP-041–042      | Partial       | Telemetry destination, incident and retention procedures          |
| Notify users                                          | CAP-039          | Planned       | Notification domain and email provider                            |
| Back up and restore                                   | CAP-043          | Planned       | Backup target, encrypted procedure, restore drill                 |
| Run and launch the pilot                              | CAP-044          | Planned       | E3–E7, final frontend, external configuration, Product Owner gate |

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

| Route                                                       | What it proves technically                  | What it does not prove                              |
| ----------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------- |
| `/[locale]/my-work`                                         | daily composition, update/evidence flows    | final low-friction employee home                    |
| `/[locale]/tasks`                                           | Work Item API and task interaction          | final task-management information architecture      |
| `/[locale]/settings/connections`                            | Google connection privacy/recovery contract | production OAuth approval or final settings design  |
| `/[locale]/projects/[projectId]/settings/progress-contract` | draft/review/approval contract              | final guided Project setup                          |
| `/[locale]/projects/[projectId]/readiness`                  | readiness-safe projection                   | employee scoring or final dashboard                 |
| `/[locale]/manager/operations`                              | role-safe operational queues                | final manager product experience                    |
| `/[locale]/evaluations/facts`                               | neutral Fact View and privacy contract      | self/manager assessment or final evaluation journey |

## Engine capabilities with no current journey entry point

- CAP-025–027 now have a real production API+PostgreSQL lifecycle test plus a separate deterministic fixture UI checkpoint; the dedicated everyday lifecycle UI is intentionally deferred to the final frontend program.
- CAP-028–033: complete evaluation cycle, self/manager assessment, finalization, reports, and upward manager evaluation.
- CAP-035–039: coaching, development, leave/delegation/handover, and notifications.
- CAP-040: most administration and configuration.
- CAP-043–044: backup/restore and pilot launch control.

## Gap-controlled execution order

1. **E3 — Research & Experiments:** technical engine checkpoint complete; continue to E4 without treating its provisional screen as final UX.
2. **E4 — Employee Evaluation:** complete immutable cycle, self-assessment, independent manager assessment, discussion, and finalization.
3. **E5 — Manager Evaluation + Coaching:** identified upward feedback, transparent coaching, and accepted development actions.
4. **E6 — Continuity + Operations:** leave, delegation, handover, notification, exports, administration, security, backup, and launch preparation.
5. **E7 — Re-audit:** every `COMPLETE` claim, source/API contract, failure state, and protected visibility is checked before final frontend design.
