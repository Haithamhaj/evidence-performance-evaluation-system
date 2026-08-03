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

## Operational gate

The implementation intentionally did not make a live model call. Before a live
voice smoke/eval, deployment must register the approved `update.transcribe` AI
route and its output-schema artifact in the governed AI Router configuration.
That call must remain routed and must not log audio or transcripts.

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
  The retry/resume endpoint and dedicated current-permission/concurrency proofs
  remain in progress; P2/P3 follow the established issue #9 backlog.
