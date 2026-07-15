type DatabaseClient = import("./generated/prisma/client.js").PrismaClient;
type TransactionClient = import("./generated/prisma/client.js").Prisma.TransactionClient;

export async function withTransaction<T>(
  client: DatabaseClient,
  operation: (transaction: TransactionClient) => Promise<T>,
): Promise<T> {
  return client.$transaction(operation);
}
