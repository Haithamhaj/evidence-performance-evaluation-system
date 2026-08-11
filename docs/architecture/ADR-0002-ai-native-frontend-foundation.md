# ADR-0002 — AI-Native Frontend Foundation Boundaries

**Status:** Accepted for Phase 0B implementation  
**Date:** 2026-08-11  
**Decision owner:** Product Owner  
**Experience direction:** Command Brief, approved at Gate D0

## Context

The engine is complete enough to support the final frontend, but the current Next.js pages are
technical verification surfaces. The final daily experience must be simpler without moving business
rules, permissions, progress, evidence, evaluation, or AI routing into the browser.

## Decision

### Composition and ownership

- Next.js routes load authorized initial state and compose feature entry points.
- `apps/web/src/features` owns bounded user workflows and may consume public contracts, safe web
  platform adapters, and product UI.
- `apps/web/src/product-ui` owns product-specific composition and language.
- `packages/ui` owns generic accessible primitives only and contains no product/domain meaning.
- A feature cannot import another feature's internals. Cross-feature reads use an approved public
  reader/composition contract.
- `apps/web/src/server` is server-only and cannot be imported by Client Components.

### State and data

- Server Components perform authenticated initial reads where practical.
- Client Components begin at the lowest interactive boundary.
- The URL owns shareable selection, view, filter, grouping, and cursor state.
- Local client state owns only drawers, dialogs, selection, local drafts, pending presentation, and
  focus return.
- There is no global business store. Browser caches cannot become permission, progress, evidence, or
  evaluation authority.

### Stable shell and adaptive content

- Navigation, global entries, locale/auth, and protected action placement remain stable.
- Authorized role/scope determines visible navigation; UI visibility is not authorization.
- Adaptive behavior ranks or prepares content inside known regions. It cannot generate arbitrary
  layouts or move sensitive decisions.
- Universal Capture, Search/Command, Chat, and What Changed receive honest foundation entries in
  Phase 0B; their complete behavior starts only after G0.

### AI and execution

- Future specialized Agents sit above the existing AI Router. They never call providers directly,
  access arbitrary domain persistence, or replace protected commands.
- Chat is a channel into the same governed capabilities, not a master agent.
- Phase 0B adds no Work Signal runtime, Experience Orchestrator, production Today composition, or
  SSE runtime.
- Future SSE carries durable experience receipts. It is not a source of business truth and must
  reconnect without replaying successful commands.

### Event separation

- Work Signals represent real domain, connector, scheduled-work, or user-domain facts.
- Experience Workflow Events represent explicit confirm, correct, dismiss, retry, submit, and
  recovery actions routed to protected commands.
- Product Telemetry represents minimized product-use data only.
- Product Telemetry cannot flow into orchestration authority, autonomy, project progress, evidence
  facts, evaluation, or manager decisions.

### Styling and accessibility

- Use semantic tokens, CSS Modules, cascade layers, and logical properties.
- Adopt one accessible primitive suite behind product-owned wrappers after compatibility evidence.
- New components must be reviewable in Storybook across keyboard/focus, English/Arabic, RTL/LTR,
  desktop/390px, high contrast, and reduced motion.
- Existing route styles remain in a legacy layer until route parity and removal approval.

## Rejected alternatives

- A second frontend, microfrontends, or package-per-screen architecture.
- A global Redux/Zustand/Jotai business store.
- A second AI Router, master agent, frontend agent framework, or generative layout protocol.
- Direct domain-table access or direct provider SDK calls from the web application.
- Treating page views, clicks, or dwell time as work evidence, progress, or performance.
- Deleting temporary routes before parity evidence and a rollback path exist.

## Consequences

- The daily experience can become simpler while engine authority remains unchanged.
- Feature removal and rollback remain bounded.
- Some Phase 1 experiences require new composition readers, but those readers must use public domain
  interfaces and are explicitly recorded as deltas rather than invented in the client.
- Phase 0B has more foundation tests but does not run the full engine suite after every small change.

## Enforcement

- `scripts/validate-ai-native-phase-1-2-handoffs.mjs`
- Phase 0B frontend/telemetry import validator (T082)
- Storybook interaction/accessibility gate (T081)
- Route retirement ledger and validator (T084)
- Gate G0 evidence and Product Owner decision (T086)
