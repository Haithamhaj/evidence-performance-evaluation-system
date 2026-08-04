export type CheckInState = "not_due" | "required" | "satisfied_by_update" | "exempt_approved_leave";

export type CheckInObligation = Readonly<{
  projectId: string;
  projectName: string;
  workstreamId: string;
  workstreamName: string;
  weekStartsAt: string;
  weekEndsAt: string;
  state: CheckInState;
  capture: Readonly<{
    projectId: string;
    workstreamId: string;
    workItemId: null;
  }> | null;
}>;

export interface CheckInResponsibilityReader {
  listWorkstreamResponsibilities(input: {
    employeeId: string;
    startsAt: string;
    endsAt: string;
  }): Promise<
    readonly Readonly<{
      projectId: string;
      projectName: string;
      workstreamId: string;
      workstreamName: string;
      startsAt: Date;
      endsAt: Date | null;
    }>[]
  >;
}

export interface SubstantiveUpdateReader {
  hasSubstantiveAcceptedUpdate(input: {
    employeeId: string;
    workstreamId: string;
    startsAt: string;
    endsAt: string;
  }): Promise<boolean>;
}

export interface ApprovedLeaveExemptionReader {
  findApprovedLeave(input: {
    employeeId: string;
    startsAt: string;
    endsAt: string;
  }): Promise<{ leaveId: string } | null>;
}

export class CheckInService {
  private readonly responsibilities: CheckInResponsibilityReader;
  private readonly updates: SubstantiveUpdateReader;
  private readonly leaves: ApprovedLeaveExemptionReader;
  private readonly clock: () => Date;
  private readonly timeZone: string;

  constructor(
    responsibilities: CheckInResponsibilityReader,
    updates: SubstantiveUpdateReader,
    leaves: ApprovedLeaveExemptionReader,
    clock: () => Date = () => new Date(),
    timeZone = "Asia/Riyadh",
  ) {
    this.responsibilities = responsibilities;
    this.updates = updates;
    this.leaves = leaves;
    this.clock = clock;
    this.timeZone = timeZone;
  }

  async listForEmployee(input: { employeeId: string }): Promise<readonly CheckInObligation[]> {
    const now = this.clock();
    if (!Number.isFinite(now.getTime())) throw new Error("Check-in clock returned an invalid date");
    const week = localWeek(now, this.timeZone);
    const responsibilities = [
      ...new Map(
        (
          await this.responsibilities.listWorkstreamResponsibilities({
            employeeId: input.employeeId,
            startsAt: week.startsAt.toISOString(),
            endsAt: week.endsAt.toISOString(),
          })
        ).map((responsibility) => [responsibility.workstreamId, responsibility]),
      ).values(),
    ];
    return Promise.all(
      responsibilities.map(async (responsibility) => {
        const substantive = await this.updates.hasSubstantiveAcceptedUpdate({
          employeeId: input.employeeId,
          workstreamId: responsibility.workstreamId,
          startsAt: week.startsAt.toISOString(),
          endsAt: week.endsAt.toISOString(),
        });
        const leave = substantive
          ? null
          : await this.leaves.findApprovedLeave({
              employeeId: input.employeeId,
              startsAt: week.startsAt.toISOString(),
              endsAt: week.endsAt.toISOString(),
            });
        const state: CheckInState = substantive
          ? "satisfied_by_update"
          : leave !== null
            ? "exempt_approved_leave"
            : week.localWeekday >= 4
              ? "required"
              : "not_due";
        return {
          projectId: responsibility.projectId,
          projectName: responsibility.projectName,
          workstreamId: responsibility.workstreamId,
          workstreamName: responsibility.workstreamName,
          weekStartsAt: week.startsAt.toISOString(),
          weekEndsAt: week.endsAt.toISOString(),
          state,
          capture:
            state === "required"
              ? {
                  projectId: responsibility.projectId,
                  workstreamId: responsibility.workstreamId,
                  workItemId: null,
                }
              : null,
        };
      }),
    );
  }
}

function localWeek(now: Date, timeZone: string) {
  const parts = zonedParts(now, timeZone);
  const localMidnightLikeUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  const localWeekday = new Date(localMidnightLikeUtc).getUTCDay();
  const sunday = new Date(localMidnightLikeUtc - localWeekday * 86_400_000);
  const nextSunday = new Date(sunday.getTime() + 7 * 86_400_000);
  return {
    localWeekday,
    startsAt: zonedInstant(sunday, timeZone),
    endsAt: zonedInstant(nextSunday, timeZone),
  };
}

function zonedInstant(localDateLikeUtc: Date, timeZone: string): Date {
  const target = localDateLikeUtc.getTime();
  let guess = target;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = zonedParts(new Date(guess), timeZone);
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour);
    guess -= represented - target;
  }
  return new Date(guess);
}

function zonedParts(value: Date, timeZone: string) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(value)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value: part }) => [type, Number(part)]),
  );
  return {
    year: values.year!,
    month: values.month!,
    day: values.day!,
    hour: values.hour!,
  };
}
