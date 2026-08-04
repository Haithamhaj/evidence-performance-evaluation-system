# Slice 4 Product Acceptance — GitHub, Updates, Evidence, Voice, and Timeline

Date: 2026-08-03
Branch: `codex/phase-2-updates-evidence-readiness`
Pull request: [#5](https://github.com/Haithamhaj/evidence-performance-evaluation-system/pull/5)

## Acceptance outcome

Slice 4 provides one employee-facing daily flow for a required Project and optional Workstream or
Task. The employee can combine text, confirmed voice transcription, image/file, pasted code, and a
manual GitHub snapshot. The assistant prepares a draft, asks one missing-context question at a
time, and requires the employee to edit and confirm the final Update.

A verified GitHub event appears separately as an automated Project fact and suggested evidence.
It does not become employee contribution evidence until the employee reviews the supported claim,
edits the contribution context, and confirms it. GitHub authenticity does not mean that an
evidence claim is substantively supported.

Project progress remains operational Project state. The acceptance journey submits an event with
18 commits and 42 changed files against two matching governed rules. Those raw volumes leave the
official Project progress unchanged at 62.5%, queue the ambiguous rule match for Project-owner
review, and create zero employee-performance writes. The explicit owner decision records its
source reference and `not_satisfied` outcome while keeping progress at 62.5%.

## Complete customer journey

1. Open English `My Work` and choose **Add update**.
2. Review a verified GitHub Project fact as suggested evidence.
3. On a 390px mobile sheet, edit the supported claim and contribution context.
4. Create the draft, review the `Automated GitHub fact` provenance, save an employee edit, and
   confirm the evidence.
5. Select `Atlas Delivery`, its `API readiness` Workstream, and `Delivery task 2`.
6. Confirm a voice transcript, attach an image, paste code, paste a GitHub snapshot, and add text.
7. Answer two dynamic clarification questions, one at a time.
8. Review and save the structured Update.
9. Confirm the Update and inspect the compact result card.
10. Inspect one Timeline that distinguishes automated Project fact, AI draft, employee-confirmed
    evidence/Update, and human decision.
11. Repeat the initial mobile entry in Arabic and verify RTL with no horizontal overflow.

## Visual evidence

- [English universal capture — desktop](../product/screenshots/ai-first-daily-workspace/slice-4/01-en-universal-capture-desktop.png)
- [GitHub suggested-evidence review — mobile](../product/screenshots/ai-first-daily-workspace/slice-4/02-en-evidence-review-mobile.png)
- [Confirmed result and Timeline — desktop](../product/screenshots/ai-first-daily-workspace/slice-4/03-en-result-source-timeline-desktop.png)
- [Arabic universal capture — mobile RTL](../product/screenshots/ai-first-daily-workspace/slice-4/04-ar-universal-capture-mobile.png)
- [GitHub evidence and owner decision Timeline](../product/screenshots/ai-first-daily-workspace/slice-4/05-en-github-evidence-decision-timeline.png)

## Deterministic and live coverage

The full browser journey is deterministic so it can prove the protected boundaries repeatably in
CI. It exercises the same browser contracts, protected API paths, evidence confirmation gates, and
Timeline states as production.

The voice connector was also exercised separately through the real AI Router with a synthetic WAV
and the configured `gpt-4o-transcribe` route. The credential stayed outside source control and was
not printed or moved. A live GitHub organization installation is intentionally not faked: creating
the GitHub App, granting organization access, and storing its production secret remain an external
administrator/credential gate. Webhook signing, idempotency, reconciliation, governed facts, and
the employee-confirmation path are covered deterministically and with database integration tests.

## Protected-boundary results

- No AI rating, predicted rating, employee rank, productivity score, or readiness percentage is
  created or displayed.
- Raw commits, files, activity counts, and update frequency are not progress inputs.
- GitHub is suggested evidence only; employee confirmation is mandatory.
- A verified webhook proves source authenticity only. Evidence verification remains unverified
  until its separate governed verification lifecycle changes it.
- AI calls remain inside the AI Router boundary.
- Timeline reads are authorization-scoped and preserve append-only source and decision references.
- English and Arabic use stable localized keys; Arabic is RTL and retains the existing release
  gate for approved rubric semantics.

## Verification evidence

The final comprehensive checkpoint used the repository-pinned Node.js 24.18.0 and pnpm 11.13.0:

- lint, typecheck, and build: all 23 workspace tasks passed in each run; boundary validation
  accepted 651 source files and localization-copy validation passed;
- unit/coverage: 146 test files and 988 tests passed; the command exited successfully with no
  enforced threshold failure;
- integration: 86 files and 569 tests passed, with 2 files / 13 tests intentionally skipped;
- AI evaluations: 7 files and 172 checks passed, with one intentional skip;
- migrations: all 26 forward migrations verified from empty and prior-release snapshots; all 49
  migration integration checks passed;
- browser: 34 journeys passed, with four intentional skips for superseded flows; the focused Slice
  4 specification passed both journeys and regenerated all five screenshots;
- protected checks: the 77-task dependency graph, 1,051-file secret scan, and 536-file prohibited
  performance-input scan passed.

One bounded specification review and one bounded security/code-quality review were completed. The
confirmed P1 findings were corrected and only those corrections were re-reviewed; both reviewers
reported no remaining P0/P1 finding. Non-blocking P2/P3 follow-ups remain in GitHub issue #9.

## Known non-blocking follow-up

The following items are intentionally deferred to the Slice 4 backlog issue rather than expanding
the accepted scope: a real-database Timeline SQL depth test, richer source-content display inside
review, Task-specific Update preselection coverage, surrounding `My Work` refresh after an Update,
friendlier fallback titles for opaque GitHub events, and tighter cursor timestamp precision.

## Product-owner stop gate

The Product Owner accepted Slice 4 on 2026-08-04 and authorized the verified merge sequence. Slice
5 must not reinterpret Project progress as employee performance and must preserve the external
live-GitHub installation gate.
