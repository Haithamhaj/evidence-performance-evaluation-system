import { AppError } from "@evaluation/contracts";

export async function authorizeTimelineProject(
  client: import("@evaluation/database").DatabaseClient,
  actorId: string,
  projectId: string,
  now: Date,
): Promise<void> {
  const project = await client.project.findFirst({
    where: {
      id: projectId,
      OR: [
        {
          members: {
            some: {
              employeeId: actorId,
              startsAt: { lte: now },
              OR: [{ endsAt: null }, { endsAt: { gt: now } }],
            },
          },
        },
        {
          department: {
            authorizationScopes: {
              some: {
                roleAssignments: {
                  some: { userId: actorId, role: "manager" },
                },
              },
            },
          },
        },
      ],
    },
    select: { id: true },
  });
  if (project === null) {
    throw new AppError("SCOPE_MISMATCH", "errors.authorization.scopeMismatch", 403);
  }
}
