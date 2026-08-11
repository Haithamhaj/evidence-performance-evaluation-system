import type { Catalog, Locale } from "@evaluation/localization";
import { createElement } from "react";
import type { ReactNode } from "react";

import { buildShellModel } from "../../product-ui/shell/shell-model";
import { StableShell } from "../../product-ui/shell/stable-shell";
import { loadShellContext } from "../../server/shell/load-shell-context";

type WorkspaceShellProperties = {
  readonly authAction?: "login" | "logout";
  readonly catalog: Catalog;
  readonly children?: ReactNode;
  readonly locale: Locale;
  readonly localeSwitchHref: string;
};

export async function WorkspaceShell({
  authAction = "logout",
  catalog,
  children,
  locale,
  localeSwitchHref,
}: WorkspaceShellProperties) {
  const { principal } = await loadShellContext();
  return createElement(
    StableShell,
    {
      authAction,
      catalog,
      locale,
      localeSwitchHref,
      model: buildShellModel({ locale, principal }),
    },
    children,
  );
}
