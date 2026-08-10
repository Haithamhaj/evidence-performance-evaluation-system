# Isolated Restore Drill Evidence

## Scope

- Target: generated local isolated directory outside the repository.
- Source: a PostgreSQL 17 custom dump of the live local isolated test database, a bounded object payload fixture with its SHA-256, and a non-secret configuration inventory.
- Shared/production mutation: none; the tool rejects those environments.
- Protected content in evidence: none.

## Acceptance checks

| Check                                                                  | Required result                 |
| ---------------------------------------------------------------------- | ------------------------------- |
| Backup signature and decryption                                        | `VERIFIED`                      |
| Backup age                                                             | Within the explicit drill limit |
| Schema compatibility                                                   | Version `38`                    |
| Restored PostgreSQL/object/config hashes                               | Exact match                     |
| Live audit/foreign-key/closed-evaluation/upward/evidence/window checks | Match the signed source state   |
| Protected append-only database controls                                | Present after restore           |
| Connectors and queue replay                                            | `disabled`                      |
| Production target without direct human gate                            | Rejected                        |

## Executed result — 2026-08-10

- The executable E6C dry run passed its `backup-restore` stage as part of an 8/8-stage run.
- The focused recovery gate passed: secret-free manifest creation/verification, production-target rejection without direct human approval, actual isolated PostgreSQL/object/config restore, and restored-state integrity verification.
- Database migration verification passed all 38 migrations from empty and previous-release snapshots, detected no schema drift, proved rebuild equivalence, and passed 77 database tests.
- The verifier queried the restored database itself; it did not trust caller-provided integrity counters. It matched protected record classes, foreign keys, and append-only controls to the signed source state.
- The temporary encrypted bundle, key, filesystem target, and generated `ebpes_restore_*` database were deleted after verification.
- No connector or queue replay occurred; both remained `disabled`.
- No shared or production database, object store, or configuration was mutated.

Promotion remains a separate direct-human decision. A real production drill additionally requires the external backup destination, accountable key custody, maintenance window, safety backup, and explicit approval reference recorded in the external gate register.
