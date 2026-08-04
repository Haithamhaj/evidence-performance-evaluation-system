# Local Development Infrastructure

The local stack provides PostgreSQL, Redis, private S3-compatible object storage, and an OIDC realm. Every host port binds to `127.0.0.1`, every service uses an immutable image digest, and each stateful service uses its own named volume.

## Start and verify

Use the exact versions declared by `.node-version` and `package.json`: Node.js `24.18.0` and pnpm
`11.13.0`. Activate Node with your local version manager, then verify both versions before running
the project:

```bash
node --version
pnpm --version
cp .env.example .env.local
pnpm infra:up
pnpm infra:verify
pnpm db:verify
pnpm test:integration
pnpm dev
```

The values in `.env.example` are deliberately non-secret and suitable only for local development. Do not reuse them in shared or deployed environments. `.env.local` is ignored by Git.

`pnpm dev` loads `.env.local` itself, rejects the wrong Node.js version or missing required runtime
values with a clear message, and starts the web app, API, worker, and reference prototype. If
`.env.openai.local` exists in the current or main Git worktree, it is loaded without printing the
credential. Turbo exposes `OPENAI_API_KEY` only to the API and worker processes that compose the
governed AI Router; it is not passed to the web app or reference prototype. The system still
starts without that optional credential and preserves its manual recovery paths.

`pnpm test:integration` loads the non-secret local service defaults from `.env.example` and the
test database from `.env.test` (or the tracked `.env.test.example` when that local file is absent),
then always maps `DATABASE_URL` to the isolated `TEST_DATABASE_URL` for its child processes. It
never falls back to the application database.

`pnpm db:verify` likewise loads only the tracked local verification defaults and creates disposable
databases for the empty, previous-snapshot, drift, and rebuild checks.

Open the production web app at `http://localhost:3000` and the reference prototype at
`http://localhost:3100`. API and worker readiness are available at
`http://127.0.0.1:3001/health/ready` and `http://127.0.0.1:3002/health/ready`.

Next.js may generate development-only route types while the servers are running. The development
runner restores the stable tracked `next-env.d.ts` files on a normal `Ctrl+C`, and every build or
typecheck also performs that repair before checking. Full browser acceptance runs intentionally
regenerate versioned screenshots; commit screenshot changes only when the accepted product view
changed, not merely because a verification run rewrote PNG metadata.

Available endpoints:

- PostgreSQL: `127.0.0.1:5432`
- Redis: `127.0.0.1:6379`
- MinIO API and console: `127.0.0.1:9000` and `127.0.0.1:9001`
- Keycloak and its management health endpoint: `127.0.0.1:8081` and `127.0.0.1:9002`
- OIDC issuer: `http://127.0.0.1:8081/realms/evaluation`

The imported realm exposes a public `evaluation-web` client with authorization-code flow and PKCE `S256`, a bearer-only `evaluation-api` audience, and local test groups. Web redirects are limited to `http://localhost:3000/*`.

## Stop or reset

Stop containers while retaining PostgreSQL, Redis, and MinIO data:

```bash
pnpm infra:down
```

Reset is intentionally destructive and refuses to run without both explicit guards:

```bash
APP_ENV=local RESET_LOCAL_DATA=YES pnpm infra:reset
```

That command removes the containers, network, and all three persistent volumes from the active Docker context. Confirm that Docker is using the intended local context first; loopback bindings limit port exposure on the selected Docker host but do not prevent targeting a configured remote context.
