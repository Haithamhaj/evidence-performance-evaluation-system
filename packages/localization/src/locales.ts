export const locales = ["ar", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ar";

export const localeMetadata = {
  ar: { direction: "rtl", languageTag: "ar", dateLocale: "ar-JO" },
  en: { direction: "ltr", languageTag: "en", dateLocale: "en-GB" },
} as const satisfies Record<
  Locale,
  { direction: "rtl" | "ltr"; languageTag: string; dateLocale: string }
>;

export function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale === value);
}
