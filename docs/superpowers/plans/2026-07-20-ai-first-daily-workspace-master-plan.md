# AI-First Daily Workspace Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for routine bounded bundles and `superpowers:subagent-driven-development` only for the critical security, privacy, migration, AI-boundary, audit, or immutability tasks identified below. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rejected employee interaction model with a simple AI-first daily workspace while preserving the approved Phase 0, Phase 1, and applicable Phase 2 domain foundations.

**Architecture:** Keep the modular monolith and PostgreSQL as the single source of truth. Extend the existing Work Items, Updates & Evidence, Projects/Progress Contract, AI Router, and authorized Daily Composition boundaries. Add one bounded Connected Work Context package and one bounded Context Intelligence package. Gmail, Calendar, GitHub, voice, and manual capture remain connectors into the same governed lifecycle; they do not become parallel task or progress systems.

**Tech Stack:** TypeScript 7, Node.js 24, pnpm 11, NestJS, Next.js App Router, React, Prisma/PostgreSQL, Zod, Vitest, Playwright, Keycloak/OIDC, existing AI Router.

## Global Constraints

- Preserve every protected rule in `AGENTS.md`.
- AI never assigns, predicts, or recommends employee ratings, rankings, productivity scores, or performance judgments.
- Project progress changes only through an active, versioned, human-approved Progress Contract.
- Work Item counts, update frequency, GitHub volume, commits, files, and lines changed are never progress or performance inputs.
- Connected Gmail and Calendar summaries remain private until the employee confirms a shared Project object.
- An official Task requires a Project. A private Inbox capture may be unlinked until the employee promotes it.
- AI may prepare a complete Task draft; only a human confirmation creates or assigns the official Task.
- Keep one database, one authentication system, and one audit path.
- Do not copy third-party application code, branding, assets, or translations. Reuse approved interaction patterns only.
- Do not expose, print, move, or commit provider, Google, GitHub, or Keycloak credentials.
- English-only pilot use remains permitted. Existing Arabic/RTL foundations must remain correct, but Arabic evaluation rubric release remains separately gated.
- Each slice must produce a runnable technical outcome, focused tests, screenshots or equivalent
  contract evidence, and a pushed checkpoint. Provisional screens are not final frontend or Product
  Owner usability acceptance.
- After Slice 6, continue through
  `docs/superpowers/plans/2026-08-05-engine-first-completion-program.md`; do not start the dedicated final
  frontend until the pilot engine and capability inventory are complete.

---

## 1. Execution Order and Dependencies

```text
Planning alignment
  └── Slice 1: Today + Tasks + private Inbox
        └── Slice 2: Google Workspace connection + manual linking
              └── Slice 3: Context Intelligence + review queue
                    └── Slice 4: GitHub + updates + evidence + voice
                          └── Slice 5: owner progress setup + manager operations
                                └── Slice 6: neutral Evaluation Fact View preparation
```

Later slices may rely on public interfaces produced by earlier slices, but may not read their tables directly.

## 2. Plans

| Slice | Visible outcome                                                                                              | Plan                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| 1     | A calm Today brief, normal Task workspace, private Inbox, and human-confirmed Task drafts                    | `docs/superpowers/plans/2026-07-20-slice-1-daily-home-tasks.md`         |
| 2     | Employee-controlled Gmail and Calendar connection, private summaries, exclusions, and manual Project linking | `docs/superpowers/plans/2026-07-20-slice-2-google-workspace-context.md` |
| 3     | AI summaries, explainable Project suggestions, reversible high-confidence links, and complete Task drafts    | `docs/superpowers/plans/2026-07-20-slice-3-context-intelligence.md`     |
| 4     | Governed GitHub suggestions, fast text/voice/file updates, evidence confirmation, and one Timeline           | `docs/superpowers/plans/2026-07-20-slice-4-github-updates-evidence.md`  |
| 5     | Simple Project-owner setup, contract-based progress pulse, and actionable manager queues                     | `docs/superpowers/plans/2026-07-20-slice-5-project-owner-progress.md`   |
| 6     | Neutral source-supported facts prepared for later quarterly self- and manager assessment                     | `docs/superpowers/plans/2026-07-20-slice-6-evaluation-preparation.md`   |

## 3. Planning Alignment Checkpoint

Before production implementation:

- [ ] Update `docs/IMPLEMENTATION_PLAN.md` to reference this approved reset without changing protected rules.
- [ ] Replace superseded T030–T044 execution ordering in `TASKS.md` with traceable slice tasks.
- [ ] Update `docs/product/PHASE_2_FEATURE_MAP.md`, `docs/product/PHASE_2_BACKEND_DELTA.md`, and `docs/product/PHASE_2_VERTICAL_SLICES.md`.
- [ ] Record that historical Phase 2 plans remain evidence of prior decisions but are not execution authority for the employee experience.
- [ ] Run `pnpm validate:task-graph`.
- [ ] Commit as `docs: align phase 2 task graph with daily workspace reset`.
- [ ] Push and update Pull Request #5.

No production file changes belong in this checkpoint.

## 4. Common Public Interfaces

Slices converge on these stable boundaries:

```ts
export type DailyWorkspaceSnapshot = Readonly<{
  today: readonly DailyAction[];
  reviewQueue: readonly ReviewQueueItem[];
  inbox: readonly PrivateInboxItem[];
  projectPulse: readonly ProjectPulseItem[];
  upcoming: readonly UpcomingCommitment[];
}>;

export interface ConnectedWorkContextReader {
  listPrivateContext(input: { employeeId: string; cursor?: string }): Promise<ConnectedContextPage>;
}

export interface ContextIntelligenceService {
  analyze(input: AnalyzeContextInput): Promise<ContextAnalysis>;
  prepareTaskDraft(input: PrepareTaskDraftInput): Promise<TaskDraft>;
}
```

`apps/api/src/daily-work/daily-work-query.service.ts` composes these public readers. It does not become a second domain store and does not write another module's tables.

## 5. Verification Policy

After each task:

- Run only the focused unit or integration tests listed in its slice plan.
- Run the package typecheck and lint for affected packages.

At each slice checkpoint:

- Run related integration tests.
- Run the protected scans:

```bash
pnpm scan:secrets
pnpm scan:performance-inputs
pnpm scan:ai-boundary
```

- Run the slice Playwright journey in Arabic and English where employee UI changes.
- Capture desktop and 390px mobile screenshots.
- Commit, push, update the active Pull Request, and record completed and remaining tasks. Continue after
  a green technical checkpoint unless a protected or external human gate applies.

Run the full repository suite only after shared-foundation changes, at a major integration checkpoint, and before making the phase Pull Request ready:

```bash
pnpm verify
pnpm test:integration
pnpm test:ai
pnpm test:e2e
pnpm db:verify
```

## 6. Review Policy

- Slice 1 routine UI/composition tasks: one independent review at bundle completion; fix P0/P1 and record P2/P3.
- Slice 2: one specification/privacy review and one security/code-quality review because OAuth, private work context, and a migration are involved.
- Slice 3: one specification/AI-boundary review and one security/code-quality review; re-review only corrected P0/P1 findings.
- Slice 4: one specification review and one security/integrity review for GitHub webhooks, evidence confirmation, and voice/upload safety.
- Slice 5: one specification review and one authorization/immutability review for owner controls and official progress.
- Slice 6: one specification review and one privacy/neutrality review for evaluation preparation.
- Do not restart complete reviews after bounded remediation.
- Hypothetical hardening that does not violate an approved criterion or create a P0/P1 defect is backlog work.

## 7. External Human Gates

Stop only at these genuine gates:

1. Google Workspace administrator approval, OAuth client credentials, redirect URIs, scope consent, and retention/deletion policy.
2. GitHub App creation/installation and organization/repository approval.
3. Product Owner approval of a protected product-rule change or the later visible final-frontend design.
4. Protected product-rule contradiction.
5. Destructive external operation or unresolved P0/P1 blocker.
6. Arabic rubric semantic approval before Arabic employee evaluation release.

The code may support deterministic adapters before external credentials exist, but must not simulate a live integration in the acceptance claim.

## 8. Durable Checkpoint Format

At every durable technical checkpoint report:

- Slice and task IDs completed.
- Visible user outcome and exact review URLs.
- Files and database migrations changed.
- Tests and scans run with results.
- Security/privacy impact.
- Screenshots.
- Known missing behavior.
- Remaining risks and exact next slice.

## 9. Completion Definition

The reset is complete only when:

- The employee can start from Today, understand what needs attention, and create or update work without navigating a governance form.
- Normal Task management works through Inbox, My Tasks, List, Board, Calendar, and a focused detail panel.
- Gmail, Calendar, GitHub, voice, files, code, images, and manual text enter one governed context lifecycle.
- AI explains its links and drafts, employees can correct them, and official Tasks/Evidence require confirmation.
- Project owners configure measurable progress rules outside the employee daily flow.
- Managers see operational action queues, not employee scores or activity leaderboards.
- Evaluation preparation provides neutral source facts and remains separate from later human assessment.
- All protected scans and phase-level verification pass.

## Superseded Planning Gate

The original Slice 1 planning gate was satisfied. On 2026-08-05 the Product Owner approved completing
and inventorying the pilot engine before designing the dedicated final frontend. This plan remains the
Phase 2 execution map; the later sequence is governed by
`docs/superpowers/plans/2026-08-05-engine-first-completion-program.md`. Live Google or GitHub
configuration and protected product-rule changes remain separate human gates.
