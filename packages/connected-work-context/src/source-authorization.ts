import { AppError } from "@evaluation/contracts";

type Actor = Readonly<{ userId: string; active: boolean }>;
type Transaction = import("@evaluation/database").DatabaseTransaction;

export async function assertAccessibleConnectedSource(
  transaction: Transaction,
  command: Readonly<{ actor: Actor; sourceItemId: string }>,
): Promise<void> {
  if (!command.actor.active) throw forbiddenError();
  const rows = await transaction.$queryRaw<
    Array<{
      employeeId: string;
      employeeActive: boolean;
      privacy: "PRIVATE";
      excluded: boolean;
      deletedAt: Date | null;
      disconnectedAt: Date | null;
      contentInaccessibleAt: Date | null;
    }>
  >`
    SELECT
      item."employeeId" AS "employeeId",
      employee."active" AS "employeeActive",
      item."privacy" AS "privacy",
      item."excluded" AS "excluded",
      item."deletedAt" AS "deletedAt",
      account."disconnectedAt" AS "disconnectedAt",
      account."contentInaccessibleAt" AS "contentInaccessibleAt"
    FROM "ConnectedSourceItem" item
    JOIN "ConnectedWorkAccount" account
      ON account.id = item."connectedWorkAccountId"
     AND account."employeeId" = item."employeeId"
    JOIN "User" employee ON employee.id = item."employeeId"
    WHERE item.id = ${command.sourceItemId}::uuid
    FOR SHARE OF item, account, employee
  `;
  const row = rows[0];
  if (
    row === undefined ||
    row.employeeId !== command.actor.userId ||
    !row.employeeActive ||
    row.privacy !== "PRIVATE" ||
    row.excluded ||
    row.deletedAt !== null ||
    row.disconnectedAt !== null ||
    row.contentInaccessibleAt !== null
  ) {
    throw forbiddenError();
  }
}

function forbiddenError(): AppError {
  return new AppError("CONNECTED_CONTEXT_FORBIDDEN", "errors.connectedContext.forbidden", 403);
}
