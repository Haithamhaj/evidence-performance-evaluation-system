# Engine Incident Response

## First actions

1. Assign an incident commander and correlation ID; record UTC start time.
2. Classify the affected boundary: identity, authorization, database, queue, storage, connector, AI route, notification, export, backup, or audit.
3. Contain with the smallest reversible action: disable one route/connector/export, pause consumers, or place the approved environment in maintenance mode.
4. Preserve audit, immutable history, operation receipts, logs, and version metadata. Never paste secrets or private content into the incident record.
5. Confirm manual employee paths remain available. Do not weaken authorization, privacy mode, human gates, or protected product rules to restore service.

## Diagnosis and recovery

- Use public health only for liveness/readiness. Authorized administrators may inspect bounded dependency status with correlation IDs.
- Revoke a suspected connector using the [connector procedure](./CONNECTOR_REVOCATION.md).
- Replay durable work only with the [queue procedure](./QUEUE_REPLAY.md).
- Revoke an exposed export using the [export procedure](./EXPORT_REVOCATION.md).
- Restore only after verified backup and the [protected restore procedure](./RESTORE.md).
- Roll back a release using the [deployment procedure](./DEPLOYMENT_ROLLBACK.md).

## Closure

Verify authorization boundaries, audit-chain continuity, worker backlog, connector reconciliation, notification receipts, and representative employee/manager journeys. Record facts, impact window, recovery evidence, and follow-up owners without employee scoring or rankings.
