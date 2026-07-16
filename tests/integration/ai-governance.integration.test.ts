import { z } from "zod";
import { appendAuditEvent } from "../../packages/audit/src/index.js";
import * as publicAiRouting from "../../packages/ai-routing/src/index.js";
import * as apiComposition from "../../apps/api/src/ai-routing/ai-routing.module.js";
import { createDatabaseClient } from "../../packages/database/src/index.js";
import { seedPilotWithAudit } from "../../scripts/seed-pilot.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

type DatabaseClient = ReturnType<typeof createDatabaseClient>;
type DatabaseTransaction = Parameters<Parameters<DatabaseClient["$transaction"]>[0]>[0];
type AuditWriter = import("../../packages/contracts/src/index.js").AuditWriter<DatabaseTransaction>;
type Principal = Readonly<{ userId: string; active: boolean }>;
type GovernanceApi = Readonly<{
  registerAuthorizedAiLocalTrustPolicy(
    client: DatabaseClient,
    principal: Principal,
    input: unknown,
    writer?: AuditWriter,
  ): Promise<Readonly<{ id: string; policyKey: string; version: number }>>;
  registerAuthorizedAiProviderConfig(
    client: DatabaseClient,
    principal: Principal,
    input: unknown,
    writer?: AuditWriter,
  ): Promise<Readonly<{ id: string; version: number }>>;
  registerAuthorizedAiOutputSchema(
    client: DatabaseClient,
    principal: Principal,
    input: unknown,
    writer?: AuditWriter,
  ): Promise<Readonly<{ id: string; schemaHash: string }>>;
}>;

const governance = apiComposition as unknown as GovernanceApi;
const databaseWriter: AuditWriter = { append: appendAuditEvent };

describe("AI governance public boundary", () => {
  it("keeps governance mutations off the ordinary AI-routing package surface", () => {
    expect(publicAiRouting).not.toHaveProperty("registerAiProviderConfig");
    expect(publicAiRouting).not.toHaveProperty("registerAiOutputSchemaArtifact");
    expect(publicAiRouting).not.toHaveProperty("changeAiRouteWithAudit");
    expect(publicAiRouting).not.toHaveProperty("registerAiLocalTrustPolicy");
  });

  it("exposes all governance mutations only through the protected API composition", () => {
    expect(governance.registerAuthorizedAiLocalTrustPolicy).toBeTypeOf("function");
    expect(governance.registerAuthorizedAiProviderConfig).toBeTypeOf("function");
    expect(governance.registerAuthorizedAiOutputSchema).toBeTypeOf("function");
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("audited AI governance composition", () => {
  let client: DatabaseClient;
  let administratorId: string;
  let managerId: string;

  beforeAll(async () => {
    client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
    await seedPilotWithAudit(
      client,
      { managerSubject: "pilot-manager", adminSubject: "system-admin" },
      databaseWriter,
    );
    administratorId = (await client.user.findUniqueOrThrow({ where: { pilotKey: "system-admin" } }))
      .id;
    managerId = (await client.user.findUniqueOrThrow({ where: { pilotKey: "pilot-manager" } })).id;
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  const policyInput = (policyKey: string, reason: string, allowedIps = ["127.0.0.1"]) => ({
    policyKey,
    allowedIps,
    reason,
    correlationId: crypto.randomUUID(),
  });

  it("denies inactive and non-administrator policy registration before state or audit", async () => {
    const managerAttempt = policyInput(
      `manager-policy-${crypto.randomUUID()}`,
      "Manager must not configure local provider trust",
    );
    const inactiveAttempt = policyInput(
      `inactive-policy-${crypto.randomUUID()}`,
      "Inactive administrator must not configure local provider trust",
    );

    await expect(
      governance.registerAuthorizedAiLocalTrustPolicy(
        client,
        { userId: managerId, active: true },
        managerAttempt,
        databaseWriter,
      ),
    ).rejects.toMatchObject({ code: "AUTHZ_ROLE_REQUIRED" });
    await expect(
      governance.registerAuthorizedAiLocalTrustPolicy(
        client,
        { userId: administratorId, active: false },
        inactiveAttempt,
        databaseWriter,
      ),
    ).rejects.toMatchObject({ code: "AUTHZ_INACTIVE" });
    await expect(
      client.auditEvent.count({
        where: {
          correlationId: { in: [managerAttempt.correlationId, inactiveAttempt.correlationId] },
        },
      }),
    ).resolves.toBe(0);
  });

  it("registers immutable policy versions with exact IP rows and atomic audits", async () => {
    const policyKey = `on-prem-${crypto.randomUUID()}`;
    const first = policyInput(policyKey, "Trust loopback and the approved Riyadh model host", [
      "127.0.0.1",
      "10.20.30.40",
    ]);
    const second = policyInput(
      policyKey,
      "Retire the first host list for a new approved model host",
      ["127.0.0.1", "10.20.30.41"],
    );

    const [firstResult, secondResult] = await Promise.all([
      governance.registerAuthorizedAiLocalTrustPolicy(
        client,
        { userId: administratorId, active: true },
        first,
        databaseWriter,
      ),
      governance.registerAuthorizedAiLocalTrustPolicy(
        client,
        { userId: administratorId, active: true },
        second,
        databaseWriter,
      ),
    ]);
    const policies = await client.aiLocalTrustPolicy.findMany({
      where: { policyKey },
      orderBy: { version: "asc" },
      include: { allowedIps: { orderBy: { ipAddress: "asc" } } },
    });

    expect(policies.map(({ version }) => version)).toEqual([1, 2]);
    expect(new Set([firstResult.version, secondResult.version])).toEqual(new Set([1, 2]));
    expect(policies[0]?.allowedIps.map(({ ipAddress }) => ipAddress)).toEqual([
      "10.20.30.40",
      "127.0.0.1",
    ]);
    await expect(
      client.aiLocalTrustPolicy.update({
        where: { id: policies[0]!.id },
        data: { reason: "mutated" },
      }),
    ).rejects.toThrow(/AI history is immutable/u);
    await expect(
      client.auditEvent.count({
        where: { correlationId: { in: [first.correlationId, second.correlationId] } },
      }),
    ).resolves.toBe(2);
  });

  it("rolls back policy registration when its audit append fails", async () => {
    const policyKey = `rollback-policy-${crypto.randomUUID()}`;
    const input = policyInput(policyKey, "Policy registration must be inseparable from audit");
    const failingWriter: AuditWriter = {
      append: vi.fn().mockRejectedValue(new Error("audit unavailable")),
    };

    await expect(
      governance.registerAuthorizedAiLocalTrustPolicy(
        client,
        { userId: administratorId, active: true },
        input,
        failingWriter,
      ),
    ).rejects.toThrow("audit unavailable");
    await expect(client.aiLocalTrustPolicy.count({ where: { policyKey } })).resolves.toBe(0);
  });

  it("binds local providers to an exact policy version and rejects plaintext on-prem HTTP", async () => {
    const policy = await governance.registerAuthorizedAiLocalTrustPolicy(
      client,
      { userId: administratorId, active: true },
      policyInput(`provider-policy-${crypto.randomUUID()}`, "Approve one on-prem provider host", [
        "10.20.30.40",
      ]),
      databaseWriter,
    );
    const base = {
      providerKey: `provider-${crypto.randomUUID()}`,
      adapterKey: "openai-compatible",
      modelKey: "governed-model",
      locality: "local",
      localTrustPolicyId: policy.id,
      localTrustPolicyVersion: policy.version,
      localTrustAllowedIp: "10.20.30.40",
      reason: "Register the approved on-prem model endpoint",
      correlationId: crypto.randomUUID(),
    };

    await expect(
      governance.registerAuthorizedAiProviderConfig(
        client,
        { userId: administratorId, active: true },
        { ...base, endpoint: "http://10.20.30.40:8080/v1/" },
        databaseWriter,
      ),
    ).rejects.toMatchObject({ code: "AI_ADAPTER_URL_INVALID" });
    const registered = await governance.registerAuthorizedAiProviderConfig(
      client,
      { userId: administratorId, active: true },
      { ...base, endpoint: "https://10.20.30.40:8443/v1/" },
      databaseWriter,
    );
    const stored = await client.aiProviderConfig.findUniqueOrThrow({
      where: { id: registered.id },
    });
    expect(stored).toMatchObject({
      localTrustPolicyId: policy.id,
      localTrustPolicyVersion: policy.version,
      localTrustAllowedIp: "10.20.30.40",
      endpointProtocol: "https",
      endpointHost: "10.20.30.40",
    });
  });

  it("enforces endpoint-to-policy consistency in the database", async () => {
    const policy = await governance.registerAuthorizedAiLocalTrustPolicy(
      client,
      { userId: administratorId, active: true },
      policyInput(`constraint-policy-${crypto.randomUUID()}`, "Approve a DB constraint fixture", [
        "10.20.30.40",
      ]),
      databaseWriter,
    );

    await expect(
      client.aiProviderConfig.create({
        data: {
          providerKey: `contradictory-${crypto.randomUUID()}`,
          version: 1,
          adapterKey: "openai-compatible",
          modelKey: "contradictory-model",
          locality: "local",
          endpoint: "https://198.51.100.20/v1/chat/completions",
          endpointProtocol: "https",
          endpointHost: "198.51.100.20",
          localTrustPolicyId: policy.id,
          localTrustPolicyVersion: policy.version,
          localTrustAllowedIp: "10.20.30.40",
          reason: "Attempt a contradictory endpoint and policy binding",
          createdById: administratorId,
        },
      }),
    ).rejects.toThrow();
  });

  it("records exact schema behavior/evaluation evidence and makes identical concurrency idempotent", async () => {
    const routeKey = `governance.schema.${crypto.randomUUID()}`;
    const input = {
      routeKey,
      version: "v1",
      schema: z.object({ summary: z.string() }).strict(),
      reason: "Register the reviewed structured output contract",
      expectedBehavior: "Returns a source-grounded summary and no rating or ranking fields.",
      evaluationEvidenceReferences: ["ai-eval:00000000-0000-4000-8000-000000000301"],
      correlationId: crypto.randomUUID(),
    };
    const secondInput = { ...input, correlationId: crypto.randomUUID() };

    const [first, second] = await Promise.all([
      governance.registerAuthorizedAiOutputSchema(
        client,
        { userId: administratorId, active: true },
        input,
        databaseWriter,
      ),
      governance.registerAuthorizedAiOutputSchema(
        client,
        { userId: administratorId, active: true },
        secondInput,
        databaseWriter,
      ),
    ]);
    expect(first.id).toBe(second.id);
    const artifacts = await client.aiOutputSchemaArtifact.findMany({ where: { routeKey } });
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({
      reason: input.reason,
      expectedBehavior: input.expectedBehavior,
      evaluationEvidenceReferences: input.evaluationEvidenceReferences,
      createdById: administratorId,
    });
    await expect(
      client.auditEvent.count({
        where: { correlationId: { in: [input.correlationId, secondInput.correlationId] } },
      }),
    ).resolves.toBe(2);
  });

  it("rolls back schema registration when audit fails and rejects incomplete evidence metadata", async () => {
    const routeKey = `governance.schema-rollback.${crypto.randomUUID()}`;
    const base = {
      routeKey,
      version: "v1",
      schema: z.object({ summary: z.string() }).strict(),
      reason: "Schema registration must remain auditable",
      expectedBehavior: "Returns a source-grounded summary.",
      evaluationEvidenceReferences: ["ai-eval:00000000-0000-4000-8000-000000000302"],
      correlationId: crypto.randomUUID(),
    };
    const failingWriter: AuditWriter = {
      append: vi.fn().mockRejectedValue(new Error("audit unavailable")),
    };

    await expect(
      governance.registerAuthorizedAiOutputSchema(
        client,
        { userId: administratorId, active: true },
        base,
        failingWriter,
      ),
    ).rejects.toThrow("audit unavailable");
    await expect(client.aiOutputSchemaArtifact.count({ where: { routeKey } })).resolves.toBe(0);
    await expect(
      governance.registerAuthorizedAiOutputSchema(
        client,
        { userId: administratorId, active: true },
        { ...base, evaluationEvidenceReferences: [] },
        databaseWriter,
      ),
    ).rejects.toThrow();
  });
});
