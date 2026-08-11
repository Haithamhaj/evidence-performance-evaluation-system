export type ProductInteraction = Readonly<{
  action: "opened" | "dismissed";
  surface: "command-brief";
}>;
