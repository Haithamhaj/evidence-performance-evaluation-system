# Protected Queue Replay

## Preconditions

- Incident/change reference and authorized operator.
- Provider/database dependency recovered.
- Consumer scope, job type/version, time window, and maximum replay count identified.
- Existing operation receipt and payload hash inspected; payload content is not copied into evidence.
- Connectors remain paused when replay could trigger external effects.

## Replay

1. Select only failed/retryable operations with the approved administrative replay interface.
2. Supply an audit reason and retain the original idempotency key/effect receipt.
3. Reject unknown schema versions, payload-hash conflicts, already-succeeded effects, and missing authorization scope.
4. Replay a bounded batch; observe success/failure counts and latency by correlation ID.
5. Stop on authorization, integrity, or repeated provider failures.
6. Reconcile queue state with durable operation receipts before resuming consumers.

Replaying the same envelope must return the first protected effect receipt and must not duplicate notifications, evidence, updates, or external actions. Use [incident response](./INCIDENT_RESPONSE.md) for escalation.
