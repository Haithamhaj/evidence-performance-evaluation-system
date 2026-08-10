# Engine Backup Runbook

## Purpose and boundary

This runbook creates a private, encrypted recovery bundle for the database, object-version inventory, and non-secret configuration-version inventory. The manifest contains hashes and counts only. It must never contain credentials, access tokens, uploaded content, feedback content, or encryption-key material.

The repository adapter is intentionally limited to an explicit local isolated target. Production scheduling, destination, retention-lock policy, and key custody remain `EXTERNAL_GATE` until infrastructure owners provide and approve them.

## Local verification

Prepare outside-repository files for a PostgreSQL custom-format dump, object inventory containing each versioned object's payload and SHA-256, non-secret configuration-version inventory, and a 32-byte backup key handle. The source database URL must be local for this repository drill; the named PostgreSQL 17 container supplies version-compatible dump/restore tools. Then run:

```sh
pnpm backup:create -- --target-dir <isolated-directory> --database-dump <custom-format.dump> --object-inventory <objects-with-payloads.json> --config-inventory <config.json> --key-file <key-handle> --key-reference <non-secret-key-id> --source-database-url <local-source-url> --postgres-container <postgres-container>
pnpm backup:verify -- --manifest <isolated-directory>/manifest.json --key-file <key-handle> --max-age-hours 24
```

Success requires `VERIFIED`, a valid manifest signature, a decryptable AES-256-GCM bundle, a valid PostgreSQL custom dump, matching database/object/config/protected-integrity hashes, and acceptable recovery-point age. The tool derives protected-history counts and append-only controls from the source database; it does not trust caller-supplied counters. Do not print or upload the key file.

## Production external gates

| Gate              | Required owner decision/evidence                                     | State           |
| ----------------- | -------------------------------------------------------------------- | --------------- |
| Destination       | Approved private, versioned, access-logged storage and region        | `EXTERNAL_GATE` |
| Schedule and RPO  | Approved frequency and maximum recovery-point age                    | `EXTERNAL_GATE` |
| Key custody       | KMS/HSM key, recovery owner, rotation and break-glass process        | `EXTERNAL_GATE` |
| Retention lock    | Approved lifecycle consistent with legal holds and immutable history | `EXTERNAL_GATE` |
| Alert destination | On-call route for failed/stale backups without protected payloads    | `EXTERNAL_GATE` |

No production-readiness claim is allowed while these gates are open.
