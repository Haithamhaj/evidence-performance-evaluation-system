# Isolated Restore Drill Evidence

## Scope

- Target: generated local isolated directory outside the repository.
- Source: synthetic database, object inventory, and non-secret configuration inventory.
- Shared/production mutation: none; the tool rejects those environments.
- Protected content in evidence: none.

## Acceptance checks

| Check                                                                  | Required result                 |
| ---------------------------------------------------------------------- | ------------------------------- |
| Backup signature and decryption                                        | `VERIFIED`                      |
| Backup age                                                             | Within the explicit drill limit |
| Schema compatibility                                                   | Version `37`                    |
| Database/object/config hashes                                          | Exact match                     |
| Audit/foreign-key/closed-evaluation/upward/evidence/window inventories | Present and non-negative        |
| Connectors and queue replay                                            | `disabled`                      |
| Production target without direct human gate                            | Rejected                        |

## Executed result — 2026-08-07

- The executable E6C dry run passed its `backup-restore` stage as part of an 8/8-stage run.
- Four focused tests passed: secret-free manifest creation/verification, production-target rejection without direct human approval, isolated restore/integrity verification, and local runbook-link validation.
- Database migration verification passed all 37 migrations from empty and previous-release snapshots, detected no schema drift, proved rebuild equivalence, and passed 77 database tests.
- The temporary encrypted bundle, key, and isolated restore directory were deleted after verification.
- No connector or queue replay occurred; both remained `disabled`.
- No shared or production database, object store, or configuration was mutated.

Promotion remains a separate direct-human decision. A real production drill additionally requires the external backup destination, accountable key custody, maintenance window, safety backup, and explicit approval reference recorded in the external gate register.
