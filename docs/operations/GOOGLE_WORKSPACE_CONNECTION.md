# Google Workspace Connection

## Status

The live Google REST adapters exist. A guarded `google-local` mode now supports a real personal
Google consent journey for local product acceptance only. Production connection remains
deliberately disabled with `EXTERNAL_CONFIGURATION_REQUIRED`.

Deterministic Gmail and Calendar acceptance remains available. Creating an OAuth client or using
the local preview does not satisfy any production gate below.

## Production activation gate

The production composition must keep `externalConfigurationReady: false` until all of these are
complete:

1. An administrator approves the Google Cloud project and OAuth web client.
2. Exact production redirect URIs are registered; wildcard redirect URIs are prohibited.
3. The consent screen identifies the application, data use, privacy policy, retention, deletion,
   and disconnection behavior accurately.
4. The organization approves the exact scopes listed below.
5. A production credential vault encrypts refresh and access credentials, supports rotation, and
   returns only opaque `credentialRef` values to persistence.
6. A production cryptographic key provider protects derived private context.
7. Retention and deletion rules are approved and implemented without claiming deletion before it
   has occurred.
8. Security and privacy review approves the deployed data flow, operational access, monitoring,
   incident response, and credential-revocation procedure.

Do not replace either missing production component with the development-only deterministic
protector or process-memory credential vault.

## Requested scopes

The adapter requests only:

- `openid`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/gmail.metadata`
- `https://www.googleapis.com/auth/calendar.events.readonly`

The Gmail metadata scope is restricted. Google may require OAuth verification and, when restricted
data is transmitted through or stored on servers, an additional security assessment. The deployed
consent-screen scope list must exactly match the code before live activation. A broader scope such
as `gmail.readonly` must not be substituted merely because it is already configured in a test
project.

## Data boundary

Gmail parsing uses the API's metadata format and requests only the `Subject` header. The adapter
does not normalize or return message bodies, snippets, MIME parts, attachment names, attachment
contents, or provider error bodies. A normalized Gmail row contains only the opaque message ID,
timestamp, subject, source URL, and a `null` summary.

Calendar parsing returns only the opaque event ID, title, start time, and Google source URL. It does
not normalize or return the event description or attendee list. A normalized Calendar summary is
always `null`.

Normalized title data is still private content. The existing connected-work-context service seals
it before persistence and exposes it only to the owning employee until the employee confirms a
separate governed shared object.

## Synchronization behavior

- Gmail initial synchronization uses message-list pagination and metadata fetches, then stores the
  account history ID as the checkpoint.
- Gmail incremental synchronization uses the history ID. A missing/invalid history range maps to
  `cursor_expired`, allowing the existing sync service to restart without duplicating normalized
  items.
- Calendar uses page tokens and stores `nextSyncToken` only after the final page.
- Calendar HTTP `410` during incremental synchronization maps to `cursor_expired`.
- HTTP `429` and transient `5xx` responses receive at most three total attempts. `Retry-After` is
  honored with a bounded delay.
- An expired access credential or an HTTP `401` triggers an in-memory access-token refresh. No
  token, authorization code, client secret, private title, or source URL may be logged.
- Revocation sends the refresh credential, when present, to Google's revocation endpoint and clears
  the adapter's in-memory refreshed-access cache.

The current credential-vault port cannot persist a rotated access credential. The OAuth client
therefore caches refreshed access credentials only in process memory. Production wiring must keep
the refresh credential in the approved vault and tolerate a refresh after process restart.

## Automated local test procedure

Provider-adapter tests use a mocked HTTP transport and require no Google or OpenAI credential:

```text
pnpm exec vitest run --project unit packages/connected-work-context/src/google/google-adapters.test.ts
```

Do not source, print, copy, or commit `.env.google.local` while running these tests.

## Real local acceptance preview

The real preview is fail-closed unless all of these conditions are present together:

- `APP_ENV=local`.
- `NODE_ENV=development` (or `test` in automated composition checks).
- `CONNECTED_WORK_CONTEXT_MODE=google-local`.
- `CONNECTED_WORK_CONTEXT_REDIRECT_URIS` contains only exact localized return URIs, normally
  `http://localhost:3000/ar/settings/connections` and
  `http://localhost:3000/en/settings/connections`.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_OAUTH_REDIRECT_URI` are present.
- `GOOGLE_OAUTH_REDIRECT_URI` is exactly
  `http://localhost:3000/api/workspace/connected-work/google/callback` and is registered on the
  Google OAuth web client.
- `GOOGLE_OAUTH_SCOPES` contains exactly the four scopes in **Requested scopes**, without
  `gmail.readonly` or any broader substitute.
- The personal Google account is an authorized test user while the consent screen is in testing.

Keep the real values only in the ignored, mode-`0600` project reference file
`.env.google.local`. Never paste a value into source, `.env.example`, terminal history, issue text,
or screenshots. From the active worktree, load the ordinary local environment and that ignored
reference file into the process, then set only the non-secret mode values:

```text
APP_ENV=local \
NODE_ENV=development \
CONNECTED_WORK_CONTEXT_MODE=google-local \
CONNECTED_WORK_CONTEXT_REDIRECT_URIS=http://localhost:3000/ar/settings/connections,http://localhost:3000/en/settings/connections \
/opt/homebrew/opt/node@24/bin/node \
  --env-file=./.env.example \
  --env-file=/Users/haitham/development/evidence-performance-evaluation-system/.env.google.local \
  /Users/haitham/.cache/node/corepack/v1/pnpm/11.13.0/bin/pnpm.mjs dev
```

Use Node's environment-file loader rather than sourcing `.env.google.local` in the shell; scope
lists contain spaces and the secret file is not a shell script.

Open `http://localhost:3000/ar/settings/connections` or the English equivalent while signed in as
the employee. The app sends Google to the fixed registered callback. The callback sends the
authorization code to the API in an authenticated internal POST body, removes provider parameters
from the browser URL, and returns to the exact localized Connections page. The status then reloads
from the private connected-context API.

### Local preview limits

- OAuth credentials exist only in API-process memory and disappear on process restart.
- Disconnect disables local credential use first and then makes a best-effort Google revocation
  request. A provider outage cannot restore local credential use.
- New private titles use AES-256-GCM with an in-memory key derived from the local Google client
  secret. Rotating that secret makes earlier local AES rows unreadable; this is not a production
  key-rotation design.
- The initial Gmail snapshot requests at most 25 recent message identifiers, reads only Subject
  metadata, and retains only messages dated within the previous 14 days. It deliberately does not
  use Gmail's `q` parameter because `gmail.metadata` does not permit that query capability.
- Gmail summaries stay `null`; bodies, snippets, MIME parts, attachment names, and attachment
  contents are never read or stored.
- Calendar imports future events with a page size of 25 and retains only title, time, link, and
  opaque event ID. Descriptions and attendees are not read or stored.
- Context remains private to the employee. It is not a Task, completion signal, Project progress
  value, performance input, or manager projection.
- Disconnect makes derived context inaccessible; it does not claim database deletion. Production
  retention/deletion policy is still required.

## Disconnect and deletion

Disconnect must revoke provider credential use, stop future synchronization, and make derived
private context inaccessible. It must not claim that stored derived records were deleted. Actual
deletion follows the approved retention/deletion policy when that policy is implemented.

## Operational failures

- `EXTERNAL_CONFIGURATION_REQUIRED`: one or more production gates are not complete.
- `GOOGLE_REAUTHORIZATION_REQUIRED`: the refresh credential is absent, rejected, or revoked; the
  employee must reconnect.
- `GOOGLE_WORKSPACE_UNAVAILABLE`: bounded transport retries were exhausted.
- `GOOGLE_OAUTH_FAILED`: authorization-code exchange or revocation failed without exposing the
  provider response.
- `GOOGLE_GMAIL_PROVIDER_ERROR` / `GOOGLE_CALENDAR_PROVIDER_ERROR`: the provider returned malformed
  or unsuccessful source data outside the defined cursor-expiry cases.

Operational telemetry may record these stable codes, request correlation IDs, attempt counts, and
timing. It must not record provider response bodies, tokens, codes, private source content, or source
URLs.

## Official references

- Gmail OAuth scopes: <https://developers.google.com/workspace/gmail/api/auth/scopes>
- Gmail history synchronization: <https://developers.google.com/workspace/gmail/api/guides/sync>
- Calendar incremental synchronization: <https://developers.google.com/workspace/calendar/api/guides/sync>
- Google Workspace user-data policy:
  <https://developers.google.com/workspace/workspace-api-user-data-developer-policy>
