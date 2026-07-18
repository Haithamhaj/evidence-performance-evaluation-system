type IconProperties = {
  readonly name:
    | "home"
    | "inbox"
    | "projects"
    | "evidence"
    | "readiness"
    | "operations"
    | "plus"
    | "spark"
    | "close"
    | "chevron";
};

const symbols: Record<IconProperties["name"], string> = {
  home: "⌂",
  inbox: "▤",
  projects: "◇",
  evidence: "⌘",
  readiness: "◎",
  operations: "▦",
  plus: "+",
  spark: "✦",
  close: "×",
  chevron: "›",
};

export function Icon({ name }: IconProperties) {
  return (
    <span className="icon" aria-hidden="true">
      {symbols[name]}
    </span>
  );
}
