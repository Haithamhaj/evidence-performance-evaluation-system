# Phase 8 P8-06 and P8-08 — Reports and Safe Recovery

## Outcome

Employees and other authorized requesters now have a compact Reports center that lists only their own
export history, derives ready/expired/revoked state from the retained artifact lifecycle, rechecks
current authorization before download, and requires an explicit reason before revocation. System
Administrators now see bounded dependency health, safe next actions, and correlation references
without raw logs, credentials, private content, or destructive normal-screen controls.

The first P8-07 console foundation is visible, but broad user/role/integration/retention mutation
forms are not claimed complete: they must use real owning-domain readers and commands rather than a
generic JSON or fake control surface.

## Product boundaries preserved

- Export history is requester-scoped on the server and contains no report body.
- Artifact download is authorized again at open time and uses a short-lived signed descriptor.
- Expired and revoked artifacts cannot be opened.
- Revocation retains history and records the existing protected revocation event.
- Arabic evaluation export remains blocked by the existing T016 gate.
- Administrator health returns bounded state/action/reference data only; raw logs and provider errors
  stay outside the product response.
- System Administrator remains unable to evaluate employees or reassign Projects.

## Database changes

None. Existing export request, manifest, artifact, access, revocation, and administration persistence
is reused.

## Verification

- Focused reporting, Reports UI, administrator recovery, shell, localization, and same-origin gateway
  tests: 6 files, 61 tests passed.
- Reporting, API, localization, and web type checks passed.
- Web Next production compilation passed and included `/[locale]/reports` and
  `/[locale]/admin/operations`.
- Affected lint, format, protected API, frontend boundary, and secret checks are recorded in the
  checkpoint commit evidence.

## Remaining work

Complete P8-07 through explicit owner-domain forms/readers for the capability subset actually
available in the product. Do not expose a generic mutation payload editor or pretend unavailable
capabilities are operational. Then continue P8-09 telemetry isolation, P8-10 opt-in personal display
preferences, and P8-11 capability closure.
