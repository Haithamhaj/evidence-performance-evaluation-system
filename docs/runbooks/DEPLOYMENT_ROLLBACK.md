# Deployment Rollback

## Decision boundary

Rollback is appropriate for confirmed release regression, authorization/privacy failure, migration incompatibility, or unsafe operational behavior. Database migrations are forward-only after shared use; never edit or reverse an applied migration destructively.

## Procedure

1. Assign a release owner and incident/change reference. Pause the deployment and external consumers when needed.
2. Capture current commit, image/artifact digest, migration version, configuration versions, and health state without secrets.
3. If no forward migration was applied, redeploy the last verified artifact and matching non-secret configuration versions.
4. If a forward migration was applied, use a compatible previous application artifact only when the migration contract permits it; otherwise deploy a forward corrective migration/application.
5. Keep queues/connectors paused until schema compatibility and idempotency are confirmed.
6. Run health, protected authorization, representative employee/manager, queue, AI-boundary, and audit checks.
7. Resume bounded traffic, then reconcile queued/provider events.

Any shared/production data restore follows the separate [protected restore runbook](./RESTORE.md) and requires direct human approval. Record recovery evidence and follow-up owners in [incident response](./INCIDENT_RESPONSE.md).
