# AI-first Daily Workspace — Slice 2 Acceptance

**Date:** 2026-07-27

**Branch:** `codex/phase-2-updates-evidence-readiness`

**Task:** Slice 2 Task 6 (`S2-T6`)

**Decision state:** Product Owner review required before Slice 3

## Acceptance outcome

The deterministic Slice 2 journey is ready for Product Owner review. An employee can privately
review compact Gmail and Calendar context, exclude and restore an item, manually link and unlink a
Project, reload without losing either decision, and disconnect the account. The employee-facing
experience presents connected context as a quiet section of `My Work`, not as another inbox,
completed work, a Task, an activity count, or a performance signal.

All acceptance data is synthetic and visibly labelled. No live Google account, OAuth credential,
authorization code, email body, attachment, or administrator configuration was used or requested.
Live Google acceptance remains blocked by the separate external-configuration gate and continues to
return `EXTERNAL_CONFIGURATION_REQUIRED` when that gate is absent.

## Exact review routes

With the local application running:

- English My Work: `http://127.0.0.1:3000/en/my-work`
- Arabic My Work: `http://127.0.0.1:3000/ar/my-work`
- English Connections: `http://127.0.0.1:3000/en/settings/connections`
- Arabic Connections: `http://127.0.0.1:3000/ar/settings/connections`

The repeatable browser journey uses a signed local-only employee session, deterministic
Gmail/Calendar fixtures, and repository-pinned Node.js `24.18.0` with pnpm `11.13.0`. It does not
depend on Keycloak, Docker, Google, or live credentials.

## Deterministic source fixture

The browser acceptance fixture mirrors the production synthetic adapter values:

| Source   | Title                          | Summary                                                         | Time                       |
| -------- | ------------------------------ | --------------------------------------------------------------- | -------------------------- |
| Gmail    | `[Synthetic] Project decision` | `A deterministic local summary for owner-only review.`          | `2026-07-20T08:30:00.000Z` |
| Calendar | `[Synthetic] Project review`   | `A deterministic local calendar summary for owner-only review.` | `2026-07-20T10:00:00.000Z` |

The owner receives the approved minimal review projection: source type, title, short summary,
approved source URL, timestamp, private/excluded state, and the active manual Project link. The
fixture performs no HTTP or OAuth operation outside the local deterministic test boundary.

## Acceptance journey

The Playwright journey verifies:

1. English renders left-to-right on desktop.
2. Gmail and Calendar appear as compact, visibly synthetic, private context.
3. Opening an item presents the title, short summary, owner-only boundary, approved source link,
   reversible exclusion, and manual Project controls.
4. Exclusion survives reload; restore reverses it.
5. A manual Project link survives reload; unlink removes it and remains removed after reload.
6. No Task write occurs during review, exclusion, restore, Project link, or unlink.
7. The rendered Task identity set remains unchanged and contains none of the private source titles,
   summaries, or URLs.
8. A manager and another employee each receive an empty connected-context projection containing no
   source title, summary, URL, Gmail/Calendar provider value, provider source identifier, or Project
   link state.
9. Arabic renders right-to-left at 390px with no horizontal overflow and a bottom-anchored review
   sheet.
10. English source title and summary use automatic direction inside the Arabic shell, preserving
    readable mixed Arabic/English content.
11. Disconnect immediately returns a disconnected, empty projection and removes both synthetic
    items from `My Work`.

## Shared-Task boundary

Slice 2 intentionally has no connected-context promotion-to-Task action. That governed,
human-confirmed draft flow belongs to Slice 3. The acceptance test therefore proves that the
complete Slice 2 review/link/exclude journey issues no Task creation request, leaves the existing
Task identity set unchanged, and copies no private title, summary, or source URL into a shared
object.

This is stronger and more accurate than inventing an unapproved shared-Task path. When Slice 3 adds
promotion, its acceptance must separately prove that the employee confirms the content and that the
shared object carries a source reference appropriate to its visibility.

## Privacy proof

Facts established by automated acceptance:

- Connected source details are available only to the authenticated owning employee.
- Manager and other-employee sessions receive `items: []`, disconnected status, and no link state.
- Caller-supplied employee identity is not part of the browser contract.
- Manual linking does not share source content and does not create a Task.
- Exclusion, restoration, linking, unlinking, and disconnect are owner-controlled and reversible as
  defined.
- Disconnect removes the owner-visible private projection immediately.
- No rating, rating recommendation, ranking, productivity score, readiness percentage, or
  activity-volume performance input is created.

The deterministic browser fixture complements, rather than replaces, the Task 2 persistence tests
and Task 3 protected-API tests. Those lower-level suites remain the evidence for encrypted storage,
credential-vault boundaries, auditing, owner-derived authorization, and cross-user mutation denial.

## Verification evidence

- Connected-context component suite: **5 passed**.
- Connected-work protected API suite: **16 passed**.
- Connected-work service suites: **7 passed**.
- Localization suites: **24 passed**.
- Slice 2 browser journeys: **4 passed**.
- Affected web lint and typecheck: passed.
- E2E test-fixture lint: passed.
- Migration verification: empty database, previous snapshot, drift, and rebuild equivalence passed.
- Format validation and Git diff validation: passed.
- Secret, performance-input, and AI-boundary scans: passed.

## Screenshots

- [English private source review — desktop](../product/screenshots/ai-first-daily-workspace/slice-2/01-en-context-review-desktop.png)
- [English excluded source — desktop](../product/screenshots/ai-first-daily-workspace/slice-2/02-en-context-excluded-desktop.png)
- [English Project link after reload — desktop](../product/screenshots/ai-first-daily-workspace/slice-2/03-en-context-project-linked-reload-desktop.png)
- [English Project unlink after reload — desktop](../product/screenshots/ai-first-daily-workspace/slice-2/04-en-context-project-unlinked-reload-desktop.png)
- [Arabic private source review — 390px](../product/screenshots/ai-first-daily-workspace/slice-2/05-ar-context-review-mobile.png)
- [English disconnected Google Workspace — desktop](../product/screenshots/ai-first-daily-workspace/slice-2/06-en-google-workspace-disconnected-desktop.png)

## Protected boundaries

- Gmail and Calendar summaries remain private until the employee confirms a separate shared Project
  object through an approved later flow.
- A manual Project link is private association state, not permission to reveal the source.
- Connected context is not completed work, evidence, a performance metric, or a score.
- AI does not rate, rank, recommend a rating, create a Task, or assign a person.
- Project and work activity volume do not become Project progress or employee performance.
- Arabic/RTL verification preserves the localization foundation; it does not approve Arabic rubric
  content or authorize Arabic employee release.
- Existing authentication, server-side authorization, audit, encrypted-storage, credential-vault,
  historical-record, and AI Router boundaries remain in force.

## Remaining external gate and risks

- Live Google OAuth remains blocked on organization-approved client configuration, exact redirect
  URIs, minimum scopes, administrator consent, retention/deletion policy, production vault, and
  production cryptographic key-provider implementations.
- The deterministic browser fixture validates the approved application contract, not Google API
  pagination, rate limits, token refresh, Gmail history gaps, Calendar incremental sync, or provider
  revocation behavior.
- Shared Task drafting from connected context is deliberately deferred to Slice 3 and still requires
  employee confirmation plus a visibility-appropriate source reference.

## Product Owner stop gate

Do not begin Slice 3 until the Product Owner confirms:

- Connected context feels like a quiet assistant rather than another inbox.
- The private-by-default boundary is obvious.
- Exclude/restore is understandable and reversible.
- Manual Project linking is fast, useful, persistent, and easy to undo.
- Disconnect clearly removes private context.
- The English desktop and Arabic 390px experiences are acceptable.
