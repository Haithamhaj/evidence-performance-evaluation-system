# Google Workspace Connection

## Status

The live Google REST adapters exist, but production connection remains deliberately disabled with
`EXTERNAL_CONFIGURATION_REQUIRED`.

Deterministic Gmail and Calendar acceptance remains the supported runnable path until every
production gate below is approved and implemented. Creating an OAuth client for local testing does
not satisfy the production gate.

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

## Local test procedure

Provider-adapter tests use a mocked HTTP transport and require no Google or OpenAI credential:

```text
pnpm exec vitest run --project unit packages/connected-work-context/src/google/google-adapters.test.ts
```

Do not source, print, copy, or commit `.env.google.local` while running these tests. A future local
live callback may be enabled only through an explicit development composition that preserves the
same privacy boundary; it must not change the production gate.

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
