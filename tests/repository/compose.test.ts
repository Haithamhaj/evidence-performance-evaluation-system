import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("local infrastructure", () => {
  it("pins every required service by tag and digest", async () => {
    const compose = await readFile("infra/docker/compose.yml", "utf8");
    expect(compose).toContain(
      "postgres:17.10-bookworm@sha256:4f736ae292687621d4dbe0d499ffd024a36bd2ee7d8ca6f2ccd4c800f047b394",
    );
    expect(compose).toContain(
      "redis:8.2.7-bookworm@sha256:d30960f73a599496d8b2802c97758bab6b1cd421fd06337f837779c47a57e1f3",
    );
    expect(compose).toContain(
      "minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e",
    );
    expect(compose).toContain(
      "quay.io/keycloak/keycloak:26.7.0@sha256:2eb3cd316835c990e69e26ade292ffa78f6fb0db7d5fc6377463c162e1979ac0",
    );
    expect(compose).not.toMatch(/image:\s+\S+:latest(?:\s|$)/);
  });

  it("keeps database passwords out of process arguments", async () => {
    const [databaseInitialization, infrastructureVerification] = await Promise.all([
      readFile("infra/docker/postgres/001-databases.sh", "utf8"),
      readFile("scripts/verify-infra.mjs", "utf8"),
    ]);

    expect(databaseInitialization).not.toContain("--set=role_password=");
    expect(infrastructureVerification).not.toMatch(/`PGPASSWORD=\$\{[^}]+\}`/);
  });

  it("lints root scripts and tests through the standard lint command", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8"));
    const lintScript = manifest.scripts?.lint;

    expect(lintScript).toMatch(/eslint [^&]*scripts/);
    expect(lintScript).toMatch(/eslint [^&]*tests/);
  });
});
