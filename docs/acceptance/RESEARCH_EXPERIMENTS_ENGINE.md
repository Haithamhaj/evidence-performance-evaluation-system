# Research & Experiments Engine — E3 Technical Acceptance

**Status:** local technical checkpoint verified; final product UX not accepted

**Date:** 2026-08-06
**Capabilities:** CAP-025, CAP-026, CAP-027

## Outcome

The bounded Research & Experiments engine is now connected end to end. An employee can submit an
explicit GitHub, paper, documentation, or Project-document source for a citation-bound relevance
review, reject an unsuitable proposal, confirm editable Research/Experiment proposals, record
reproducible Experiments, retain failed or unsupported results, confirm a Research decision, link
confirmed Evidence, and record Applied Learning against a real Project object. Timeline, monthly
readiness, and Evaluation Fact View readers consume the same source-labelled history.

This is an engine checkpoint. The compact Research route proves source review and employee
confirmation, but it is not the final everyday Research/Experiment interface. The current route does
not yet render the complete method, run, conclusion, and Applied Learning interaction. That UI belongs
to the later frontend program and must consume the verified contracts rather than recreate domain
rules in the browser.

## Deterministic real-database fixture

Run from the repository root:

```bash
pnpm research:seed
```

The seed is local-PostgreSQL-only and rerunnable. Mutable roots use stable upserts. Protected history
is inserted only when the stable row is absent; rerunning does not revise or duplicate append-only
Research revisions, transitions, methods, runs, observations, conclusions, Evidence links, or Applied
Learning.

It creates:

- one active Project and one optional Workstream;
- one pinned Project Document Version;
- two existing Project Work Items;
- one employee-confirmed Evidence record;
- one concluded Research record with a named source;
- one retained `FAILED` Experiment with a human `NOT_SUPPORTED` conclusion;
- one completed Experiment with pinned baseline, measure, test case, run, observation, limitation,
  and human `SUPPORTED` conclusion;
- one human-confirmed Research decision;
- one confirmed Research-to-Evidence link;
- one Applied Learning record linked to an existing Work Item.

It seeds no rating, rank, productivity score, Documentation Readiness percentage, source-volume
metric, activity-volume metric, or Project progress change.

## Verified journey

The deterministic Playwright journey proves:

1. the employee opens the bilingual Project Research verification route;
2. an explicit GitHub URL returns a cited Project-relevance review;
3. benefit, mismatch, risk, uncertainty, citations, and next actions remain visible;
4. the employee rejects an unsuitable Task proposal before confirmation;
5. no official Task exists before or after that proposal confirmation;
6. a confirmed Research record contains two Experiments;
7. the failed first Experiment remains queryable with its human conclusion;
8. the second Experiment pins its baseline, measures, test cases, run, and limitations;
9. the employee-confirmed Research decision is source-labelled in Timeline;
10. confirmed Evidence and Applied Learning link to the same Project and a real Work Item;
11. Evaluation Fact View shows neutral Research decision and Applied Learning facts before employee
    interpretation;
12. Arabic is RTL and usable at 390 px.

## Negative and recovery cases

- another employee cannot read the Research record;
- an unrelated manager cannot read it;
- a System Administrator receives no implicit Project access;
- a stale confirmation returns a version conflict and overwrites nothing;
- a loopback/private URL is blocked before retrieval;
- AI unavailability produces a safe retry state without inventing a result;
- an official Task is not created from an AI proposal without the separate employee confirmation;
- no provider credential, raw token, private source body, model rating, or protected readiness value
  appears in the browser response or committed fixture.

## Screenshots

The screenshots are technical verification evidence, not final visual acceptance:

- `docs/product/screenshots/engine/research-experiments/01-en-research-desktop.png`
- `docs/product/screenshots/engine/research-experiments/02-en-cited-source-review.png`
- `docs/product/screenshots/engine/research-experiments/03-en-proposal-sheet.png`
- `docs/product/screenshots/engine/research-experiments/04-en-decision-applied-learning-facts.png`
- `docs/product/screenshots/engine/research-experiments/05-ar-research-mobile.png`

There is deliberately no fabricated screenshot for the full Experiment lifecycle. Failed Experiment,
decision, Evidence-link, and Applied Learning records are machine-verified through authenticated API,
Timeline, and Fact View assertions. The final frontend still needs a dedicated low-friction lifecycle
surface.

## Verification evidence

Focused evidence collected before the full checkpoint:

- `pnpm research:seed` — passed twice with stable counts: one Research, two Experiments, one Evidence
  link, and one Applied Learning record;
- `pnpm exec playwright test tests/e2e/research-experiments.spec.ts` — 3 passed.

The repository-wide E3 checkpoint is recorded here after fresh execution:

| Gate                    | Result                                                                 |
| ----------------------- | ---------------------------------------------------------------------- |
| `pnpm verify`           | Passed — 178 unit files / 1,274 tests; 25 lint/type/build packages     |
| `pnpm test:integration` | Passed — 112 files / 726 tests; 2 files and 13 tests intentionally skipped |
| `pnpm test:ai`          | Passed — 9 files / 181 tests; 1 intentional skip                      |
| `pnpm db:verify`        | Passed — empty, previous snapshot, drift, rebuild; 68 DB tests        |
| `pnpm test:e2e`         | Passed on ports 3300/3101 — 44 journeys; 4 intentional skips          |
| `git diff --check`      | Passed                                                                 |

The first full integration run exposed a stale local `evaluation_test` schema whose migration ledger
did not match its constraints. Rebuilding that test-only database from all 28 migrations removed the
environment drift; the complete integration suite then passed. No production or user data was reset.

## External gates and remaining work

- Live private GitHub repositories, licensed papers, and connector-protected sources require their
  approved credentials and minimum scopes. The deterministic fixture does not claim those gates are
  open.
- Live provider quality and production worker/storage monitoring remain deployment concerns; the
  engine verifies governed contracts and recovery behavior.
- The final Research/Experiment UX is not accepted. E7 must carry CAP-025–027 into the final
  source-to-journey frontend handoff.
- E3 completion does not complete the whole product engine. E4–E7 remain required before the final
  frontend program begins.
