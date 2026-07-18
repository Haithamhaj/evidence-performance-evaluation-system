import { notFound } from "next/navigation";

import { PrototypeApp } from "../../prototype-app";

type PrototypePageProperties = {
  readonly params: Promise<{
    readonly locale: string;
    readonly screen?: readonly string[];
  }>;
};

export default async function PrototypePage({ params }: PrototypePageProperties) {
  const { locale, screen = [] } = await params;
  if (locale !== "ar" && locale !== "en") notFound();

  return <PrototypeApp initialLocale={locale} initialPath={screen.join("/")} />;
}
