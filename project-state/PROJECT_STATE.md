# PROJECT_STATE.md

## Current Goal

Hold at the Phase 2 Slice 2 product-owner gate with a runnable Arabic-first preview, verified interactive updates, evidence confirmation, and append-only Timeline.

## Current Reality

- Phase 0 was squash-merged through Pull Request #1 to `main` at `04c42c5`; hosted CI run `29540996315` passed integrity, quality, build, and integration on the merged commit.
- Phase 1 is complete on `codex/phase-1-projects-workstreams-documents` through Bundles A–D (T018–T029): governed responsibility, safe immutable documents, source-bound analysis, human-approved prospective criteria, and the Arabic-first bilingual workspace.
- Bundle D exposes browser data and mutations only through the same-origin Next.js gateway. Server-side sessions and bearer tokens stay outside Client Components; upstream calls use exact approved paths, and role-scoped controls refresh from protected API actions after every successful mutation.
- A frozen eligible contributor whose current workstream access ended receives only the authorized criteria snapshot: no current people, document, or readiness data. Contributor responses become immutable after one submission.
- Deterministic browser verification covers Arabic/English routing, RTL/LTR, mixed technical text, 390px layout, keyboard focus, project/workstream details, frozen contributor responses, historical criteria-only access, and manager-safe readiness. It makes no live paid model call.
- Phase 1 introduced no protected product-rule change and no T029 database migration.
- T016 remains draft and inactive on `deferred/arabic-rubric-v1` at `3ebbe54`, tracked by GitHub issue #2. It is an Arabic employee-release gate, not an engineering-phase dependency.
- The Open-Source Reuse Assessment approved interaction patterns only. No candidate source, assets, translations, schema, backend, authentication, or sync logic may be copied.
- The previous T030–T044 execution order and prototype-era backend/vertical-slice drafts are superseded and must not resume.
- An isolated Arabic-first Product Reset acceptance prototype now demonstrates My Work, Inbox, Projects, Workstreams, shared Work Item views, text/voice updates, evidence confirmation, manager operations, and Evaluation Fact View using synthetic in-memory data only.
- The prototype adds no production database, API, queue, authentication, AI provider call, or Phase 1 backend change.
- The product owner approved the final production structure: preserve Phase 0/1; add only bounded Work Items and Updates & Evidence modules; keep versioned Progress Contracts inside Projects; compose authorized daily-work reads at the application layer; keep GitHub and voice as connectors.
- The approved Progress Contract forbids Work Item/task/update/GitHub volume as progress inputs, has no direct percentage override, retains the previous official percentage when source coverage is insufficient, and preserves source-explained decreases through append-only snapshots.
- The active production planning artifacts are `docs/superpowers/specs/2026-07-18-phase-2-daily-work-progress-design.md`, `docs/product/PHASE_2_FEATURE_MAP.md`, and `docs/superpowers/plans/2026-07-18-phase-2-daily-work-progress-plan.md`.
- Phase 2 production execution is approved. Slice 1 is complete on `codex/phase-2-updates-evidence-readiness`: migrations `0012`–`0013`, bounded Work Items, versioned document-sourced Progress Contracts, append-only official progress snapshots, protected daily-work APIs, Arabic/English My Work and Project progress screens, a real-database synthetic seed, and Playwright screenshots.
- Slice 1 progress is operational Project state only. Work Item volume and employee activity are not calculation inputs, and cross-Project contract decisions are rejected server-side.
- Slice 2 is complete on the same branch: migration `0014`, bounded Updates & Evidence, live multi-turn AI structuring only through `update.structure`, employee-edited drafts, private manual evidence, confirmation gates, protected APIs, and source-labelled Timeline.
- The Arabic/English production UI preserves one question at a time, prefills the evidence claim from the employee-reviewed AI draft, keeps evidence entry inside the update flow, and uses a visible mobile bottom sheet.
- A real local Keycloak login, live GPT-5.5 clarification, evidence confirmation, update confirmation, and Timeline were exercised against PostgreSQL. The configured provider credential was neither printed, moved, nor committed.
- Slice 2 acceptance screenshots are under `docs/product/screenshots/phase-2-production/slice-2/`; the runnable preview is `http://127.0.0.1:3300/ar/my-work`.

## Active Decisions

- Use a modular monolith with three Phase 1 domain packages: `projects`, `documents`, and `criteria`; controllers do not access another module's tables directly.
- Use inline `executing-plans` for routine bounded work. Use independent review for security, authorization, audit, migrations, AI boundaries, and immutability.
- English-only pilot use is permitted. Arabic employee use still requires approved Arabic rubric content and semantic review; localization and RTL foundations remain required.
- AI never assigns or recommends ratings, rankings, productivity scores, or automatic project averages. Documentation Readiness remains a non-scoring operational aid.
- Historical ownership, documents, criteria, acknowledgments, and objections are preserved through append-only rows or prospective versions.
- Project/Workstream progress is operational only, derives from a versioned human-approved document-sourced contract, and never becomes employee performance.
- No user can directly enter or override the official overall progress percentage. Contract-defined qualitative conditions may receive authorized human confirmation and then trigger recalculation.
- Phase 2 stops at Evaluation Fact View preparation; the complete employee self-assessment and manager assessment workflow remains Phase 3.
- T011 remains accepted under its product-owner-bounded direct import/call/meta-call enforcement; provider-key isolation, CI scanning, and human review cover documented static-flow limitations.
- Phase 2 execution proceeds autonomously through bounded slice checkpoints under Fast Controlled Execution; stop only at a protected human gate or genuine unresolved blocker.

## Active Risks

- Uploaded content remains untrusted; deployed size/archive policy values and ClamAV signatures require active operational maintenance.
- Live-model quality and production queue/storage operations still require deployment-time evaluation and monitoring; deterministic verification confirms governed contracts, not provider output quality.
- Arabic employee release remains blocked at T016's protected human semantic-review gate.
- The known non-blocking T013 recovered-running attempt-count telemetry issue remains outside Phase 1 scope.
- The prototype remains reference-only. Production update structuring now uses the governed AI Router; GitHub suggestions, voice, check-ins/readiness, manager operations, and Fact View preparation remain in Slices 3–7.
- The production plan contains multiple security-, migration-, AI-, privacy-, and immutability-critical slices. Fast Controlled Execution remains the default, with bounded critical reviews only where those boundaries are touched.
- Local verification currently uses Node.js 24.14.0 while the repository pins 24.18.0; pnpm is the required 11.13.0 and the complete Slice 1 checks pass. CI remains the exact-runtime confirmation.

## Protected Areas

- All protected product, AI, privacy, historical-record, authorization, audit, localization, and evaluation rules in `AGENTS.md`.
- `docs/PROJECT_REFERENCE.md`, `docs/EVALUATION_RUBRIC.md`, and `docs/IMPLEMENTATION_PLAN.md` cannot be rewritten to fit implementation without explicit approval.
- T016 artifacts must not be imported, activated, or merged into the Phase 1 branch.

## Next Recommended Action

Product owner reviews the running Slice 2 employee journey and screenshots. After approval, begin Slice 3 GitHub suggested evidence; do not start it before this gate.

## Critical References

- `AGENTS.md`
- `TASKS.md`
- `docs/PROJECT_REFERENCE.md`
- `docs/EVALUATION_RUBRIC.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/superpowers/specs/2026-07-17-phase-1-projects-workstreams-documents-design.md`
- `docs/superpowers/specs/2026-07-18-product-direction-reset-prototype-design.md`
- `docs/superpowers/specs/2026-07-18-phase-2-daily-work-progress-design.md`
- `docs/superpowers/plans/2026-07-18-phase-2-daily-work-progress-plan.md`
- `docs/product/PHASE_2_FEATURE_MAP.md`
- `docs/product/PHASE_2_DAILY_WORK_EXPERIENCE.md`
- `docs/product/PHASE_2_BACKEND_DELTA.md`
- `docs/product/PHASE_2_VERTICAL_SLICES.md`
- `docs/product/PHASE_2_INTERACTION_REFERENCE_REGISTER.md`
- `docs/superpowers/plans/2026-07-17-phase-1-bundle-a-project-responsibility.md`
- `docs/superpowers/plans/2026-07-17-phase-1-bundle-b-documents.md`
- `docs/superpowers/plans/2026-07-17-phase-1-bundle-c-analysis-criteria.md`
- `docs/superpowers/plans/2026-07-18-phase-1-bundle-d-project-workstream-ui.md`
- GitHub issue #2 and `deferred/arabic-rubric-v1`
