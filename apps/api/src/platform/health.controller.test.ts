import { createServer } from "node:net";

import { describe, expect, it, vi } from "vitest";

import { evaluateReadiness } from "@evaluation/observability";

import { createProtocolReadinessProbes, HealthController } from "./health.controller.js";

describe("HealthController", () => {
  it("keeps liveness limited to process availability", () => {
    const controller = new HealthController({
      configuration: async () => false,
      postgres: async () => false,
      redis: async () => false,
    });

    expect(controller.live()).toEqual({ status: "live" });
  });

  it("returns a ready result for Nest to serve with HTTP 200", async () => {
    const controller = new HealthController({
      configuration: async () => true,
      postgres: async () => true,
      redis: async () => true,
    });

    const response = { status: vi.fn() };
    const result = await controller.ready(response);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(result).toEqual({
      status: "ready",
      checks: { configuration: "up", postgres: "up", redis: "up" },
    });
  });

  it("returns a sanitized HTTP 503 response when any readiness check is down", async () => {
    const controller = new HealthController({
      configuration: async () => true,
      postgres: async () => true,
      redis: async () => false,
    });

    const response = { status: vi.fn() };
    await expect(controller.ready(response)).resolves.toEqual({
      status: "not_ready",
      checks: { configuration: "up", postgres: "up", redis: "down" },
    });
    expect(response.status).toHaveBeenCalledWith(503);
  });

  it("does not treat an open non-PostgreSQL/non-Redis TCP socket as ready", async () => {
    const server = createServer((socket) => {
      socket.write("not a database protocol");
      socket.destroy();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("missing test port");

    try {
      const probes = createProtocolReadinessProbes({
        databaseUrl: `postgresql://user:password@127.0.0.1:${address.port}/database`,
        redisUrl: `redis://127.0.0.1:${address.port}`,
        timeoutMs: 250,
      });
      const result = await evaluateReadiness(probes);

      expect(result).toEqual({
        status: "not_ready",
        checks: { configuration: "up", postgres: "down", redis: "down" },
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error === undefined ? resolve() : reject(error))),
      );
    }
  });

  it("reports malformed or wrong-protocol configuration without returning its values", async () => {
    const probes = createProtocolReadinessProbes({
      databaseUrl: "http://user:database-password@example.invalid/database",
      redisUrl: "http://user:redis-password@example.invalid",
      timeoutMs: 50,
    });

    const result = await evaluateReadiness(probes);
    expect(result).toEqual({
      status: "not_ready",
      checks: { configuration: "down", postgres: "down", redis: "down" },
    });
    expect(JSON.stringify(result)).not.toMatch(/password|postgresql:\/\/|redis:\/\//iu);
  });

  it("marks Redis down when the protocol rejects authentication", async () => {
    const sockets = new Set<import("node:net").Socket>();
    const server = createServer((socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      socket.once("data", () =>
        socket.end("-WRONGPASS invalid username-password pair or user is disabled.\r\n"),
      );
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("missing test port");

    try {
      const probes = createProtocolReadinessProbes({
        databaseUrl: "postgresql://user:password@127.0.0.1:1/database",
        redisUrl: `redis://default:wrong-password@127.0.0.1:${address.port}`,
        timeoutMs: 250,
      });
      const result = await evaluateReadiness(probes);

      expect(result.checks.redis).toBe("down");
      expect(JSON.stringify(result)).not.toContain("wrong-password");
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error === undefined ? resolve() : reject(error))),
      );
    }
  });
});
