import { createProtocolReadinessProbes } from "../platform/health.controller.js";

type Environment = Readonly<Record<string, string | undefined>>;
type Fetch = (input: string, init?: Readonly<Record<string, unknown>>) => Promise<{ ok: boolean }>;

export function createOperationsHealthProbes(
  input: Readonly<{
    database: import("@evaluation/database").DatabaseClient;
    storage: import("@evaluation/reporting").ReportObjectStorage;
    environment?: Environment;
    fetch?: Fetch;
    redisProbe?: () => Promise<boolean>;
  }>,
) {
  const environment = input.environment ?? process.env;
  const fetcher = input.fetch ?? (globalThis.fetch as Fetch);
  const readiness = createProtocolReadinessProbes({
    databaseUrl: environment.DATABASE_URL,
    redisUrl: environment.REDIS_URL,
  });
  const redisProbe = input.redisProbe ?? (async () => Boolean(await readiness.redis()));
  return [
    healthy("API"),
    external("WORKER", environment.WORKER_HEALTH_URL, fetcher, "admin.health.verifyWorker"),
    {
      dependency: "DATABASE" as const,
      check: async () => {
        const rows =
          await input.database.$queryRawUnsafe<Array<{ health: number }>>("SELECT 1 AS health");
        return state(rows[0]?.health === 1, "admin.health.configureDatabase");
      },
    },
    {
      dependency: "QUEUE" as const,
      check: async () =>
        environment.REDIS_URL
          ? state(await redisProbe(), "admin.health.configureQueue")
          : state(false, "admin.health.configureQueue"),
    },
    {
      dependency: "OBJECT_STORAGE" as const,
      check: async () =>
        input.storage.probe
          ? state(await input.storage.probe(), "admin.health.configureObjectStorage")
          : state(false, "admin.health.configureObjectStorage"),
    },
    external(
      "OIDC",
      environment.OIDC_ISSUER
        ? `${environment.OIDC_ISSUER.replace(/\/$/u, "")}/.well-known/openid-configuration`
        : undefined,
      fetcher,
      "admin.health.configureOidc",
    ),
    {
      dependency: "AI_ROUTE" as const,
      check: async () =>
        state((await input.database.aiRouteConfig.count()) > 0, "admin.health.configureAiRoute"),
    },
    {
      dependency: "CONNECTOR" as const,
      check: async () =>
        state(
          (await input.database.connectedWorkAccount.count({
            where: { disconnectedAt: null, contentInaccessibleAt: null },
          })) > 0,
          "admin.health.reconnectConnector",
        ),
    },
    external("EMAIL", environment.EMAIL_HEALTH_URL, fetcher, "admin.health.configureEmail"),
    external("BACKUP", environment.BACKUP_HEALTH_URL, fetcher, "admin.health.verifyBackup"),
  ];
}

function healthy(dependency: "API") {
  return { dependency, check: async () => state(true, "admin.health.inspectDependency") };
}

function external(
  dependency: "WORKER" | "OIDC" | "EMAIL" | "BACKUP",
  url: string | undefined,
  fetcher: Fetch,
  nextActionKey: string,
) {
  return {
    dependency,
    check: async () => {
      if (!url) return state(false, nextActionKey);
      try {
        const response = await fetcher(url, { signal: AbortSignal.timeout(1_000) });
        return state(response.ok, nextActionKey);
      } catch {
        return state(false, nextActionKey);
      }
    },
  };
}

function state(healthy: boolean, nextActionKey: string) {
  return healthy
    ? { state: "HEALTHY" as const, nextActionKey: null }
    : { state: "ACTION_REQUIRED" as const, nextActionKey };
}
