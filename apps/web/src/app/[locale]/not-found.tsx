"use client";

import { defaultLocale, getCatalogSync, isLocale } from "@evaluation/localization";
import { useParams } from "next/navigation";

export default function LocalizedNotFound() {
  const params = useParams<{ locale?: string }>();
  const locale =
    params.locale !== undefined && isLocale(params.locale) ? params.locale : defaultLocale;
  const catalog = getCatalogSync(locale);

  return (
    <main role="main">
      <h1 data-message-key="errors.notFound">{catalog["errors.notFound"]}</h1>
    </main>
  );
}
