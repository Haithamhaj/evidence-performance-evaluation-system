# Queue effect contract

PostgreSQL is authoritative for an operation. A processor receives a `JobEffectContext` and must
perform protected database writes through `context.transaction`. Those writes and the successful
`Operation` transition commit in one bounded transaction. A thrown processor error rolls the writes
back before the operation is retained as failed and retryable. A row lock serializes duplicate or
recovered executions, including an operation left in `running` state by a terminated worker.

External systems cannot provide exactly-once delivery through a local database transaction. A
processor must obtain `context.externalEffect(name)`, send its stable `idempotencyKey` to an external
provider that supports idempotent requests, and store the provider's safe receipt with
`recordReceipt`. On retry, `findReceipt` is checked before repeating the request. Receipt values are
durable, constrained, and must never contain credentials, tokens, private payload content, or other
secrets.

The worker runtime is started only when both `DATABASE_URL` and `REDIS_URL` are configured. Nest's
application lifecycle starts the configured BullMQ consumer and drains and closes the same runtime
on application shutdown. The health controller remains composed even when queue configuration is
absent, so liveness remains available while readiness reports missing dependencies.
