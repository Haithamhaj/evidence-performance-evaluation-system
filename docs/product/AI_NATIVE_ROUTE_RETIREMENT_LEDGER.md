# AI-Native Route Retirement Ledger

**Status:** Phase 0B protected route inventory

This ledger inventories every current locale route before later AI-native surface replacement. It is
not a removal authorization. A route marked `REPLACE_AFTER_PARITY` remains available until its listed
parity evidence is recorded and the Product Owner approves removal. `PERMANENT` routes are retained.

The machine-validated records are in
[`ai-native-route-retirement-ledger.json`](./ai-native-route-retirement-ledger.json). The validator
derives the current `[locale]/**/page.tsx` route set, requires every route to appear once, requires
each capability ID to exist in the engine register, and rejects `REMOVE` as premature.

| Current route                                      | Purpose                       | Capability IDs            | Target phase / surface          | Disposition          |
| -------------------------------------------------- | ----------------------------- | ------------------------- | ------------------------------- | -------------------- |
| `/`                                                | Locale landing                | CAP-013, CAP-014          | P1 / today                      | REPLACE_AFTER_PARITY |
| `/[...unmatched]`                                  | Safe unmatched-route recovery | CAP-004                   | P0B / global-shell              | PERMANENT            |
| `/admin/operations`                                | Administrator operations      | CAP-005, CAP-041          | P8 / admin-operations           | REPLACE_AFTER_PARITY |
| `/continuity`                                      | Continuity and handover       | CAP-037                   | P7 / leave-handover             | REPLACE_AFTER_PARITY |
| `/development`                                     | Coaching and development      | CAP-035, CAP-036          | P7 / development                | REPLACE_AFTER_PARITY |
| `/evaluations/[cycleId]`                           | Employee evaluation           | CAP-029                   | P6 / evaluation-self-assessment | REPLACE_AFTER_PARITY |
| `/evaluations/facts`                               | Evaluation Fact View          | CAP-024                   | P6 / evaluation-fact-view       | REPLACE_AFTER_PARITY |
| `/manager-feedback/[cycleId]`                      | Identified manager feedback   | CAP-033                   | P6 / manager-feedback-view      | REPLACE_AFTER_PARITY |
| `/manager/operations`                              | Manager operations            | CAP-023                   | P7 / manager-home               | REPLACE_AFTER_PARITY |
| `/my-work`                                         | Employee work                 | CAP-013, CAP-014          | P1 / today                      | REPLACE_AFTER_PARITY |
| `/notifications`                                   | Notifications                 | CAP-039                   | P8 / notification-center        | REPLACE_AFTER_PARITY |
| `/projects`                                        | Project index                 | CAP-006                   | P3 / projects                   | REPLACE_AFTER_PARITY |
| `/projects/[projectId]`                            | Project overview              | CAP-006, CAP-012          | P3 / project-overview           | REPLACE_AFTER_PARITY |
| `/projects/[projectId]/daily-work`                 | Project daily work            | CAP-015, CAP-017          | P4 / project-update-sheet       | REPLACE_AFTER_PARITY |
| `/projects/[projectId]/readiness`                  | Project readiness             | CAP-018                   | P3 / project-readiness          | REPLACE_AFTER_PARITY |
| `/projects/[projectId]/research`                   | Project research              | CAP-025, CAP-026, CAP-027 | P5 / project-research           | REPLACE_AFTER_PARITY |
| `/projects/[projectId]/settings/progress-contract` | Progress Contract setup       | CAP-011                   | P3 / progress-contract-setup    | REPLACE_AFTER_PARITY |
| `/projects/[projectId]/workstreams/[workstreamId]` | Workstream                    | CAP-006, CAP-010          | P3 / project-criteria-review    | REPLACE_AFTER_PARITY |
| `/settings/connections`                            | Connected-context settings    | CAP-019                   | P2 / settings-connections       | REPLACE_AFTER_PARITY |
| `/tasks`                                           | Task list                     | CAP-013                   | P2 / work-list                  | REPLACE_AFTER_PARITY |

Every record specifies parity evidence, removal approval, and a release-artifact rollback path in
the JSON ledger. No current route is deleted, removed, or rewritten by this contract.
