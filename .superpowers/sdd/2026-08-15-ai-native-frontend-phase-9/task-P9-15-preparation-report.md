# P9-15 Preparation Report

## Status

Prepared for the Product Owner launch gate. The gate itself remains open.

## What changed

- Added a single decision document for the running Cohort 0 review.
- Re-seeded the local Codex dogfood Project against the current repository state.
- Ran the governed live OpenAI Progress Contract drafting route.
- Preserved the human activation gate and left retained rollback routes unchanged.

## Runtime evidence

- Web returned HTTP 200 on port 3000.
- API readiness returned HTTP 200 on port 3001.
- Dogfood seed completed with Project `c2ab037e-e945-4ed9-a6cd-756099e2b066`, Document version 8,
  six current seeded Work Items plus one preserved existing item, and three private Inbox captures.
- Live AI drafting returned `ready`, revision 1, trace
  `2197bd1a-0aef-4d6b-92ec-4c382c4befd5`, and `human_activation_required`.

## Database changes

No schema or migration change. Only local synthetic acceptance data was refreshed.

## Security and privacy impact

No permission, identity, evaluation, Project-progress, or AI-authority rule changed. No credential was
printed or committed. The live draft stayed behind the protected human gate.

## Remaining risk

- The Product Owner has not yet accepted the visible running journey.
- The local Mac Docker VM has a tight two-gigabyte memory allocation. ClamAV needed Keycloak paused
  during its cold database load, then both services ran together. This is a local review-environment
  constraint and should be removed before asking employees to self-start the full stack.
- The bundled ClamAV health command resolves `localhost` to IPv6 while the service listens on IPv4;
  the scanner itself responded successfully on `127.0.0.1`, but the container health label remains a
  false negative. This operational configuration issue is recorded and not hidden by disabling
  upload safety.

## Next action

Product Owner reviews `docs/reviews/PHASE_9_PRODUCT_OWNER_LAUNCH_REVIEW.md` against the running
English product and records the Cohort 0 decision. P9-02 route retirement remains blocked until that
decision.
