"use client";

import { getCatalogSync, isLocale } from "@evaluation/localization";
import { useParams } from "next/navigation";

export default function Loading() {
  const params = useParams<{ locale?: string }>();
  const locale = params.locale !== undefined && isLocale(params.locale) ? params.locale : "ar";
  const catalog = getCatalogSync(locale);

  return (
    <main aria-busy="true" className="routeState" role="status">
      <p>{catalog["shell.loading"]}</p>
    </main>
  );
}
