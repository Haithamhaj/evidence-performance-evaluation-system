# AI-Native IA D0 Validation Protocol

**Status:** Phase 0A research protocol  
**Decision owner:** Product Owner  
**Purpose:** Validate information hierarchy and recurring destinations before production navigation,
tokens, primitives, shell, or runtime contracts are selected.

## Hypotheses

1. Today is the default employee home and reduces scanning/decision burden.
2. Work is discoverable as a complete manual Task system without Chat.
3. Projects connect work, progress, documents, evidence, and research without a page per capability.
4. Research placement may differ by role/frequency; top-level, Project-contextual, and
   Today/Search entry must be compared.
5. Evaluation should remain top-level and deliberately stable.
6. Manager and Admin destinations appear only by authorized role and stay conceptually separate.
7. Mobile can use fewer persistent destinations while preserving the same mental model and direct
   access to capture/Today/Work.

## Questions to Resolve at D0

- Is Research top-level for daily technical users, inside Project for occasional users, contextual
  from Today/Search, or a role-dependent combination?
- Is Development primarily inside Today/Profile, or does repeated use justify top-level placement?
- Do Insights belong within Project/Profile rather than a global destination?
- Are Connections only in Settings, with contextual health links from Project/Admin?
- Should Notifications be a drawer/What Changed access rather than a persistent page?
- Which desktop destinations become mobile bottom navigation, menu, or contextual deep links?
- Can users reach frequent actions quickly without turning the sidebar into a feature register?

## Participants

Minimum representative internal set:

- Product Owner.
- One daily employee who manages Tasks, Projects, Updates, and Evidence.
- One manager who is also a Project owner where applicable.
- One less-technical internal user.
- One architecture feasibility reviewer focused on public contracts and boundary realism.

Where possible, include both Arabic/RTL and English/LTR usage and at least one 390px mobile session.
These are product usability sessions, not employee performance observation.

## Common Scenario

Every participant receives the same synthetic Project and state:

- one decision about an ambiguous Project/source link;
- one prepared Update or Task;
- two real Tasks due/continuing;
- one meaningful What Changed receipt;
- one Project with a contract-based progress gap;
- one research source leading to an experiment/decision;
- one manager/admin scenario only when the role applies.

## Tasks

1. Start the day and identify the next human decision.
2. Continue a normal Task without using Chat.
3. Capture new work privately, then find the path to an official Project-linked Task.
4. Explain why a prepared item appeared and whether it is safe to confirm.
5. Find the Project’s official progress basis and missing source/confirmation.
6. Add or review a paper/repository/link and decide whether it belongs to the Project’s Research.
7. Find Evaluation and explain the separation between facts, self-rating, manager rating, and AI.
8. Recover from stale data, unavailable AI, and a revoked connector using a manual path.
9. Manager: resolve one operational queue item without seeing protected readiness/private context.
10. Admin/operations: find connection/health/recovery guidance without receiving business authority.

## Evidence to Record

For each task, record:

- completion path and destination chosen;
- wrong-destination count and backtracking;
- comprehension of Needs Decision, Prepared, deterministic status, Agent job, What Changed, and
  manual-only states;
- whether source, why, freshness, and consequence were understood;
- decision burden and unnecessary choices;
- discovery of manual fallback without prompting;
- mobile/RTL/bidi/keyboard/focus/reduced-motion issue;
- qualitative confidence: what the participant believed would happen before acting.

Do not collect update counts, active time, dwell, keystrokes, productivity, performance, rankings,
readiness values, or surveillance-style employee analytics. Notes identify interaction problems, not
employee ability.

## Success Conditions

- Every participant identifies Needs Your Decision and the manual Work path.
- No participant mistakes Project progress for employee performance.
- No participant believes a prepared item is already authoritative.
- Employees find source/why/freshness and at least one manual fallback.
- Managers do not expect private context or readiness percentages.
- Pilot upward feedback is understood as Identified.
- No unresolved P0/P1 usability or feasibility defect blocks the primary Today/Work/Project path.
- Research placement and mobile navigation have an evidence-backed disposition, even if bounded
  follow-up remains.

## Decision Record

D0 records one state:

- `APPROVED`;
- `APPROVED_WITH_BOUNDED_CORRECTIONS` listing exact blockers and one correction cycle; or
- `NOT_APPROVED` listing the artifact and evidence that must change.

A positive D0 records the selected visual direction and IA disposition. It authorizes Phase 0B
planning only, not production UI or Phase 1 runtime implementation.
