import { DevelopmentActionSchema } from "@evaluation/contracts";

export function developmentActionTodayProjection(action: unknown) {
  const value = DevelopmentActionSchema.parse(action);
  return {
    kind: "DEVELOPMENT_ACTION" as const,
    id: value.id,
    title: value.title,
    state: value.state,
    targetDate: value.targetDate,
  };
}
