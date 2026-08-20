# Phase 8 P8-04–P8-05 — Notifications and Connections

## Outcome

The employee now has one compact Notifications action center and one truthful Connections workspace.
Notification intents are grouped by their existing dedupe key, distinguish unread/read state, resolve
without deleting history, and re-authorize their protected target before opening. Google Workspace
keeps its existing owner-private connect/reconnect/disconnect lifecycle. GitHub shows current setup,
minimum-permission and human-confirmation boundaries, and the explicit `Administrator setup required`
gate when the GitHub App is unavailable.

## Product boundaries preserved

- The browser never supplies recipient identity or target authorization.
- Resolving an intent is recipient-only and records it read/resolved; the row remains retained.
- Opening an intent reuses the existing server target authorizer before returning a deep link.
- Notification email preferences and required-category enforcement remain in the existing
  Notifications domain; in-app authoritative actions are not muted.
- Google context remains private to its employee owner.
- GitHub remains suggested evidence only and cannot update Project progress or employee evaluation.
- No credential, token, content body, rating, readiness value, score, or employee ranking is exposed.

## Files and modules

- Notifications domain lifecycle: `packages/notifications/src/intent-service.ts`
- Protected API: `apps/api/src/operations/notifications.controller.ts`
- Strict same-origin web boundary: `apps/web/src/platform/notification-contracts.ts` and
  `apps/web/src/app/api/daily-work/[...path]/route.ts`
- Employee action center: `apps/web/src/product-ui/notifications/`
- Connections composition: `apps/web/src/app/[locale]/settings/connections/`
- Stable navigation and English/Arabic catalogs: shell model/navigation and localization catalogs.

## Database changes

None. This slice uses the existing `NotificationIntent`, `NotificationPreference`, connected-work,
and GitHub integration persistence.

## Verification

- Focused notification/domain/gateway/connections/shell/localization tests: 6 files, 60 tests passed.
- Notifications, API, localization, and web type checks passed.
- Web Next production compilation passed and included `/[locale]/notifications` and
  `/[locale]/settings/connections`.
- Affected package lint passed.
- Final focused format, protected-controller matrix, frontend-boundary, and secret scans are recorded
  in the checkpoint commit evidence.

## Security and privacy impact

Positive. Cross-recipient resolution is denied, deep links are re-authorized at open time, the web
gateway accepts no browser-selected actor, Google owner privacy remains explicit, and GitHub external
setup is not replaced with a fake employee connect flow.

## Remaining risk / next work

Production Google and GitHub connection health still depends on administrator consent, credentials,
and minimum-permission installation. Phase 8 should continue with P8-06 reports, P8-07 administration,
and P8-08 operational recovery without exposing raw logs or destructive normal-user actions.
