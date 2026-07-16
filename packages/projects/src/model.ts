export interface ProjectDatabase {
  $transaction<T>(
    operation: (transaction: import("@evaluation/database").DatabaseTransaction) => Promise<T>,
    options?: Readonly<{ isolationLevel: "Serializable" }>,
  ): Promise<T>;
}
