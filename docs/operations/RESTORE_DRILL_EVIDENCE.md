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

The executed date, command result, and exact test count are recorded during the final E6C technical dry run. Promotion remains a separate direct-human decision.
