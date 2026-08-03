# SDD ledger — plan: docs/superpowers/plans/2026-07-20-slice-4-github-updates-evidence.md

Task 1: in progress (base 2be4838; migration path corrected from occupied 0020 to next safe 0022)
Task 1: review round 0 — Important open: binding history can be deleted and createdAt can change during closure
Task 1: minor (deferred): governedFacts needs a strict writer-side schema before the first S4-T2 persistence path
Task 1: fix round 1/5 (1 addressed, 0 open — binding delete/createdAt immutability; commits 6b71a2f..cb10143)
Task 1: complete (commits 2be4838..cb10143, review clean)
Task 2: in progress (base a6bcfdf; live GitHub App creation/installation remains externally gated)
Task 2: review round 0 — P0/P1 open: production raw body missing; real GitHub payload rejected; broad P2002 replay classification; no real Prisma receipt/audit integration proof
Task 2: minor (deferred): reconciliation recovered counter includes duplicate receipts
Task 2: fix round 1/5 (4 addressed, 0 open — raw body, payload tolerance, replay classification, Prisma atomicity; commits 2482f86..9335ad5)
Task 2: minor addressed in fix round 1: recovered count now excludes duplicate receipts
Task 2: complete (commits a6bcfdf..9335ad5, review clean)
Task 3: in progress (base 9335ad5; GitHub remains suggested evidence and raw volume is prohibited)
Task 3: review round 0 — P1 open: async publish not awaited; Projects reads GitHub persistence directly; candidate rule JSON lacks scoped FK integrity; owner-review row cannot append reevaluation/resolution history
Task 3: minor (deferred): deduplicate matched rule IDs before ambiguity classification
Task 3: plan ownership note: exact-match application to official snapshot must be explicitly assigned before Slice 4/5 acceptance; not a Task 3 P1
Task 3: fix round 1/1 (4 P1 + 1 minor addressed, 0 open — awaited publication, public governed-source reader, relational candidate integrity, append-only reevaluation history, match deduplication; commit aa54947)
Task 3: complete (commits 9335ad5..aa54947, scoped re-review clean)
Task 4: in progress (base aa54947; universal text/image/file/code capture, draft-first flow, no product-rule changes)
Task 4: review round 0 — P1 open: no user-usable file/image path; UI is single-source and forces text; source metadata recovery is lossy; idempotency omits attachment identity
Task 4: P2 deferred to backlog: derive/validate semantic attachment kind against inspected upload MIME/type
Task 4: P3 deferred to backlog: add richer keyboard/file/multi-source browser interaction coverage
Task 4: P2/P3 backlog recorded in GitHub issue #9 (non-blocking)
Task 4: fix round 1/2 (3 P1 addressed, 1 P1 remains — recovered inspected upload metadata is not resubmitted after reload; commit 182274b)
Task 4: fix round 2/2 (1 P1 addressed, 0 open — recovered inspected uploads/safe URLs are merged into retry and stripped bodies remain excluded; commit 21c7383)
Task 4: complete (commits aa54947..21c7383, scoped re-review clean; P2/P3 in issue #9)
Task 5: in progress (base 21c7383; governed voice connector into the same Update lifecycle)
Task 5: implementation and first hardening commits `701138b`, `d9c652d`, `5741df2`, and documentation checkpoint `5e0ef9c`; private multipart media resolution, artifact descriptors, current-scope reauthorization, locking, cancellation, and truthful cleanup are in place.
Task 5: fix round 1 continuation — retry/resume on the same idempotent session, late-result cancellation precedence, explicit client retry/cancel states, permission-loss and real PostgreSQL concurrency regressions, and governed `update.transcribe` route registration are implemented and focused verification is green. Awaiting scoped re-review before completion; P2/P3 are tracked in issue #9.
Task 5: scoped re-review — 6 P1 addressed, 1 partial lifecycle P1 and 1 new provider-composition P1 open (pre-session cancellation/replay race; same-provider multi-model configuration conflict).
Task 5: fix round 2 — client re-cancels the returned server session after an early cancellation race; a 90-second persisted attempt lease/token prevents duplicate provider work while permitting safe stranded recovery; runtime composition now permits route-specific models only when they share the exact governed provider transport and still rejects endpoint/policy conflicts. Migration 0026 verified from empty and 0025 snapshots. Awaiting corrected-finding re-review.
