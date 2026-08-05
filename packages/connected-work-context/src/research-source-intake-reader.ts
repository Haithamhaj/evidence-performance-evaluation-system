import { AnalysisSourceReferenceSchema, AppError } from "@evaluation/contracts";

import { assertAccessibleConnectedSource } from "./source-authorization.js";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type Actor = Readonly<{ userId: string; active: boolean }>;

export type ResearchConnectedSourceIntake = Readonly<{
  sourceItemId: string;
  provider: import("@evaluation/contracts").ConnectedSourceProvider;
  occurredAt: string;
  title: string;
  summary: string | null;
  sourceUrl: string | null;
  sourceReference: string;
}>;

export class ResearchSourceIntakeReader {
  private readonly database: DatabaseClient;
  private readonly protector: import("./credential-vault.js").PrivateContextProtector;

  constructor(
    database: DatabaseClient,
    protector: import("./credential-vault.js").PrivateContextProtector,
  ) {
    this.database = database;
    this.protector = protector;
  }

  async readPrivateSourceIntake(
    input: Readonly<{
      actor: Actor;
      sourceItemId: string;
    }>,
  ): Promise<ResearchConnectedSourceIntake> {
    const row = await this.database.$transaction(async (transaction) => {
      await assertAccessibleConnectedSource(transaction, input);
      return transaction.connectedSourceItem.findUnique({
        where: { id: input.sourceItemId },
        select: {
          id: true,
          provider: true,
          occurredAt: true,
          titleCiphertext: true,
          titleKeyVersion: true,
          summaryCiphertext: true,
          summaryKeyVersion: true,
          sourceUrl: true,
        },
      });
    });
    if (row === null) throw forbidden();
    const title = await this.protector.open({
      ciphertext: row.titleCiphertext,
      keyVersion: row.titleKeyVersion,
    });
    const summary =
      row.summaryCiphertext === null || row.summaryKeyVersion === null
        ? null
        : await this.protector.open({
            ciphertext: row.summaryCiphertext,
            keyVersion: row.summaryKeyVersion,
          });
    return {
      sourceItemId: row.id,
      provider: row.provider,
      occurredAt: row.occurredAt.toISOString(),
      title,
      summary,
      sourceUrl: row.sourceUrl,
      sourceReference: AnalysisSourceReferenceSchema.parse(`connected-source-item:${row.id}`),
    };
  }
}

function forbidden(): AppError {
  return new AppError("CONNECTED_CONTEXT_FORBIDDEN", "errors.connectedContext.forbidden", 403);
}
