# T091 implementation report

## Outcome

Implemented the authorized What Changed live-delivery slice behind a server-read rollback flag.
Durable owner-filtered receipt projections remain authoritative; SSE carries only a cursor wake-up.
The browser replays missed receipts in order, de-duplicates them, and retains explicit refresh.

## Changes

- Added a recipient-bound stream session and protected SSE controller over the T088 durable receipt
  reader. Reconnect uses the last event cursor and never puts receipt content on the stream.
- Added a same-origin stream proxy that keeps the session token server-side, validates cursors, and
  disables buffering. Unknown query input is rejected.
- Added a protected `/api/v1/me` session probe through the existing daily-work gateway.
- Added live connection, replay, offline, reconnecting, expired-session, error, and reduced-motion
  states to What Changed while preserving its explicit refresh rollback.
- Merged projections by receipt identity and sorted durable cursors so replay is visibly exactly once.
- Added English and Arabic recovery copy. No motion is required to understand a live receipt.
- Added `AI_NATIVE_EXPERIENCE_STREAM_ENABLED=false` rollback; it disables SSE without deleting
  delivery history or the explicit reader.
- Repaired the protected API matrix for private capture uploads, read-only experience orchestration,
  What Changed, and the new stream using existing real allow/deny evidence and a real private-upload
  audit assertion. Read-only routes use `POLICY_DECISION`, not invented persisted-audit evidence.

## Files changed

- SSE runtime/controller and focused tests under `apps/api/src/experience-stream/`.
- Operations module registration and protected API matrix evidence.
- Same-origin SSE proxy and rollback flag under `apps/web/src/server/experience-stream/` and
  `apps/web/src/app/api/experience-stream/`.
- Session-probe allowlist in the daily-work route.
- What Changed UI/tests, shell wiring, and English/Arabic catalogs.
- Private capture upload audit evidence assertion.

## Database changes

None. T091 reads the existing append-only delivery receipts and cursor.

## Verification

- Focused T091, same-origin proxy, durable reader, and protected-matrix proof: 9 files, 50 tests
  passed.
- `@evaluation/api` typecheck: passed.
- `@evaluation/web` typecheck, including Next production compile: passed.
- Protected API matrix validator: passed (50 controllers, 29 policy rows).
- Affected ESLint, Prettier, and `git diff --check`: passed.

## Security / privacy / AI impact

- The authenticated principal is the only recipient input; browser query parameters cannot select a
  user. Existing runtime tests prove wrong-user exclusion.
- The event stream contains only `{ cursor }`; the protected JSON reader returns authorized content.
- The browser never receives the upstream access token. Session recovery probes only `/api/v1/me`.
- This is read-only delivery. It creates no command, evidence, Project progress, readiness value,
  rating, ranking, productivity score, or AI inference.
- No provider SDK or AI route was added.

## Product acceptance

The authenticated Arabic product journey was run in the in-app browser. It showed exactly one
owner-private Capture receipt, then a truthful reconnecting state while retaining the receipt and
explicit refresh. The required screenshots are stored as `t091-what-changed.png` and
`t091-reconnecting.png`. The independent corrected-findings review passed with no remaining P0/P1.

T091 is complete. The retained explicit refresh remains the immediate rollback if live streaming is
disabled; T092 may proceed without removing retained routes.
