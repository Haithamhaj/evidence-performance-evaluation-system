import { isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";

interface UnmatchedPageProperties {
  readonly params: Promise<{ readonly locale: string; readonly unmatched: string[] }>;
}

export default async function UnmatchedPage({ params }: UnmatchedPageProperties) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  notFound();
}
