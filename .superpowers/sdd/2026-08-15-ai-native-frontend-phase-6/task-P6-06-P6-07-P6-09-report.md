# Phase 6 Evaluation — P6-06, P6-07, and P6-09

## Outcome

- P6-06: an assigned manager can review the two submitted positions and record each final rating as
  an explicit human decision. The manager must explain any change from the initial manager rating.
- P6-07: the employee can acknowledge receipt or acknowledge with a written reservation. The
  reservation is separate from and cannot change the final rating.
- P6-09: an authorized employee can queue an English immutable evaluation export through the
  existing protected export service. Arabic evaluation export remains blocked.

The browser remains a presentation/composition client. All three actions use the existing protected
domain commands, idempotency, immutable snapshot, audit, and export queue boundaries.

## Database changes

None. The existing final snapshot, acknowledgment, export request, manifest, and artifact lifecycle
are reused.

## Verification

- Evaluation workspace, same-origin gateway, and journey schema: 3 files / 19 tests passed.
- Web TypeScript check passed.
- Web lint passed.
- Affected formatting and diff checks passed.

## Security and privacy impact

- Final ratings are supplied only by the authorized manager; no AI rating field exists in UI or
  gateway payloads.
- Acknowledgment accepts no rating field and cannot mutate the final snapshot.
- Export requests are re-authorized by the existing operations/reporting services and remain queued,
  expiring, revocable private artifacts.
- Arabic evaluation/export remains behind T016.

## Remaining risk and work

- A live manager decision remains a protected direct-human gate; Codex did not select one.
- P6-08 and P6-10–P6-14 remain for identified upward feedback, preparation-agent closure,
  fixed-composition/Arabic/negative proof, and final capability reconciliation.

