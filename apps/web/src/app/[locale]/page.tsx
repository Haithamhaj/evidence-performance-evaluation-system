import { isLocale } from "@evaluation/localization";
import { notFound, redirect } from "next/navigation";

interface HomePageProperties {
  readonly params: Promise<{ readonly locale: string }>;
}

export default async function HomePage({ params }: HomePageProperties) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  redirect(`/${locale}/my-work`);
}
