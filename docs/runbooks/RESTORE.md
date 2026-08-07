# Protected Restore Runbook

## Safety boundary

The repository workflow restores only to a newly created, empty, local isolated target. It deliberately refuses shared, staging, and production targets with `direct human approval required`. This is a genuine protected human gate: no automated agent or CI job may bypass it.

A production restore requires a separately approved operator procedure, named approver, change record, maintenance window, current safety backup, tested rollback, infrastructure credentials, disabled connectors, and disabled queue/webhook replay. Those items remain `EXTERNAL_GATE`.

## Isolated drill

1. Verify the encrypted backup using the backup runbook.
2. Generate a new empty target outside the repository.
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
  --expected-schema-version 37 \
  --max-age-hours 24

node scripts/backup/verify-restored-engine.mjs --target-dir <new-empty-target>
```

Success means the source manifest was cryptographically verified, migration compatibility matched, database/object/config hashes match, connector replay remained disabled, and all required integrity classes were represented. It is not authorization to promote the restored target.
