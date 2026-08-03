# AI-first Daily Workspace — Slice 3 Acceptance

**Date:** 2026-08-02

**Branch:** `codex/phase-2-updates-evidence-readiness`

**Task:** Slice 3 Task 6 (`S3-T6`)

**Decision state:** Final P1 remediation verified; Product Owner trust review required before Slice 4

## Acceptance outcome

The deterministic Slice 3 journey and its production foundations are ready for Product Owner
review. An employee can understand
why a strong Project suggestion was made, correct an uncertain suggestion, reject an irrelevant
suggestion, edit a prepared Task, and create that official Task only through an explicit final
confirmation. The same workspace remains useful when Context Intelligence is unavailable: private
source browsing, manual Project linking, Quick Capture, and manual Task creation continue to work,
and the employee's exact raw capture is preserved in the Task description.

The browser journey uses synthetic, visibly labelled Gmail and Calendar summaries served entirely
inside the local deterministic test boundary. It does not call Google or a model provider. A live
AI smoke was not run: the three governed route artifacts compile and their registrar dry-run
passes, but the current local database has none of those route registrations and the current
process has no available provider credential. Acceptance did not mutate local route configuration
or simulate a paid result merely to satisfy the optional smoke.

## Final bounded-review remediation

The final specification/AI and security/code-quality reviews found five P1 production-path gaps.
All five are remediated and have focused regression coverage:

1. Context analysis now composes `ProjectAnchorReader` with owner-authorized Connected Context
   facts and Projects access, and composes `ProjectSemanticContextReader` with the Documents public
   boundary. Unlinked sources can produce a one-anchor review decision or a deterministic
   two-independent-anchor auto-link; no model confidence is promoted into an anchor.
2. The normal employee source-review sheet now offers **Prepare smart review**. Its same-origin BFF
   calls the protected analysis endpoint and then the protected Task-draft preparation endpoint;
   neither raw IDs nor upstream private results are returned to the browser response.
3. Review-queue queries select only actionable current leaves before decrypting content. Confirmed,
   corrected, and rejected Project suggestions disappear; confirmed Task drafts disappear. The E2E
   fixture now models terminal state and filters it instead of deleting rows by splice.
4. Project-suggestion confirmation and response-loss replay now lock the suggestion, source, current
   Project membership, Project state, and employee state in one serializable transaction before
   protected content is decrypted or a minimal acknowledgment is returned.
5. Manual Connected Context Project linking and employee-confirmed official Task creation now use
   the Projects public transaction-aware membership/state lock. The weaker out-of-transaction link
   precheck and Work Items' local unlocked Project authorization are no longer used for these paths.

The scoped re-review then found one final P1 in the new production composition: a stakeholder email
address mentioned only inside untrusted Gmail title/summary text was being treated as
`CONFIRMED_SENDER_DOMAIN` and could combine with `EXPLICIT_PROJECT_REFERENCE` to authorize
`AUTO_LINK`. Production composition no longer emits that anchor from Gmail text. A regression using
the real adapter, anchor reader, and decision policy proves the same input remains in employee
review. Provider-authenticated sender metadata was not added; the anchor remains unavailable from
this source until a governed provider contract or employee confirmation exists.

No migration, rating behavior, readiness behavior, ranking behavior, or protected product rule
changed. The bounded final reviews have no remaining P0/P1 finding.

## Exact review routes

With the local application running:

- English My Work: `http://127.0.0.1:3000/en/my-work`
- Arabic My Work: `http://127.0.0.1:3000/ar/my-work`

The repeatable browser journey uses a signed local-only employee session, deterministic Context
Intelligence fixtures, and repository-pinned Node.js `24.18.0` with pnpm `11.13.0`. The verification
command runs isolated web/API fixtures on ports `3400` and `3401`:

```text
E2E_WEB_PORT=3400 E2E_API_PORT=3401 pnpm exec playwright test tests/e2e/context-intelligence.spec.ts --project=chromium
```

## Deterministic review fixture

| Scenario                 | Private source                                        | Governed result                                                                             |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Explainable strong match | `[Synthetic AI] Release decision`                     | `Atlas Delivery`, explained by a known Project participant and an approved Project term     |
| Uncertain match          | `[Synthetic AI] Follow-up with two possible Projects` | No automatic link because the second independent anchor is missing                          |
| Rejected match           | `[Synthetic AI] Personal reminder`                    | No automatic link because no governed Project anchor exists                                 |
| Prepared Task            | `[Synthetic AI] Acceptance follow-up`                 | Editable draft with no proposed assignee; official creation waits for employee confirmation |

The fixture proves the product boundary rather than model quality. Deterministic matching and
lower-level AI tests separately verify that automatic linking requires an explicit mapping or at
least two non-conflicting independent anchors; model confidence alone cannot authorize the link.

## Acceptance journey

The Playwright journey verifies:

1. English renders left-to-right and presents a plainly explained strong Project suggestion.
2. The employee can inspect the private source context and confirm the explainable link.
3. A one-anchor suggestion remains uncertain; the employee selects a different Project and the
   corrected private link is applied.
4. A no-anchor suggestion is rejected and does not gain a Project link.
5. The prepared Task clearly identifies what will become shared, has no proposed assignee, and
   remains editable before confirmation.
6. Before the employee clicks **Confirm Task**, no confirmation request is issued and the exact set
   of official Task IDs is unchanged.
7. The employee edits the title and description, explicitly confirms the Task, and only then one
   official Task is created and assigned to that employee.
8. The source title is not copied into the shared Task projection.
9. With Context Intelligence disabled, the review queue reports a recoverable error while private
   connected-source browsing and manual Project linking still work.
10. The employee's exact Quick Capture text is preserved as the description when they manually
    complete Task creation, even after editing the shared Task title.
11. Manager and other-employee sessions receive an empty Context Intelligence projection with no
    private title, summary, source identifier, employee identifier, or route trace.
12. Arabic renders right-to-left at 390px, mixed English source content uses automatic direction,
    the review sheet is bottom-anchored, and the page has no horizontal overflow.

## Human-control proof

The acceptance test records browser requests to the Task-draft confirmation gateway and compares
official Task identities through the protected Task API at three points: before review, while the
edited draft sheet is open, and after explicit confirmation. The first two observations have no
confirmation write and identical Task IDs. The last observation has exactly one confirmation
write and exactly one new employee-assigned Task.

The prepared draft's `proposedAssigneeId` is `null`. Assignment is supplied by the employee-facing
confirmation action and validated by the protected server contract. The AI fixture never creates
or assigns an official Task, and it never bypasses the final human gate.

## AI-unavailable recovery proof

The test's local-only control makes the review queue return an unavailable response without
changing the connected-source or manual Task APIs. The employee can still:

- open their private source summary;
- apply a reversible manual Project link;
- save an exact raw Quick Capture; and
- finish the existing manual **Turn into Task** flow.

The raw input is asserted twice: first in the private Inbox row, then as the official Task
description after the employee chooses a different Task title. No partial AI draft is used or
represented as complete.

## Privacy proof

Facts established by automated acceptance:

- Context Intelligence review details are available only to the authenticated owning employee.
- A manager and another employee each receive exactly `{ items: [], projects: [] }` from the
  same-origin review gateway.
- Their projections contain no private source title, source summary, source or employee ID, AI
  route key, prepared Task title, or Project choices.
- The confirmed shared Task contains only the employee-reviewed Task fields. It does not expose the
  private source title.
- Project-link correction remains private association state; it does not reveal source content.
- No rating, rating recommendation, ranking, productivity score, readiness percentage, or raw
  activity-volume performance input is created.

The deterministic browser fixture complements, rather than replaces, the database-backed service,
protected API, prompt-injection, authorization, audit, encryption, provenance, revocation, and
optimistic-concurrency tests completed in Slice 3 Tasks 1–5.

## Governed AI route status

The Context Intelligence registrar dry-run resolves these versioned artifacts:

| Route                      | Prompt                            | Output schema                       |
| -------------------------- | --------------------------------- | ----------------------------------- |
| `context.summarize.v1`     | `context-summary-prompt.v1`       | `context-analysis-output.v1`        |
| `context.project-match.v1` | `context-project-match-prompt.v1` | `project-link-suggestion-output.v1` |
| `task.draft.v1`            | `task-draft-prompt.v1`            | `task-draft-output.v1`              |

No local live smoke result is claimed. At acceptance time, a read-only check found no registered
local database routes for these keys and no available provider credential in the current process.
This is an environment prerequisite, not evidence that deterministic behavior failed. Live-model
quality and provider behavior remain deployment-time concerns.

## Verification evidence

All final remediation checks used Node.js `24.18.0` and pnpm `11.13.0`:

- Full unit suite: **132 files, 903 tests passed**.
- Full database-backed integration suite: **79 files passed, 2 intentionally skipped; 517 tests
  passed, 13 intentionally skipped**.
- Full AI evaluation suite: **6 files, 166 tests passed, 1 intentional skip**.
- Full lint and typecheck task graphs: **22/22 tasks passed** in each graph.
- Slice 3 browser journeys: **4/4 passed in 7.7 seconds**.
- Context route registrar dry-run: exact three routes and versioned prompt/schema artifacts passed.
- Repository formatting and task-graph validation passed.
- Secret scan: **986 files**; performance-input scan: **494 files**; AI boundary scan: **598 source
  files** — all passed.
- Final confirmed-sender regression: expected RED exposed
  `EXPLICIT_PROJECT_REFERENCE + CONFIRMED_SENDER_DOMAIN`; GREEN passed **4/4** composition tests,
  **41/41** related Context Intelligence unit tests, **15/15** focused API/database integration
  tests, and API lint/typecheck.

Exact executed commands and results are also recorded in the Slice 3 Task 6 report.

## Screenshots

- [English explainable Project link — desktop](../product/screenshots/ai-first-daily-workspace/slice-3/01-en-explainable-link-desktop.png)
- [English uncertain and rejected review — desktop](../product/screenshots/ai-first-daily-workspace/slice-3/02-en-uncertain-review-desktop.png)
- [English employee confirmation gate — desktop](../product/screenshots/ai-first-daily-workspace/slice-3/03-en-human-confirmation-desktop.png)
- [English employee-confirmed Task — desktop](../product/screenshots/ai-first-daily-workspace/slice-3/04-en-confirmed-task-desktop.png)
- [English AI-unavailable manual path — desktop](../product/screenshots/ai-first-daily-workspace/slice-3/05-en-ai-unavailable-manual-path-desktop.png)
- [Arabic smart review — 390px](../product/screenshots/ai-first-daily-workspace/slice-3/06-ar-smart-review-mobile.png)

## Protected boundaries

- AI output remains advisory, versioned, validated, source-referenced, and routed through the AI
  Router.
- AI does not create or assign an official Task; the employee reviews all shared fields and makes
  the final confirmation.
- Automatic Project linking requires the approved deterministic confidence boundary, not model
  confidence alone.
- Private Gmail/Calendar source content remains owner-only until the employee confirms a separately
  governed shared object.
- Context and Task activity do not become completed work, employee performance, rating input,
  ranking, productivity score, or Documentation Readiness.
- Arabic/RTL verification preserves the localization foundation; it does not approve Arabic rubric
  content or authorize Arabic employee release.
- Existing authentication, server-side authorization, audit, encrypted-storage, historical-record,
  and visibility boundaries remain in force.

## Remaining risks

- Live model quality, latency, cost, and provider failure behavior are not established by the
  deterministic fixture. The current local environment lacks the registered routes and provider
  credential required for the optional governed smoke.
- Live Google behavior remains behind the separate approved OAuth, administrator-consent, scope,
  retention/deletion, credential-vault, and cryptographic-key-provider gates. No live Google flow
  was simulated.
- A deferred P2 architecture observation from Task 3 remains: a failed follow-up persistence step
  could leave an orphaned successful AI-run trace. It does not bypass confirmation or expose
  private content, but a future cleanup/reconciliation path would improve trace hygiene.

## Product Owner stop gate

Do not begin Slice 4 until the Product Owner confirms:

- the assistant reduces work and feels faster than manual organization;
- the strong-match explanation is understandable and credible;
- uncertain and incorrect suggestions are easy to correct or reject;
- the employee remains visibly in control of Task content and assignment;
- AI unavailability leaves a useful, truthful manual workspace; and
- the English desktop and Arabic 390px experiences are acceptable.
