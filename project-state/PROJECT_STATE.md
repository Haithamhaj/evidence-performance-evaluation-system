# PROJECT_STATE.md

## Current Goal

Review and accept the E7 engine handoff, then build the final intelligent frontend from verified user
journeys and protected public contracts. Keep live-provider setup, Arabic evaluation release,
production launch, and shared restore behind their existing gates.

## Current Reality

- Phase 0, Phase 1, Phase 2, and engine checkpoints E3–E7 are merged through `main` baseline
  `a631eaa81a5b462f329e5917c5be3301281f970a`.
- E7 state is `READY_FOR_FINAL_FRONTEND_DESIGN`: 44 capabilities reconcile to 39 complete,
  2 approved partial, 2 external gates, and 1 approved deferred; none remains planned.
- The pilot engine is technically complete and connected across daily work, Projects, Research,
  evaluation, coaching, continuity, notifications, reports, administration, and recovery.
- Temporary Next.js pages are contract-verification surfaces, not the final daily employee/manager
  interface.
- The next program consumes `docs/product/ENGINE_CUSTOMER_JOURNEY_MAP.md` and
  `docs/product/ENGINE_FRONTEND_HANDOFF_SCHEMA.md`; it must not recreate business rules in the browser.
- ClickUp remains a clean-room interaction reference only. No ClickUp code, schema, data, asset, API,
  or dependency is part of the product.

## Active Decisions

- Keep the daily experience simple: Needs My Action, Today, Overdue, universal capture, and one useful
  assistant question/action at a time.
- Project progress follows the approved Progress Contract only; raw Task/update/GitHub volume cannot
  calculate it and it is never employee performance.
- GitHub/Google/manual sources remain private or suggested until the required human confirmation.
- AI prepares, connects, summarizes, and drafts; it never selects/recommends a rating or bypasses a
  human gate.
- Final employee rating is the manager’s human decision. Pilot upward feedback remains truthfully
  `IDENTIFIED`.
- Preserve the modular monolith and public domain ownership; no microservice, generic activity
  platform, second store, or package-per-screen architecture.

## Active Risks

- Real-provider quality, latency, and recovery require production credentials and deployment-time
  monitoring; deterministic tests verify contracts, not provider quality.
- Production Google/GitHub/OIDC/email/storage/telemetry/backup require administrator configuration,
  minimum permissions, secrets, consent, and key custody.
- Arabic employee evaluation/export remains blocked until T016 approved Arabic content and semantic
  review; normal Arabic/RTL foundations remain required in the final frontend.
- Final daily usability, mobile behavior, and visual coherence are unproven until the dedicated
  frontend acceptance program.

## Protected Areas

- All protected product, AI, privacy, history, authorization, audit, evaluation, and localization
  rules in `AGENTS.md`.
- `docs/PROJECT_REFERENCE.md`, `docs/EVALUATION_RUBRIC.md`, and `docs/IMPLEMENTATION_PLAN.md` cannot be
  rewritten to fit implementation without explicit approval.
- T016 artifacts cannot be activated or released without the protected human language gate.
- Pilot launch and any shared/production restore remain direct human decisions.

## Next Recommended Action

Product Owner reviews `docs/reviews/ENGINE_COMPLETION_AUDIT.md` and the customer-journey/frontend
handoff. After acceptance, begin final frontend Slice 1: shell/navigation, universal capture, My Work,
Tasks, and Project overview. Do not reopen completed engine architecture for visual concerns.

## Critical References

- `AGENTS.md`
- `TASKS.md`
- `docs/PROJECT_REFERENCE.md`
- `docs/EVALUATION_RUBRIC.md`
- `docs/product/ENGINE_FEATURE_REGISTER.md`
- `docs/product/ENGINE_CAPABILITY_MATRIX.md`
- `docs/product/ENGINE_CUSTOMER_JOURNEY_MAP.md`
- `docs/product/ENGINE_FRONTEND_HANDOFF_SCHEMA.md`
- `docs/reviews/ENGINE_BIDIRECTIONAL_TRACE.md`
- `docs/reviews/ENGINE_FINAL_VERIFICATION.md`
- `docs/reviews/ENGINE_COMPLETION_AUDIT.md`
- `docs/operations/EXTERNAL_GATE_REGISTER.md`
- `docs/acceptance/ENGINE_TECHNICAL_DRY_RUN.md`
- `project-state/SYSTEM_MAP.html`
