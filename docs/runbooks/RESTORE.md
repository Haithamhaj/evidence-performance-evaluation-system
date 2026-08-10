# Protected Restore Runbook

## Safety boundary

The repository workflow restores only to a newly created, empty, local isolated target. It deliberately refuses shared, staging, and production targets with `direct human approval required`. This is a genuine protected human gate: no automated agent or CI job may bypass it.

A production restore requires a separately approved operator procedure, named approver, change record, maintenance window, current safety backup, tested rollback, infrastructure credentials, disabled connectors, and disabled queue/webhook replay. Those items remain `EXTERNAL_GATE`.

## Isolated drill

1. Verify the encrypted backup using the backup runbook.
2. Generate a new empty filesystem target outside the repository and a new, nonexistent local PostgreSQL database name beginning with `ebpes_restore_`.
3. Record a local drill approval reference and a fresh safety-backup reference.
4. Keep maintenance mode enabled and connectors/queue replay disabled.
5. Restore with the expected migration schema version.
6. Run restored-engine verification.
7. Inspect only pass/fail hashes, counts, and representative protected-record classes; do not include protected content in evidence.

```sh
node scripts/backup/restore-engine-backup.mjs \
  --environment local-isolated \
  --manifest <backup>/manifest.json \
  --key-file <key-handle> \
  --target-dir <new-empty-target> \
  --approval-reference <local-drill-reference> \
  --maintenance-mode enabled \
  --safety-backup-reference <reference> \
  --connectors disabled \
  --queue-replay disabled \
  --expected-schema-version 38 \
  --admin-database-url <local-postgres-admin-url> \
  --target-database-url <local-ebpes_restore_database-url> \
  --postgres-container <postgres-container> \
  --max-age-hours 24

node scripts/backup/verify-restored-engine.mjs \
  --target-dir <new-empty-target> \
  --target-database-url <local-ebpes_restore_database-url> \
  --postgres-container <postgres-container>
```

Success means the source manifest was cryptographically verified, migration compatibility matched, PostgreSQL was restored into the new isolated database, each object payload was written and hash-verified, configuration was restored, connector replay remained disabled, and protected row counts, foreign keys, and append-only controls match live queries against the restored database. It is not authorization to promote the restored target.
