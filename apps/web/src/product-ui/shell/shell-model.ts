import type { CatalogKey } from "@evaluation/localization";

export type ShellNavigationId =
  | "administration"
  | "evaluation"
  | "health"
  | "help"
  | "manager-operations"
  | "projects"
  | "research"
  | "settings"
  | "today"
  | "work";

export type ShellGlobalEntryId = "capture" | "chat" | "search" | "what-changed";

export type ShellNavigationItem = Readonly<{
  availability: "current" | "next_slice";
  href?: string;
  id: ShellNavigationId;
  labelKey: CatalogKey;
}>;

export type ShellGlobalEntry = Readonly<{
  id: ShellGlobalEntryId;
  labelKey: CatalogKey;
  visible: boolean;
}>;

export type ShellModel = Readonly<{
  globalEntries: readonly ShellGlobalEntry[];
  mobileOverflow: readonly ShellNavigationItem[];
  mobilePrimary: readonly ShellNavigationItem[];
  navigation: readonly ShellNavigationItem[];
}>;

type ShellPrincipal = Readonly<{
  active: boolean;
  roles: readonly string[];
}>;

export function homeHrefForPrincipal(locale: "ar" | "en", principal: ShellPrincipal): string {
  const roles = new Set(principal.active ? principal.roles : []);
  if (roles.has("system_administrator")) return `/${locale}/admin/operations`;
  if (roles.has("manager")) return `/${locale}/manager/operations`;
  return `/${locale}/my-work`;
}

type ContributionContext = Readonly<{
  canContribute: boolean;
  isProjectOwner: boolean;
  isWorkstreamOwner: boolean;
}>;

const noContribution: ContributionContext = {
  canContribute: false,
  isProjectOwner: false,
  isWorkstreamOwner: false,
};

export function buildShellModel({
  contribution = noContribution,
  locale,
  principal,
  workHref,
}: Readonly<{
  contribution?: ContributionContext;
  locale: "ar" | "en";
  principal: ShellPrincipal;
  workHref?: string;
}>): ShellModel {
  const roles = new Set(principal.active ? principal.roles : []);
  const isManager = roles.has("manager");
  const isAdministrator = roles.has("system_administrator");
  const isEmployeeOnly = !isManager && !isAdministrator;
  const navigation: ShellNavigationItem[] = [
    current("today", "shell.nav.today", `/${locale}/my-work`),
    current("work", "shell.nav.work", workHref ?? `/${locale}/my-work`),
    current("projects", "shell.nav.projects", `/${locale}/projects`),
    next("research", "shell.nav.research"),
    current("evaluation", "shell.nav.evaluation", `/${locale}/evaluations/facts`),
  ];

  if (isManager) {
    navigation.push(
      current("manager-operations", "shell.nav.managerOperations", `/${locale}/manager/operations`),
    );
  }
  if (isAdministrator) {
    navigation.push(
      current("administration", "shell.nav.administration", `/${locale}/admin/operations`),
      current("health", "shell.nav.health", `/${locale}/admin/operations`),
    );
  }
  navigation.push(
    current("settings", "shell.nav.settings", `/${locale}/settings/connections`),
    next("help", "shell.nav.help"),
  );

  const mobileIds = new Set<ShellNavigationId>([
    "today",
    "work",
    "projects",
    "research",
    "evaluation",
  ]);
  return {
    navigation,
    mobilePrimary: navigation.filter(({ id }) => mobileIds.has(id)),
    mobileOverflow: navigation.filter(({ id }) => !mobileIds.has(id)),
    globalEntries: [
      {
        id: "capture",
        labelKey: "shell.global.capture",
        visible: isEmployeeOnly || contribution.canContribute,
      },
      { id: "search", labelKey: "shell.global.search", visible: true },
      { id: "chat", labelKey: "shell.global.chat", visible: true },
      { id: "what-changed", labelKey: "shell.global.whatChanged", visible: true },
    ],
  };
}

export function localeSwitchHref({
  currentHref,
  locale,
}: Readonly<{ currentHref: string; locale: "ar" | "en" }>) {
  const url = new URL(currentHref, "https://shell.local");
  const segments = url.pathname.split("/");
  if (["ar", "en"].includes(segments[1] ?? "")) segments[1] = locale;
  else segments.splice(1, 0, locale);
  return `${segments.join("/")}${url.search}${url.hash}`;
}

function current(id: ShellNavigationId, labelKey: CatalogKey, href: string): ShellNavigationItem {
  return { availability: "current", href, id, labelKey };
}

function next(id: ShellNavigationId, labelKey: CatalogKey): ShellNavigationItem {
  return { availability: "next_slice", id, labelKey };
}
