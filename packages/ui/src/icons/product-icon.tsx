import {
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  FlaskConical,
  Folder,
  GitPullRequest,
  Globe,
  Image,
  Link,
  Mic,
  Code2,
  Paperclip,
  Plus,
  Search,
  Settings,
  Sparkles,
  ShieldCheck,
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
  | "document"
  | "folder"
  | "github"
  | "globe"
  | "help"
  | "image"
  | "link"
  | "microphone"
  | "code"
  | "paperclip"
  | "plus"
  | "research"
  | "search"
  | "settings"
  | "sparkles"
  | "shield";

const icons = {
  briefcase: BriefcaseBusiness,
  calendar: CalendarDays,
  chart: ChartNoAxesCombined,
  check: Check,
  "chevron-down": ChevronDown,
  close: X,
  document: FileText,
  folder: Folder,
  github: GitPullRequest,
  globe: Globe,
  help: CircleHelp,
  image: Image,
  link: Link,
  microphone: Mic,
  code: Code2,
  paperclip: Paperclip,
  plus: Plus,
  research: FlaskConical,
  search: Search,
  settings: Settings,
  sparkles: Sparkles,
  shield: ShieldCheck,
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
