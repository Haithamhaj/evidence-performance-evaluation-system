# PROJECT_STATE.md

## Current Goal

Execute AI-Native Frontend Phase 1 in bounded vertical slices. T087 Universal Capture, T088 Work
Signals/Experience Events, T089 Minimal Experience Orchestrator, and T090 Intelligent Today are
complete; T091 What Changed and durable SSE recovery are next. Preserve every engine authority and
rollback path.

## Current Reality

- Phase 0, Phase 1, Phase 2, engine checkpoints E3–E7, and the approved Phase 0A direction are merged
  through `main` baseline `e211ad4`.
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
- The approved Phase 0A master plan and immutable engine source receipt are stored in-repository.
- The Phase 0A branch starts from clean `main` at `2eee638958294b790c75375d564d5c03188062f2`.
- Product Owner selected visual direction 2, **Command Brief**, from the required three independent
  Today directions.
- The standalone synthetic Command Brief prototype now covers English/Arabic, RTL, 390px, role-visible
  navigation, Today state previews, decision, prepared draft, capture, recovery, focus return, and
  What Changed disclosure. Its focused Playwright and design-QA gates are green.
- The Product Owner reviewed the runnable Arabic employee route and approved D0 on 2026-08-11.
- D0 evidence is transparent: the Product Owner also provided the less-technical/employee-journey
  perspective, architecture feasibility was technically reviewed, and distinct employee/manager
  sessions remain a bounded pre-G0 follow-up.

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
- Phase 0A is documentation and an isolated synthetic prototype only. It cannot select production
  tokens, primitives, components, dependencies, navigation, or agent runtime contracts.
- Work Signals, Experience Workflow Events, and Product Telemetry remain three separate systems;
  product interaction data cannot become project progress, evidence, evaluation input, or authority.
- Command Brief is the selected D0 visual direction. It remains a non-production prototype and does
  not approve production tokens, components, dependencies, navigation, or runtime contracts.
- Positive D0 authorized Phase 0B planning. The bounded T078–T086 implementation plan now covers
  exact handoffs, tokens, primitives, Storybook/testing, boundaries, the Stable Shell, protected
  Inspection Mode, route retirement, the Phase 1 graph, and G0 evidence.
- T078–T085 are implemented on the Phase 0B branch: exact handoffs, Command Brief tokens, accessible
  primitives, Storybook/visual QA, frontend/telemetry boundaries, the role-aware Stable Shell, and
  the protected Inspection Mode plus a 20/20 route-retirement ledger and executable Phase 1 graph
  are verified.
- T086 technical evidence is complete: the 44-capability distribution, ten exact handoffs, 20/20
  retained routes, 94-task graph, 1,427 unit tests, five Storybook tests, four Stable Shell E2E
  journeys, lint, typecheck, builds, source boundaries, and design QA pass.
- Gate G0 is approved. The Product Owner accepted the documented participant overlap and instructed
  execution to continue; Phase 1 is authorized in the approved T087–T094 order.
- T087 is complete: authenticated employees can privately capture text, links, code, safe files, or
  images, review the raw draft, and save it to their owner-bound Inbox without creating official work,
  project progress, evidence, or evaluation input. English/Arabic desktop/mobile and recovery states
  are visually verified; the real Arabic employee journey persisted one synthetic note successfully.
- T088 is complete: confirmed private capture atomically records an owner-scoped Work Signal, the
  dedicated worker delivers it idempotently, and the authenticated shell shows it in What Changed.
  An unrelated user receives nothing; queue/API failure presents truthful recovery without losing the
  last delivered item. Experience events and disabled product telemetry remain separate non-authority
  zones.
- T089 is complete: the orchestrator reads only authorized Context Intelligence and Daily Work
  sources, prepares at most one editable action/question, persists a versioned append-only projection,
  and never executes a domain command. A dedicated worker is wired without a duplicate consumer.
  Bilingual semantic quarantine blocks rating, ranking, readiness, calculated-progress, and
  activity-volume performance inferences while allowing neutral daily-work language. The real local
  Project Task returned one truthful deterministic proposal; one live provider response was safely
  quarantined and requires later prompt tuning rather than weaker product protection.
- T090 is complete: the authenticated employee Today surface composes the real Daily Work snapshot,
  at most one prepared item, and one source-backed Project decision. Confirm, correct, and dismiss
  remain protected Context Intelligence commands; stale correction stays editable and dismissal
  creates no evidence or progress. English desktop, Arabic RTL mobile, recovery, rollback, build,
  accessibility, and the independent P0/P1 review are verified.
- Pull Request #29 remains open and unmerged; retained routes remain unchanged.

## Active Risks

- Real-provider quality, latency, and recovery require production credentials and deployment-time
  monitoring; deterministic tests verify contracts, not provider quality.
- The first live T089 provider probe was safely quarantined by the protected semantic guard. Prompt
  tuning is a non-blocking follow-up; deterministic fallback remains truthful and functional.
- Production Google/GitHub/OIDC/email/storage/telemetry/backup require administrator configuration,
  minimum permissions, secrets, consent, and key custody.
- Arabic employee evaluation/export remains blocked until T016 approved Arabic content and semantic
  review; normal Arabic/RTL foundations remain required in the final frontend.
- Intelligent Today is now proven at desktop and 390px in English/Arabic. T091 still needs to replace
  explicit What Changed refresh with durable SSE reconnect and exactly-once visible replay.
- A separate independent manager participant did not attend G0. The Product Owner accepted this
  overlap and deferred the direct manager session until the complete Phase 1 experience can be
  meaningfully reviewed.

## Protected Areas

- All protected product, AI, privacy, history, authorization, audit, evaluation, and localization
  rules in `AGENTS.md`.
- `docs/PROJECT_REFERENCE.md`, `docs/EVALUATION_RUBRIC.md`, and `docs/IMPLEMENTATION_PLAN.md` cannot be
  rewritten to fit implementation without explicit approval.
- T016 artifacts cannot be activated or released without the protected human language gate.
- Pilot launch and any shared/production restore remain direct human decisions.

## Next Recommended Action

Execute T091 What Changed and durable SSE on the existing isolated Phase 1 branch: stream only
authorized receipts, reconnect from the durable cursor without duplicate actions, and preserve the
existing explicit-refresh rollback. Do not merge Pull Request #29 or remove retained routes.

## Critical References

- `AGENTS.md`
- `TASKS.md`
- `docs/PROJECT_REFERENCE.md`
- `docs/EVALUATION_RUBRIC.md`
- `docs/product/ENGINE_FEATURE_REGISTER.md`
- `docs/product/ENGINE_CAPABILITY_MATRIX.md`
- `docs/product/ENGINE_CUSTOMER_JOURNEY_MAP.md`
- `docs/product/ENGINE_FRONTEND_HANDOFF_SCHEMA.md`
- `docs/product/AI_NATIVE_FRONTEND_SOURCE_SNAPSHOT.md`
- `docs/reviews/AI_NATIVE_FRONTEND_D0_EVIDENCE.md`
- `docs/decisions/AI_NATIVE_FRONTEND_D0_DECISION.md`
- `docs/superpowers/plans/2026-08-11-ai-native-frontend-master-plan.md`
- `docs/superpowers/plans/2026-08-11-ai-native-frontend-phase-0a.md`
- `docs/superpowers/plans/2026-08-11-ai-native-frontend-phase-0b.md`
- `docs/superpowers/plans/2026-08-11-ai-native-frontend-phase-1.md`
- `docs/product/AI_NATIVE_ROUTE_RETIREMENT_LEDGER.md`
- `docs/reviews/ENGINE_BIDIRECTIONAL_TRACE.md`
- `docs/reviews/ENGINE_FINAL_VERIFICATION.md`
- `docs/reviews/ENGINE_COMPLETION_AUDIT.md`
- `docs/operations/EXTERNAL_GATE_REGISTER.md`
- `docs/acceptance/ENGINE_TECHNICAL_DRY_RUN.md`
- `project-state/SYSTEM_MAP.html`
