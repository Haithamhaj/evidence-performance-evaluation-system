import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { afterEach, describe, expect, it } from "vitest";

import { OperationsModule } from "./operations.module.js";

const originalRedis = process.env.REDIS_URL;
const originalBucket = process.env.DOCUMENT_STORAGE_BUCKET;
const originalDatabase = process.env.DATABASE_URL;
const originalOidcIssuer = process.env.OIDC_ISSUER;
const originalOidcAudience = process.env.OIDC_AUDIENCE;

afterEach(() => {
  restore("REDIS_URL", originalRedis);
  restore("DOCUMENT_STORAGE_BUCKET", originalBucket);
  restore("DATABASE_URL", originalDatabase);
  restore("OIDC_ISSUER", originalOidcIssuer);
  restore("OIDC_AUDIENCE", originalOidcAudience);
});

describe("OperationsModule", () => {
  it("boots without Redis or object storage so admin health can report the external gates", async () => {
    delete process.env.REDIS_URL;
    delete process.env.DOCUMENT_STORAGE_BUCKET;
    process.env.DATABASE_URL =
      originalDatabase ?? "postgresql://evaluation:evaluation@127.0.0.1:5432/evaluation";
    process.env.OIDC_ISSUER = originalOidcIssuer ?? "http://127.0.0.1:8081/realms/evaluation";
    process.env.OIDC_AUDIENCE = originalOidcAudience ?? "evaluation-api";
    const context = await NestFactory.createApplicationContext(OperationsModule, {
      logger: false,
      abortOnError: false,
    });
    expect(context).toBeDefined();
    await context.close();
  });
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
