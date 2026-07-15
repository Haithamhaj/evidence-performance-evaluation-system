type DisconnectableUserSyncClient = import("@evaluation/auth").UserSyncClient & {
  readonly $disconnect: () => Promise<void>;
};

export class ManagedAuthDatabaseClient {
  private readonly client: DisconnectableUserSyncClient;
  readonly $transaction: import("@evaluation/auth").UserSyncClient["$transaction"];

  constructor(client: DisconnectableUserSyncClient) {
    this.client = client;
    this.$transaction = client.$transaction.bind(client);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
