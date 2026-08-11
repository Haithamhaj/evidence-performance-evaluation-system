# ADR-0001: Separate Work Signals, Experience Workflow Events, and Product Telemetry

**Status:** Accepted for Phase 0A experience definition  
**Date:** 2026-08-11  
**Scope:** Frontend experience architecture; production contracts remain just-in-time after D0/G0.

## Context

The intelligent frontend needs to react to real work, accept human decisions, and later measure UX
quality. Treating all three as a generic event stream would allow page views or clicks to influence
assistance, Project progress, Evidence, Evaluation, or permissions. That would violate product rules
and create an unnecessary generic activity platform.

## Decision

Maintain three closed, versioned, and directionally isolated registries:

1. **Work Signals** represent authorized domain, connector, scheduled-work-check, or explicit
   user-domain meaning. Unknown keys fail closed.
2. **Experience Workflow Events** represent confirm/correct/dismiss/retry/submit/recovery decisions
   and dispatch only to a named owner-domain command.
3. **Product Telemetry** represents minimized, approved UX/performance evidence. It has no import,
   dispatch, or data path to orchestration, autonomy, permissions, Project progress, Evidence facts,
   Evaluation, manager decisions, or protected commands.

Production TypeScript contracts, SSE projections, and collectors are implemented just-in-time after
D0/G0 for the first real consumer. Phase 0A defines taxonomy and forbidden dependency directions
only.

## Forbidden Dependency Directions

```text
Product Telemetry -X-> Experience Orchestrator
Product Telemetry -X-> Autonomy/Permissions
Product Telemetry -X-> Project Progress
Product Telemetry -X-> Evidence or Contribution Facts
Product Telemetry -X-> Evaluation or Manager Decisions
Experience Workflow Event -X-> Generic/Arbitrary Mutation
UI Interaction -X-> Work Signal
Unknown Work Signal -X-> Fallback Handler
```

## Consequences

- Proactive assistance can start only from authorized work meaning, not employee activity tracking.
- Every human decision resolves through a domain command and authoritative reload.
- Telemetry can be disabled or changed without affecting product behavior.
- The implementation may contain small adapters but must not create a second event store, generic
  activity platform, or parallel source of truth.
- Later production contracts require import-boundary tests proving the prohibited directions.
