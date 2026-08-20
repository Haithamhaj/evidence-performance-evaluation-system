# Codex Dogfood Project Document v7 Design

**Status:** Approved for implementation by the Product Owner on 2026-08-14

## Outcome

Create an append-only Project Document v7 for the real Codex dogfood Project, use only that bounded
document as the source for a new AI-prepared Progress Contract draft, and stop before any human save,
submission, approval, or activation action.

## Current problem

The Project currently points to Project Document v6. That document describes an older Phase 2 scope,
while the repository and product have progressed through the Work experience and most of the Project
Workspace. Regenerating from v6 would produce a technically valid but operationally stale contract.

## Design

1. Add one concise repository document that states the current baseline and the remaining stage gates.
2. Make the dogfood seed select that document only. It may cite the master plan, but the AI input will
   not concatenate old plans or task ledgers that could reintroduce stale requirements.
3. Pin source lineage to the current Phase 1 pull request (#30) and exact base/head commits.
4. Append the source as Project Document v7 through the existing Documents service. Project Document
   v6 and earlier versions remain immutable.
5. Request a new draft through `project.progress-contract.draft` in the existing AI Router.
6. Review the generated components in the authenticated Product Owner flow.
7. Stop before the protected human gate. No automated save, submission, approval, activation, snapshot,
   percentage, or historical reclassification is allowed.

## Progress semantics

- Recommended calculation rule: `stage_gate`.
- Recommended weights: none.
- Progress is determined only from approved gate conditions and authorized human confirmation.
- Task count, update frequency, GitHub activity, commits, files, and lines changed are excluded.
- Project progress is never employee performance.
- The only numeric operational KPI in the source is protected-boundary violations: baseline `0`, target
  `0`, unit `confirmed violations`, direction `maintain`.
- Past work may support an authorized initial baseline after activation, but v7 does not apply criteria
  retroactively or rewrite historical records.

## Remaining stage gates

1. Phase 3 Project Workspace closure.
2. Phase 4 Updates, Voice, Sources, and Evidence.
3. Phase 5 Research, Experiments, Decisions, and Applied Learning.
4. Phase 6 Evaluation with employee self-assessment and manager human judgment.
5. Phase 7 Manager Operations and Continuity.
6. Phase 8 Insights, Connections, Reports, Administration, localization, and accessibility readiness.
7. Phase 9 Internal Beta hardening and launch decision.

## Failure and recovery

- If source append fails, no new document version is claimed.
- If AI generation fails, v7 remains approved and the existing manual contract path remains available.
- Re-running the same source/version is idempotent.
- Provider output is schema-validated and cannot bypass the protected human gate.
- Credentials and provider content are never printed or committed.

## Verification

- Focused runtime test proves the dogfood source is exactly v7 and PR lineage is #30.
- Focused script test, lint, typecheck, formatting, and secret scan for changed files.
- Real local seed receipt confirms append-only v7.
- Real AI Router receipt confirms a new draft tied to v7.
- Browser review confirms the exact proposed components and that no activation occurred.
