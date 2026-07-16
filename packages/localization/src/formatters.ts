import { localeMetadata } from "./locales.ts";

export const defaultTimeZone = "Asia/Riyadh";

export function formatDateTime(
  value: Date | number | string,
  locale: import("./locales.js").Locale,
  timeZone: string = defaultTimeZone,
): string {
  const instant = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat(localeMetadata[locale].dateLocale, {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
    timeZone,
  }).format(instant);
}

export function formatNumber(value: number, locale: import("./locales.js").Locale): string {
  return new Intl.NumberFormat(localeMetadata[locale].dateLocale).format(value);
}
