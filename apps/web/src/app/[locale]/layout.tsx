import { isLocale, localeMetadata } from "@evaluation/localization";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import "../globals.css";

interface LocaleLayoutProperties {
  readonly children: ReactNode;
  readonly params: Promise<{ readonly locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProperties) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const metadata = localeMetadata[locale];

  return (
    <html lang={metadata.languageTag} dir={metadata.direction}>
      <body>{children}</body>
    </html>
  );
}
