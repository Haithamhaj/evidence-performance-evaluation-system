import { AppError } from "@evaluation/contracts";
import { EmployeeInsightsV1Schema } from "@evaluation/contracts/insights";
import { z } from "zod";

type ContributionReader = Readonly<{
  confirmedContributionHistory(input: {
    actorId: string;
    limit: number;
  }): Promise<readonly unknown[]>;
}>;
type EvaluationReader = Readonly<{
  readFinalizedHistory(input: {
    actorId: string;
    active: boolean;
    limit: number;
  }): Promise<readonly unknown[]>;
}>;
type ProjectReader = Readonly<{
  projects(actorId: string): Promise<unknown>;
  project(actorId: string, projectId: string): Promise<unknown>;
}>;

const PortfolioSchema = z.array(
  z
    .object({
      id: z.uuid(),
      name: z.string().trim().min(1).max(240),
      status: z.enum(["active", "paused"]),
    })
    .passthrough(),
);

const ProjectViewSchema = z
  .object({
    project: z
      .object({
        id: z.uuid(),
        name: z.string().trim().min(1).max(240),
        status: z.enum(["active", "paused"]),
      })
      .passthrough(),
    progress: z.discriminatedUnion("state", [
      z.object({ state: z.literal("awaiting_contract") }).passthrough(),
      z.object({ state: z.literal("awaiting_information") }).passthrough(),
      z
        .object({
          state: z.literal("accepted"),
          percent: z.number().min(0).max(100),
          updatedAt: z.iso.datetime({ offset: true }),
        })
        .passthrough(),
    ]),
    pulse: z
      .object({
        sourceCoverage: z.enum(["SUFFICIENT", "INSUFFICIENT"]),
        milestoneStates: z.array(
          z
            .object({
              componentId: z.uuid(),
              name: z.string().trim().min(1).max(240),
              kind: z.enum(["milestone", "deliverable", "operational_kpi"]),
              percent: z.number().min(0).max(100).nullable(),
              measuredValue: z.number().optional(),
              observedAt: z.iso.datetime({ offset: true }).optional(),
              state: z.enum(["awaiting_evidence", "not_started", "in_progress", "complete"]),
            })
            .strict(),
        ),
      })
      .passthrough(),
    contract: z
      .object({
        components: z.array(
          z
            .object({
              id: z.uuid(),
              kind: z.enum(["milestone", "deliverable", "operational_kpi"]),
              name: z.string().trim().min(1).max(240),
              target: z.number().nullable(),
              unit: z.string().trim().min(1).max(40).nullable(),
              direction: z.enum(["increase", "decrease", "maintain"]).nullable(),
            })
            .passthrough(),
        ),
      })
      .passthrough()
      .nullable(),
  })
  .passthrough();

export class InsightsQueryService {
  private readonly contributions: ContributionReader;
  private readonly evaluations: EvaluationReader;
  private readonly projects: ProjectReader;
  private readonly now: () => Date;

  constructor(
    contributions: ContributionReader,
    evaluations: EvaluationReader,
    projects: ProjectReader,
    now: () => Date = () => new Date(),
  ) {
    this.contributions = contributions;
    this.evaluations = evaluations;
    this.projects = projects;
    this.now = now;
  }

  async load(actor: Readonly<{ userId: string; active: boolean }>) {
    if (!actor.active) {
      throw new AppError("INSIGHTS_FORBIDDEN", "errors.authorization.inactivePrincipal", 403);
    }
    const [contributions, evaluations, portfolio] = await Promise.all([
      this.contributions.confirmedContributionHistory({ actorId: actor.userId, limit: 50 }),
      this.evaluations.readFinalizedHistory({
        actorId: actor.userId,
        active: actor.active,
        limit: 10,
      }),
      this.projects.projects(actor.userId),
    ]);
    const authorizedProjects = PortfolioSchema.parse(portfolio);
    const projectViews = await Promise.all(
      authorizedProjects.map((project) => this.projects.project(actor.userId, project.id)),
    );
    return EmployeeInsightsV1Schema.parse({
      schemaVersion: "employee-insights.v1",
      generatedAt: this.now().toISOString(),
      personal: {
        confirmedContributions: contributions,
        finalizedEvaluations: evaluations,
      },
      projects: projectViews.map(projectInsight),
    });
  }
}

function projectInsight(raw: unknown) {
  const view = ProjectViewSchema.parse(raw);
  const progress =
    view.progress.state === "accepted"
      ? {
          state: "accepted" as const,
          percent: view.progress.percent,
          updatedAt: view.progress.updatedAt,
        }
      : { state: view.progress.state };
  const kpi = view.contract?.components.find((component) => component.kind === "operational_kpi");
  const measured = view.pulse.milestoneStates.find(
    (component) => component.componentId === kpi?.id && component.measuredValue !== undefined,
  );
  return {
    id: view.project.id,
    name: view.project.name,
    status: view.project.status,
    progress,
    sourceHealth:
      view.progress.state === "awaiting_contract"
        ? ("awaiting_contract" as const)
        : view.pulse.sourceCoverage === "SUFFICIENT"
          ? ("sufficient" as const)
          : ("insufficient" as const),
    milestones: view.pulse.milestoneStates.map((component) => ({
      id: component.componentId,
      name: component.name,
      kind: component.kind,
      state: component.state,
      percent: component.percent,
    })),
    kpi:
      kpi === undefined ||
      kpi.target === null ||
      kpi.unit === null ||
      kpi.direction === null ||
      measured?.measuredValue === undefined ||
      measured.observedAt === undefined
        ? null
        : {
            id: kpi.id,
            name: kpi.name,
            current: measured.measuredValue,
            target: kpi.target,
            unit: kpi.unit,
            direction: kpi.direction,
            observedAt: measured.observedAt,
          },
  };
}
