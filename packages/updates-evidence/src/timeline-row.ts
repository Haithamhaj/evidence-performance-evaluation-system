export type TimelineRow = Omit<import("@evaluation/contracts").TimelineItem, "sourceProvenance"> &
  Readonly<{ sourceKinds: readonly string[] }>;
