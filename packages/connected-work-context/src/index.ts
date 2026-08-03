export {
  CONNECTED_SOURCE_PROVIDERS,
  ConnectedSourceItemSchema,
  ConnectedSourcePrivacySchema,
  ConnectedSourceProviderSchema,
} from "@evaluation/contracts";
export type { ConnectedSourceItem, ConnectedSourceProvider } from "@evaluation/contracts";
export {
  ConnectedWorkConnectionService,
  type ProjectLinkAuthorization,
} from "./connection-service.js";
export {
  createPrivateContextProtector,
  DevelopmentOnlyDeterministicPrivateContextProtector,
  DevelopmentOnlyMemoryCredentialVault,
  GoogleLocalMemoryCredentialVault,
  GoogleLocalPrivateContextProtector,
  type CredentialVault,
  type OAuthCredential,
  type PrivateContextProtector,
  type ProductionCryptographicKeyProvider,
  type SealedCredentialInput,
} from "./credential-vault.js";
export { FakeGoogleWorkspaceAdapter } from "./fake-google-workspace-adapter.js";
export { CalendarRestAdapter } from "./google/calendar-rest-adapter.js";
export { GmailRestAdapter } from "./google/gmail-rest-adapter.js";
export { GoogleWorkspaceRestAdapter } from "./google/google-workspace-rest-adapter.js";
export {
  GOOGLE_WORKSPACE_READ_SCOPES,
  GoogleOAuthClient,
  type GoogleHttpTransport,
  type GoogleOAuthConfiguration,
} from "./google/google-oauth-client.js";
export { ConnectedWorkContextQueryService } from "./query-service.js";
export type {
  ConnectedSourceAdapter,
  ConnectedSourceExclusionKind,
  NormalizedSourceItemInput,
  PullSourceInput,
  SourceDeltaPage,
  SourceExclusion,
} from "./source-adapter.js";
export { ConnectedWorkSyncService, type SyncResult } from "./sync-service.js";
