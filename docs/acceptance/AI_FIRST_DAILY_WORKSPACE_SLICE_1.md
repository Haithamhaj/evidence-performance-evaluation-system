# AI-first Daily Workspace — Slice 1 Acceptance

**Date:** 2026-07-20  
**Branch:** `codex/phase-2-updates-evidence-readiness`  
**Pull Request:** [#5](https://github.com/Haithamhaj/evidence-performance-evaluation-system/pull/5)  
**Decision state:** Product Owner review required before Slice 2

## Visible employee outcome

The employee now lands on a calm `Today` page instead of the rejected long Update questionnaire.
The page follows the approved value-before-input order:

1. a short daily brief in the page heading;
2. Needs Your Review;
3. Needs My Action, Today, and Overdue;
4. a compact operational Project Pulse;
5. private Quick Capture.

Upcoming work remains progressively disclosed. Quick Capture does not require a Project. It becomes
an official Task only after the employee opens a visible review drawer/sheet, chooses a Project, and
confirms creation.

The separate `Tasks` page provides authorized My Tasks and Team Tasks scopes with familiar List,
Board, and Calendar views. Official Tasks always require a Project and direct employee creation
assigns one responsible employee: the authenticated creator. Selecting a Task opens a focused side
panel on desktop and a bottom sheet on mobile; an authorized employee can edit and save its title
there. The active view and Task identity do not change when switching layouts.

## Exact review routes

With the local environment running:

- Arabic Today: `http://127.0.0.1:3000/ar/my-work`
- Arabic Tasks: `http://127.0.0.1:3000/ar/tasks`
- English Today: `http://127.0.0.1:3000/en/my-work`
- English Tasks: `http://127.0.0.1:3000/en/tasks`

Automated acceptance uses a signed, local-only employee session and the `Codex` synthetic employee
persona. The real local seed creates `Codex` inside the application database, but it intentionally
does not create or publish a reusable Keycloak password. Interactive review therefore uses an
already authorized local employee login; the repeatable no-password journey is:

```text
E2E_WEB_PORT=3400 E2E_API_PORT=3401 pnpm exec playwright test \
  tests/e2e/ai-first-daily-workspace.spec.ts --project=chromium
```

## Real Codex employee fixture

The local forward migration `0017_task_workspace` was applied, then the real dogfood seed completed
successfully against PostgreSQL. It produced:

- Project: `Evidence Performance System — Phase 2`.
- Workstream: `Phase 2 Delivery`.
- Employee persona: `Codex`.
- One approved Project-document snapshot composed from the current authoritative reference,
  implementation plan, task map, AI-first design, master plan, and Slice 1 plan.
- Six Project-linked remaining-plan Tasks across Needs My Action, Today, Overdue, and Upcoming.
- Three private Inbox captures.
- No employee rating, rank, productivity score, readiness percentage, or activity-volume progress
  input.

The seed is safely rerunnable and uses public domain services. Repository source text is handled as
untrusted evidence. No provider credential is read, printed, moved, or stored by this Slice 1 seed.

## Acceptance journey

The Playwright journey verifies:

1. Open Arabic Today in RTL.
2. Add a text-only private capture.
3. Open the capture's review sheet.
4. Confirm that a Project is required before promotion.
5. Create the official Task.
6. Open Arabic Tasks and find the same Task.
7. Edit it in the side panel and save through the protected API.
8. Switch List → Board → Calendar without changing Task identity.
9. Begin an English Task draft, interrupt authentication, sign in again, and recover the same
   unsaved title and authorized Project context.
10. Create that official Task and verify the server receives the authenticated employee as its
    responsible assignee.
11. Switch from My Tasks to Team Tasks within the server-authorized scope.
12. Open Arabic Today at 390px, verify bottom navigation and zero horizontal overflow.

The private Inbox query is always bound to the authenticated identity. Integration coverage proves
that another employee and a manager receive no access to Codex's private captures. The browser
cannot submit a different employee identity or move a Task to another Project through the edit
gateway. Unsaved Task drafts use an authenticated-user-scoped local key; legacy unscoped drafts and
another employee's scoped draft are ignored and cannot cross an account switch on the same browser.
The OIDC transaction stores only a validated localized same-origin return path. The callback returns
to that path after successful login; absolute, protocol-relative, API, nonlocalized, backslash, and
control-character destinations fall back to the configured Arabic home. Route tests exercise the
real callback decision while the browser journey verifies the account-scoped draft recovery.

## Verification evidence

- Focused unit suites: **78 passed**.
- Related database/domain integration suites: **19 passed**.
- Migration verification database suites: **49 passed**.
- Slice browser journeys: **3 passed**.
- Web production compile and typecheck: passed.
- Localization typecheck: passed.
- Migration `0017_task_workspace`: empty database, upgrade from migration `0016`, drift, and rebuild
  equivalence passed.

The final branch checkpoint additionally runs affected lint/typechecks, migration verification,
format validation, AI-boundary scanning, secret scanning, performance-input scanning, and the same
three browser journeys.

The bounded security review initially found one P1 cross-account risk in browser draft storage.
The remediation binds drafts to authenticated `/api/v1/me` identity, discards the legacy unscoped
key, validates the restored Project against the user's current authorized Projects, and adds a
cross-account regression. The reviewer rechecked only that finding and confirmed it resolved.

The bounded specification review found four P1 gaps: direct Tasks had no responsible assignee, Team
Tasks was not visible, successful OIDC login returned to `/ar` instead of the draft route, and Quick
Capture appeared before the daily value. The corrections assign the creator, expose the authorized
Team scope, carry a validated encrypted return path through OIDC, and restore the approved Today
order. The same reviewer rechecked only these four findings, identified that responsibility also
needed server-side enforcement, and confirmed the bounded remediation resolved all four. Historical
read models remain nullable so existing records are preserved, while every new official write
requires one responsible assignee.

## Screenshots

- [Arabic Tasks — desktop Calendar](../product/screenshots/ai-first-daily-workspace/slice-1/01-ar-tasks-desktop.png)
- [English Task draft restored](../product/screenshots/ai-first-daily-workspace/slice-1/02-en-tasks-desktop.png)
- [Arabic Today — 390px](../product/screenshots/ai-first-daily-workspace/slice-1/03-ar-today-mobile.png)

## Protected boundaries

- Project progress remains operational Project state, not employee performance.
- Work Item count, completion volume, update frequency, GitHub activity, commits, files, or lines
  changed do not calculate Project progress.
- Quick Capture is private until the employee confirms a shared Project Task.
- AI does not create or assign the Task automatically; direct creation assigns the authenticated
  human creator and Inbox promotion remains human-confirmed.
- No AI rating, rating recommendation, ranking, productivity score, or manager readiness percentage
  is introduced.
- Existing authentication, authorization, audit, AI Router, append-only history, and Project domain
  ownership remain in force.
- Arabic/RTL behavior is verified as a localization foundation; this checkpoint does not approve
  Arabic rubric content or authorize Arabic employee release.

## Deliberately not included in Slice 1

- Gmail and Google Calendar connection and private context: Slice 2.
- Explainable AI linking and assistant-prepared Task drafts: Slice 3.
- GitHub automation, unified manual/voice Updates, Evidence, and Timeline: Slice 4.
- Project-owner setup, check-ins/readiness, and manager operational queues: Slice 5.
- Neutral Evaluation Fact View preparation: Slice 6.
- Complete employee/manager evaluation workflow: Phase 3.

## Product Owner stop gate

Do not begin Slice 2 until the Product Owner confirms:

- Today is immediately understandable without training.
- Quick Capture is meaningfully faster than normal Task creation.
- Project-required official Tasks do not feel bureaucratic.
- List, Board, Calendar, and the focused panel fit daily use.
- Project pulse is clearly operational progress and not an employee evaluation.
