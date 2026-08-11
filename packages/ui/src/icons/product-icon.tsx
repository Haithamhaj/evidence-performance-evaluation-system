import {
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  CircleHelp,
  FlaskConical,
  Folder,
  Globe,
  Plus,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { createElement } from "react";

export type ProductIconName =
  | "briefcase"
  | "calendar"
  | "chart"
  | "check"
  | "chevron-down"
  | "close"
  | "folder"
  | "globe"
  | "help"
  | "plus"
  | "research"
  | "search"
  | "settings"
  | "sparkles";

const icons = {
  briefcase: BriefcaseBusiness,
  calendar: CalendarDays,
  chart: ChartNoAxesCombined,
  check: Check,
  "chevron-down": ChevronDown,
  close: X,
  folder: Folder,
  globe: Globe,
  help: CircleHelp,
  plus: Plus,
  research: FlaskConical,
  search: Search,
  settings: Settings,
  sparkles: Sparkles,
} as const satisfies Readonly<Record<ProductIconName, typeof BriefcaseBusiness>>;

export type ProductIconProperties = Readonly<{
  label?: string;
  name: ProductIconName;
  size?: "small" | "medium" | "large";
}>;

const sizes = { small: 16, medium: 20, large: 24 } as const;

export function ProductIcon({ label, name, size = "medium" }: ProductIconProperties) {
  const Icon = icons[name];
  const accessibility =
    label === undefined
      ? ({ "aria-hidden": true } as const)
      : ({ "aria-label": label, role: "img" } as const);
  return createElement(Icon, {
    ...accessibility,
    focusable: "false",
    size: sizes[size],
    strokeWidth: 1.8,
  });
}
