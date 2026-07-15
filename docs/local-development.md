# Local Development Infrastructure

The local stack provides PostgreSQL, Redis, private S3-compatible object storage, and an OIDC realm. Every host port binds to `127.0.0.1`, every service uses an immutable image digest, and each stateful service uses its own named volume.

## Start and verify

Use the locked project environment for every command:

```bash
source .superpowers/runtime-env.zsh
cp .env.example .env.local
pnpm infra:up
pnpm infra:verify
pnpm test:integration -- tests/integration/object-storage.integration.test.ts
```

The values in `.env.example` are deliberately non-secret and suitable only for local development. Do not reuse them in shared or deployed environments. `.env.local` is ignored by Git.

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

That command removes the local containers, network, and all three persistent volumes. It cannot target a remote environment because the Compose file contains only loopback-bound local services.
