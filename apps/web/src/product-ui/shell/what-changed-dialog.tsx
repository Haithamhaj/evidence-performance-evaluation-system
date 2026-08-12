"use client";

import * as ui from "@evaluation/ui";
import { createElement, useState } from "react";

import type { WhatChangedProjection } from "../../platform/experience-events-contracts";

export function WhatChangedDialog({
  catalog,
  fetchProjection = fetchWhatChanged,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  fetchProjection?: () => Promise<WhatChangedProjection>;
}>) {
  const [projection, setProjection] = useState<WhatChangedProjection | null>(null);
  const [failed, setFailed] = useState(false);
  const load = () => {
    setFailed(false);
    void fetchProjection().then(setProjection, () => setFailed(true));
  };
  return createElement(ui.FocusedDialog, {
    closeLabel: catalog["actions.close"],
    title: catalog["shell.global.whatChanged"],
    trigger: createElement(ui.ActionButton, {
      children: catalog["shell.global.whatChanged"],
      onPress: load,
      variant: "secondary",
    }),
    children: (
      <>
        {failed ? <p role="alert">{catalog["whatChanged.recovery"]}</p> : null}
        {!failed && projection === null ? <p>{catalog["whatChanged.loading"]}</p> : null}
        {projection?.items.length === 0 ? <p>{catalog["whatChanged.empty"]}</p> : null}
        {projection?.items.map((item) => (
          <article key={item.receiptId}>
            <strong>
              {
                catalog[
                  `whatChanged.type.${item.type}` as "whatChanged.type.user.capture_submitted"
                ]
              }
            </strong>
            <p>{catalog["whatChanged.source.work"]}</p>
          </article>
        ))}
      </>
    ),
  });
}

async function fetchWhatChanged(): Promise<WhatChangedProjection> {
  const response = await fetch("/api/daily-work/experience/what-changed", { cache: "no-store" });
  if (!response.ok) throw new Error("what changed unavailable");
  const { WhatChangedProjectionSchema } =
    await import("../../platform/experience-events-contracts");
  return WhatChangedProjectionSchema.parse(await response.json());
}
