import { notFound } from "next/navigation";

type PrototypePageProperties = {
  readonly params: Promise<{
    readonly locale: string;
    readonly screen?: readonly string[];
  }>;
};

export default async function PrototypePage({ params }: PrototypePageProperties) {
  const { locale } = await params;
  if (locale !== "ar" && locale !== "en") notFound();

  return (
    <main>
      <p>بيانات تركيبية — Synthetic data</p>
      <h1>{locale === "ar" ? "عملي" : "My Work"}</h1>
    </main>
  );
}
