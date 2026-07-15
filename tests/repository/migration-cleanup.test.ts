import { describe, expect, it } from "vitest";

import {
  cleanupMigrationResources,
  executeVerificationWithCleanup,
} from "../../scripts/verify-migrations.mjs";

describe("migration verification cleanup", () => {
  it("attempts every database action, admin close, and temp removal despite injected failures", async () => {
    const actions: string[] = [];
    const databaseNames = ["verify_empty", "verify_previous", "verify_rebuild"];
    const admin = {
      async connect() {
        actions.push("connect");
      },
      async query(sql: string, parameters?: string[]) {
        const operation = sql.startsWith("SELECT") ? "terminate" : "drop";
        const databaseName = parameters?.[0] ?? /"([^"]+)"$/u.exec(sql)?.[1] ?? "unknown";
        actions.push(`${operation}:${databaseName}`);
        throw new Error(`${operation} failed for ${databaseName}`);
      },
      async end() {
        actions.push("end");
        throw new Error("admin close failed");
      },
    };
    const removeDirectory = async (directory: string) => {
      actions.push(`remove:${directory}`);
      throw new Error("temp removal failed");
    };

    const failures = await cleanupMigrationResources({
      admin,
      connected: true,
      disposableNames: databaseNames,
      previousMigrationsPath: "/tmp/previous-migrations",
      removeDirectory,
    });

    expect(actions).toEqual([
      "terminate:verify_empty",
      "drop:verify_empty",
      "terminate:verify_previous",
      "drop:verify_previous",
      "terminate:verify_rebuild",
      "drop:verify_rebuild",
      "end",
      "remove:/tmp/previous-migrations",
    ]);
    expect(failures).toHaveLength(8);
  });

  it("keeps the verification error primary and attaches every cleanup failure", async () => {
    const verificationFailure = new Error("verification failed");
    const cleanupFailures = [new Error("drop failed"), new Error("temp removal failed")];
    const reportedFailures: Error[] = [];

    let received: unknown;
    try {
      await executeVerificationWithCleanup(
        async () => {
          throw verificationFailure;
        },
        async () => cleanupFailures,
        (cleanupFailure) => reportedFailures.push(cleanupFailure),
      );
    } catch (error) {
      received = error;
    }

    expect(received).toBe(verificationFailure);
    expect((received as Error & { cleanupFailures?: Error[] }).cleanupFailures).toEqual(
      cleanupFailures,
    );
    expect(reportedFailures).toEqual(cleanupFailures);
  });

  it("fails with an aggregate when verification succeeds but cleanup fails", async () => {
    const cleanupFailures = [new Error("admin close failed"), new Error("temp removal failed")];

    await expect(
      executeVerificationWithCleanup(
        async () => undefined,
        async () => cleanupFailures,
      ),
    ).rejects.toMatchObject({
      errors: cleanupFailures,
      message: "Migration verification cleanup failed",
    });
  });
});
