import { describe, expect, it } from "vitest";

import { evaluateReadiness } from "../../packages/observability/src/index.js";
import { createProtocolReadinessProbes } from "../../apps/api/src/platform/health.controller.js";

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://evaluation_test:local-evaluation-test-password@127.0.0.1:5432/evaluation_test";
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

function replacePassword(connectionUrl: string, password: string): string {
  const url = new URL(connectionUrl);
  if ((url.protocol === "redis:" || url.protocol === "rediss:") && url.username.length === 0) {
    url.username = "default";
  }
  url.password = password;
  return url.toString();
}

describe("protocol readiness", () => {
  it("proves PostgreSQL SELECT 1 and Redis PING against the live services", async () => {
    const result = await evaluateReadiness(
      createProtocolReadinessProbes({ databaseUrl, redisUrl, timeoutMs: 1_000 }),
    );

    expect(result).toEqual({
      status: "ready",
      checks: { configuration: "up", postgres: "up", redis: "up" },
    });
  });

  it("marks PostgreSQL down when its credentials are rejected", async () => {
    const result = await evaluateReadiness(
      createProtocolReadinessProbes({
        databaseUrl: replacePassword(databaseUrl, "wrong-database-password"),
        redisUrl,
        timeoutMs: 1_000,
      }),
    );

    expect(result.checks).toEqual({ configuration: "up", postgres: "down", redis: "up" });
    expect(JSON.stringify(result)).not.toMatch(/wrong-|postgresql:\/\/|redis:\/\//u);
  });
});
