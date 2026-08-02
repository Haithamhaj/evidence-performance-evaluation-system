import { databaseAuditWriter } from "@evaluation/audit";
import {
  ConnectedWorkConnectionService,
  ConnectedWorkContextQueryService,
  ConnectedWorkSyncService,
  createPrivateContextProtector,
  DevelopmentOnlyMemoryCredentialVault,
  FakeGoogleWorkspaceAdapter,
} from "@evaluation/connected-work-context";
import { AppError } from "@evaluation/contracts";
import { createDatabaseClient } from "@evaluation/database";
import { createProjectService } from "@evaluation/projects";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { ConnectedWorkContextPolicyGuard } from "./connected-work-context-policy.guard.js";
import {
  CONNECTED_WORK_CONNECTION_SERVICE,
  CONNECTED_WORK_RUNTIME_CONFIGURATION,
  ConnectionsController,
  GoogleConnectionFlowService,
} from "./connections.controller.js";
import {
  CONNECTED_WORK_QUERY_SERVICE,
  ContextItemsController,
} from "./context-items.controller.js";

const CONNECTED_WORK_DATABASE = "CONNECTED_WORK_DATABASE";
const CONNECTED_WORK_DATABASE_LIFECYCLE = "CONNECTED_WORK_DATABASE_LIFECYCLE";
const CONNECTED_WORK_CREDENTIAL_VAULT = "CONNECTED_WORK_CREDENTIAL_VAULT";
export const CONNECTED_WORK_PROTECTOR = "CONNECTED_WORK_PROTECTOR";
const CONNECTED_WORK_SOURCE_ADAPTER = "CONNECTED_WORK_SOURCE_ADAPTER";

type Environment = Readonly<Record<string, string | undefined>>;
type CredentialVaultPort = import("@evaluation/connected-work-context").CredentialVault;
type PrivateContextProtectorPort =
  import("@evaluation/connected-work-context").PrivateContextProtector;
type ConnectedSourceAdapterPort =
  import("@evaluation/connected-work-context").ConnectedSourceAdapter;

export function parseConnectedWorkContextRuntimeConfiguration(
  environment: Environment,
): import("./connections.controller.js").GoogleConnectionFlowConfiguration {
  const allowedRedirectUris = (environment.CONNECTED_WORK_CONTEXT_REDIRECT_URIS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (environment.CONNECTED_WORK_CONTEXT_MODE?.trim() === "synthetic") {
    return {
      mode: "synthetic",
      allowedRedirectUris,
      stateTtlMs: 600_000,
    };
  }
  return {
    mode: "live",
    allowedRedirectUris,
    stateTtlMs: 600_000,
    externalConfigurationReady: false,
  };
}

export class ConnectedWorkContextModule {}

Module({
  imports: [AuthModule],
  controllers: [ConnectionsController, ContextItemsController],
  providers: [
    {
      provide: CONNECTED_WORK_RUNTIME_CONFIGURATION,
      useFactory: () => parseConnectedWorkContextRuntimeConfiguration(process.env),
    },
    {
      provide: CONNECTED_WORK_DATABASE,
      useFactory: () => {
        const url = process.env.DATABASE_URL?.trim();
        if (!url) throw new Error("DATABASE_URL must be configured");
        return createDatabaseClient(url);
      },
    },
    {
      provide: CONNECTED_WORK_DATABASE_LIFECYCLE,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) => ({
        onModuleDestroy: () => client.$disconnect(),
      }),
      inject: [CONNECTED_WORK_DATABASE],
    },
    {
      provide: CONNECTED_WORK_CREDENTIAL_VAULT,
      useFactory: (
        configuration: import("./connections.controller.js").GoogleConnectionFlowConfiguration,
      ): import("@evaluation/connected-work-context").CredentialVault =>
        configuration.mode === "synthetic"
          ? new DevelopmentOnlyMemoryCredentialVault({ runtimeMode: "development" })
          : new ExternallyGatedCredentialVault(),
      inject: [CONNECTED_WORK_RUNTIME_CONFIGURATION],
    },
    {
      provide: CONNECTED_WORK_PROTECTOR,
      useFactory: (
        configuration: import("./connections.controller.js").GoogleConnectionFlowConfiguration,
      ): import("@evaluation/connected-work-context").PrivateContextProtector =>
        configuration.mode === "synthetic"
          ? createPrivateContextProtector({ mode: "development" })
          : new ExternallyGatedPrivateContextProtector(),
      inject: [CONNECTED_WORK_RUNTIME_CONFIGURATION],
    },
    {
      provide: CONNECTED_WORK_SOURCE_ADAPTER,
      useFactory: (
        configuration: import("./connections.controller.js").GoogleConnectionFlowConfiguration,
      ): import("@evaluation/connected-work-context").ConnectedSourceAdapter =>
        configuration.mode === "synthetic"
          ? createSyntheticGoogleWorkspaceAdapter()
          : new ExternallyGatedSourceAdapter(),
      inject: [CONNECTED_WORK_RUNTIME_CONFIGURATION],
    },
    {
      provide: ConnectedWorkConnectionService,
      useFactory: (
        client: ReturnType<typeof createDatabaseClient>,
        credentialVault: import("@evaluation/connected-work-context").CredentialVault,
      ) => {
        const projects = createProjectService(client, databaseAuditWriter as never);
        return new ConnectedWorkConnectionService({
          database: client,
          credentialVault,
          auditWriter: databaseAuditWriter as never,
          projectAuthorization: {
            authorizeCurrentMemberInTransaction: async (transaction, employeeId, projectId, at) => {
              await projects.authorizeCurrentMemberInTransaction(transaction, {
                actor: { userId: employeeId, active: true },
                projectId,
                at,
              });
            },
          },
        });
      },
      inject: [CONNECTED_WORK_DATABASE, CONNECTED_WORK_CREDENTIAL_VAULT],
    },
    {
      provide: ConnectedWorkSyncService,
      useFactory: (
        client: ReturnType<typeof createDatabaseClient>,
        credentialVault: import("@evaluation/connected-work-context").CredentialVault,
        protector: import("@evaluation/connected-work-context").PrivateContextProtector,
        adapter: import("@evaluation/connected-work-context").ConnectedSourceAdapter,
      ) =>
        new ConnectedWorkSyncService({
          database: client,
          credentialVault,
          protector,
          adapter,
        }),
      inject: [
        CONNECTED_WORK_DATABASE,
        CONNECTED_WORK_CREDENTIAL_VAULT,
        CONNECTED_WORK_PROTECTOR,
        CONNECTED_WORK_SOURCE_ADAPTER,
      ],
    },
    {
      provide: ConnectedWorkContextQueryService,
      useFactory: (
        client: ReturnType<typeof createDatabaseClient>,
        protector: import("@evaluation/connected-work-context").PrivateContextProtector,
      ) => new ConnectedWorkContextQueryService(client, protector),
      inject: [CONNECTED_WORK_DATABASE, CONNECTED_WORK_PROTECTOR],
    },
    {
      provide: GoogleConnectionFlowService,
      useFactory: (
        configuration: import("./connections.controller.js").GoogleConnectionFlowConfiguration,
        connection: ConnectedWorkConnectionService,
        sync: ConnectedWorkSyncService,
      ) => new GoogleConnectionFlowService({ configuration, connection, sync }),
      inject: [
        CONNECTED_WORK_RUNTIME_CONFIGURATION,
        ConnectedWorkConnectionService,
        ConnectedWorkSyncService,
      ],
    },
    {
      provide: CONNECTED_WORK_CONNECTION_SERVICE,
      useExisting: ConnectedWorkConnectionService,
    },
    {
      provide: CONNECTED_WORK_QUERY_SERVICE,
      useExisting: ConnectedWorkContextQueryService,
    },
    ConnectedWorkContextPolicyGuard,
  ],
  exports: [
    ConnectedWorkConnectionService,
    ConnectedWorkContextQueryService,
    CONNECTED_WORK_PROTECTOR,
  ],
})(ConnectedWorkContextModule);

export function createSyntheticGoogleWorkspaceAdapter(): FakeGoogleWorkspaceAdapter {
  return new FakeGoogleWorkspaceAdapter({
    pageSize: 2,
    fixtures: {
      GOOGLE_GMAIL: [
        {
          providerSourceId: "synthetic-gmail-project-decision",
          occurredAt: "2026-07-20T08:30:00.000Z",
          title: "[Synthetic] Project decision",
          summary: "A deterministic local summary for owner-only review.",
          sourceUrl: "https://mail.google.com/mail/u/0/#inbox/synthetic-gmail-project-decision",
          exclusionKeys: [
            {
              kind: "GMAIL_LABEL",
              providerExclusionId: "synthetic-project-context",
            },
          ],
        },
      ],
      GOOGLE_CALENDAR: [
        {
          providerSourceId: "synthetic-calendar-project-review",
          occurredAt: "2026-07-20T10:00:00.000Z",
          title: "[Synthetic] Project review",
          summary: "A deterministic local calendar summary for owner-only review.",
          sourceUrl:
            "https://calendar.google.com/calendar/event?eid=synthetic-calendar-project-review",
          exclusionKeys: [
            {
              kind: "CALENDAR",
              providerExclusionId: "synthetic-work-calendar",
            },
          ],
        },
      ],
    },
  });
}

class ExternallyGatedCredentialVault implements CredentialVaultPort {
  async put(): Promise<{ credentialRef: string }> {
    return externalConfigurationRequired();
  }

  async use<T>(): Promise<T> {
    return externalConfigurationRequired();
  }

  async revoke(): Promise<void> {
    return externalConfigurationRequired();
  }
}

class ExternallyGatedPrivateContextProtector implements PrivateContextProtectorPort {
  async seal(): Promise<{ ciphertext: string; keyVersion: string }> {
    return externalConfigurationRequired();
  }

  async open(): Promise<string> {
    return externalConfigurationRequired();
  }
}

class ExternallyGatedSourceAdapter implements ConnectedSourceAdapterPort {
  async pull(): Promise<import("@evaluation/connected-work-context").SourceDeltaPage> {
    return externalConfigurationRequired();
  }
}

function externalConfigurationRequired(): never {
  throw new AppError(
    "EXTERNAL_CONFIGURATION_REQUIRED",
    "errors.connectedContext.externalConfigurationRequired",
    503,
  );
}
