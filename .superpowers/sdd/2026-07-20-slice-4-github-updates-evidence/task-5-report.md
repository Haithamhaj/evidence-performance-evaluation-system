# Task 5 report — Governed voice capture

## Implemented

- Migration `0025_voice_update_sources` adds private voice sessions, immutable
  transcript revisions, separate transcript confirmations, AI-run trace links,
  source retention metadata, and a `voice_transcript` Update attachment type.
- `update.transcribe` is represented by a versioned strict schema and is invoked
  only through the AI Router. Its input contains opaque upload/session references
  and inspected metadata, never an object key, audio bytes, transcript, or secret.
- Voice sources may enter an Update only after the transcript confirmation gate.
  The resulting immutable attachment is scope-bound and checksum-traced; the
  source loader passes only the confirmed revision into the existing Update flow.
- The protected Voice Updates API exposes start, employee revision, and employee
  confirmation endpoints through the existing same-origin gateway.
- The composer supports microphone permission plus `MediaRecorder` where the
  browser can make accepted MP4 audio, a bounded upload fallback otherwise, and
  separate transcript correction/confirmation before the normal Continue action.
- Start idempotency compares employee, source, scope, and duration. The
  transcriber receives inspected MIME/byte size; oversize or non-audio uploads
  are rejected before AI. Temporary cleanup is recorded only after it succeeds,
  and cleanup failure leaves a successful transcript ready rather than failed.

## TDD evidence

- RED: both the transcriber module and voice capture component were absent; the
  focused suites failed to resolve them.
- GREEN: strict Fusha, Gulf, Levantine, English, and mixed Arabic/English fixture
  metadata passes; the router test proves `update.transcribe` is the sole route;
  the UI test proves transcript confirmation is not the final Update confirmation
  and verifies the injectable recording adapter releases microphone tracks.

## Verification

- Focused unit/API/UI tests: 20 passed; deterministic voice AI-contract tests:
  6 passed; voice service/database integration tests: 3 passed.
- Integration coverage proves immutable correction history, stale-version refusal,
  confirmation-gated Update start, confirmed text rejoining the existing source
  loader, inspected audio metadata, idempotency conflict protection, cleanup
  failure preservation, and oversize rejection.
- Affected typechecks passed for contracts, database, Updates & Evidence, API,
  and web (19 workspace tasks).
- `pnpm db:verify` passed empty database, upgrade from `0024`, drift, and rebuild.
- Affected lint, AI-boundary, secret scan, and whitespace check passed.

## Operational acceptance

- Registered the approved `update.transcribe` prompt, output schema,
  `gpt-4o-transcribe` provider configuration, and system route in the local
  governed AI Router. Registration was audited and did not read, print, move, or
  persist the provider credential.
- Generated a synthetic WAV containing no personal or production data and sent
  it through `AiRouterVoiceTranscriber` with the project's private-media
  boundary. The live OpenAI request succeeded, returned the expected transcript,
  and persisted an AI-run trace.
- The local live check exercised route resolution, artifact validation,
  credential resolution, multipart media delivery, output validation, and AI-run
  recording together. Arabic dialect fixtures remain a separate deferred live
  evaluation item in GitHub issue #9.

## Fix round 1

- The transcriber now loads and validates the persisted `update.transcribe`
  prompt artifact descriptor before routing. The runtime adapter resolves bounded
  bytes from private storage only for the opaque upload reference and posts the
  multipart file plus `gpt-4o-transcribe` model to the transcription endpoint;
  raw bytes stay outside router input and trace data.
- Workstream-scoped uploads derive their Project from the workstream relation.
  Transcript revision and confirmation reauthorize current scope and lock the
  voice session before selecting its latest revision.
- Added adapter multipart-byte, artifact-descriptor, and workstream upload
  regressions. Focused adapter/transcriber/UI unit suites and the voice service
  integration suite pass locally. No live provider request was made.
- Commits through this checkpoint: `701138b`, `d9c652d`, and `5741df2`.
  Documentation checkpoint: `5e0ef9c`.

### Fix round 1 continuation

- Added an owner- and current-scope-authorized retry endpoint. Failed or
  stranded transcription resumes on the same session and idempotency identity;
  successful replay creates exactly one transcript revision.
- Added a server cancellation path by session or active idempotency key. A
  cancelled session wins over a late provider response, so late audio output
  cannot create a transcript revision or advance the Update lifecycle.
- The client now distinguishes permission request, recording with elapsed time,
  secure upload, transcription, ready, cancelled, and failure states. Cancel is
  available across active states and retry is explicit. Confirmed transcript
  text remains read-only.
- Added real PostgreSQL regressions for retry, late-result cancellation,
  permission loss before revise/confirm, and concurrent revise/confirm
  serialization.
- Added the idempotent, audited `register-update-transcribe-ai-route.ts` flow for
  prompt artifact, portable output schema, `gpt-4o-transcribe` provider, and
  system route. Dry-run output is credential-free and the script never reads or
  prints the provider credential.
- Verification: 14 focused adapter/transcriber/UI/API/registration unit tests,
  8 voice integration tests, 6 AI contract evals, affected package/API/web
  typechecks and lint, AI-boundary scan (650 files), secret scan (1,042 files),
  dry-run route validation, and `git diff --check` all passed.
- Scoped re-review remains required before Task 5 is marked complete. P2/P3 are
  recorded in GitHub issue #9 and do not block this round.

### Fix round 2

- The first scoped re-review confirmed six P1s closed and identified two
  remaining interactions: a cancellation request could precede server-session
  creation, and route-specific OpenAI model configs conflicted at composition.
- The client now re-cancels by returned session ID whenever an earlier
  idempotency-key cancellation raced session creation. The server continues to
  reject late provider output after cancellation.
- Migration `0026_voice_transcription_attempt_lease` adds a persisted attempt
  token and start time. A live attempt has a 90-second lease, so a normal replay
  returns the existing `transcribing` session without a duplicate provider call;
  a genuinely stranded attempt can rotate its token and resume safely. Results
  from an expired token cannot mutate the current session.
- Runtime composition now shares one adapter/credential transport across
  route-specific model configs only when provider key, adapter, endpoint,
  locality, and local-trust policy are identical. It still fails closed for a
  conflicting endpoint or trust policy.
- Verification: 16 focused unit tests, 9 real voice integration tests, affected
  database/AI Router/Updates/API/web typechecks and lint, migration verification
  from empty and previous `0025` snapshots (including 49 schema tests), AI
  boundary scan, secret scan, and whitespace check passed.
- The bounded corrected-finding re-review approved the cancellation/retry
  lifecycle and provider-composition fixes with no remaining P0/P1 findings.
