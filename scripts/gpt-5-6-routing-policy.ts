export const GPT_5_6_MODELS = {
  luna: "gpt-5.6-luna",
  terra: "gpt-5.6-terra",
  sol: "gpt-5.6-sol",
} as const;

export type Gpt56Tier = keyof typeof GPT_5_6_MODELS;

const ROUTE_TIERS = {
  "context.project-match.v1": "luna",
  "experience.prepare-next.v1": "luna",
  "experience.project-assistant.v1": "luna",

  "context.summarize.v1": "terra",
  "experience.capture-understand.v1": "terra",
  "experience.task-assistant.v1": "terra",
  "task.draft.v1": "terra",
  "update.structure": "terra",
  "research.source-review.v1": "terra",
  "research.frame.v1": "terra",

  "project.progress-contract.draft": "sol",
  "research.synthesize.v1": "sol",
  "experiment.method-review.v1": "sol",
  "experiment.interpret.v1": "sol",
} as const satisfies Readonly<Record<string, Gpt56Tier>>;

const PROVIDER_ORDERS = {
  luna: [GPT_5_6_MODELS.luna, GPT_5_6_MODELS.terra, GPT_5_6_MODELS.sol],
  terra: [GPT_5_6_MODELS.terra, GPT_5_6_MODELS.sol, GPT_5_6_MODELS.luna],
  sol: [GPT_5_6_MODELS.sol, GPT_5_6_MODELS.terra],
} as const satisfies Readonly<Record<Gpt56Tier, readonly string[]>>;

export function gpt56TierForRoute(routeKey: string): Gpt56Tier | null {
  return ROUTE_TIERS[routeKey as keyof typeof ROUTE_TIERS] ?? null;
}

export function gpt56ProviderOrder(routeKey: string): readonly string[] {
  const tier = gpt56TierForRoute(routeKey);
  return tier === null ? [] : PROVIDER_ORDERS[tier];
}

export function gpt56RoutingPlan() {
  return Object.entries(ROUTE_TIERS).map(([routeKey, tier]) => ({
    routeKey,
    tier,
    models: [...PROVIDER_ORDERS[tier]],
  }));
}
