import type { Catalog, Locale } from "@evaluation/localization";
import { createElement } from "react";
import type { ReactNode } from "react";

import { buildShellModel } from "../../product-ui/shell/shell-model";
import { StableShell } from "../../product-ui/shell/stable-shell";
import { loadShellContext } from "../../server/shell/load-shell-context";
import { experienceStreamEnabled } from "../../server/experience-stream/experience-stream-flag";
import { workWorkspaceEnabled } from "../../server/work/work-workspace-flag";

type WorkspaceShellProperties = {
  readonly authAction?: "login" | "logout";
  readonly catalog: Catalog;
  readonly children?: ReactNode;
  readonly locale: Locale;
  readonly localeSwitchHref: string;
  readonly principal?: Readonly<{ active: boolean; roles: readonly string[]; userId: string }>;
};

export async function WorkspaceShell({
  authAction = "logout",
  catalog,
  children,
  locale,
  localeSwitchHref,
  principal: providedPrincipal,
}: WorkspaceShellProperties) {
  const principal = providedPrincipal ?? (await loadShellContext()).principal;
  return createElement(
    StableShell,
    {
      authAction,
      catalog,
      locale,
      localeSwitchHref,
      model: buildShellModel({
        locale,
        principal,
        workHref: workWorkspaceEnabled() ? `/${locale}/tasks` : `/${locale}/my-work`,
      }),
      experienceStream: experienceStreamEnabled(),
    },
    children,
  );
}
