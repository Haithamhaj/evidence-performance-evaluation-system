import path from "node:path";

import { describe, expect, it } from "vitest";

import { validateRepositoryPostgresInspection } from "../../scripts/backup/postgres-tools.mjs";

const repositoryRoot = process.cwd();
const databaseUrl = "postgresql://postgres:local@127.0.0.1:5432/ebpes_restore_test";

function inspection(overrides: Record<string, unknown> = {}) {
  return {
    Name: "/evaluation-system-postgres-1",
    Config: {
      Labels: {
        "com.docker.compose.project": "evaluation-system",
        "com.docker.compose.service": "postgres",
        "com.docker.compose.project.config_files": path.join(
          repositoryRoot,
          "infra/docker/compose.yml",
        ),
      },
    },
    NetworkSettings: {
      Ports: { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "5432" }] },
    },
    ...overrides,
  };
}

describe("isolated PostgreSQL restore target", () => {
  it("binds the loopback URL to this repository's exact Compose PostgreSQL service", () => {
    expect(() =>
      validateRepositoryPostgresInspection({
        inspection: inspection(),
        databaseUrl,
        repositoryRoot,
      }),
    ).not.toThrow();
  });

  it("rejects a caller-selected shared container even when the URL looks local", () => {
    const shared = inspection({
      Config: {
        Labels: {
          "com.docker.compose.project": "shared-platform",
          "com.docker.compose.service": "postgres",
          "com.docker.compose.project.config_files": "/srv/shared/compose.yml",
        },
      },
    });

    expect(() =>
      validateRepositoryPostgresInspection({
        inspection: shared,
        databaseUrl,
        repositoryRoot,
      }),
    ).toThrow(/repository local PostgreSQL Compose service/iu);
  });
});
