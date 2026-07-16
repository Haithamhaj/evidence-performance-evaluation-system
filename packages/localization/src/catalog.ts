import arCatalog from "./catalogs/ar.json" with { type: "json" };
import enCatalog from "./catalogs/en.json" with { type: "json" };

export type CatalogKey = keyof typeof enCatalog;
export type Catalog = Readonly<Record<CatalogKey, string>>;

const placeholderNamePattern = /^[A-Za-z][A-Za-z0-9_.-]*$/u;
const icuTypePattern = /^[A-Za-z][A-Za-z0-9_-]*$/u;

function placeholderNames(value: string, key: string) {
  const names = new Set<string>();

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "}") {
      throw new Error(`LOCALIZATION_CATALOG_PLACEHOLDER_INVALID:${key}`);
    }
    if (value[index] !== "{") continue;

    let depth = 1;
    let end = index + 1;
    for (; end < value.length && depth > 0; end += 1) {
      if (value[end] === "{") depth += 1;
      if (value[end] === "}") depth -= 1;
    }
    if (depth !== 0) {
      throw new Error(`LOCALIZATION_CATALOG_PLACEHOLDER_INVALID:${key}`);
    }

    const content = value.slice(index + 1, end - 1);
    const [rawName, rawType] = content.split(",", 2);
    const name = rawName?.trim() ?? "";
    const type = rawType?.trim();
    const isSimple = rawType === undefined && placeholderNamePattern.test(name);
    const isIcu =
      rawType !== undefined &&
      placeholderNamePattern.test(name) &&
      type !== undefined &&
      icuTypePattern.test(type);

    if ((!isSimple && !isIcu) || names.has(name)) {
      throw new Error(`LOCALIZATION_CATALOG_PLACEHOLDER_INVALID:${key}`);
    }

    names.add(name);
    index = end - 1;
  }

  return [...names].sort();
}

export function assertCatalogCompatibility(
  arabicCatalog: Readonly<Record<string, string>>,
  englishCatalog: Readonly<Record<string, string>>,
) {
  const arabicKeys = Object.keys(arabicCatalog).sort();
  const englishKeys = Object.keys(englishCatalog).sort();

  if (arabicKeys.length !== englishKeys.length) {
    throw new Error("LOCALIZATION_CATALOG_KEY_MISMATCH");
  }

  for (const [index, englishKey] of englishKeys.entries()) {
    if (arabicKeys[index] !== englishKey) {
      throw new Error("LOCALIZATION_CATALOG_KEY_MISMATCH");
    }

    const arabicPlaceholders = placeholderNames(arabicCatalog[englishKey] ?? "", englishKey);
    const englishPlaceholders = placeholderNames(englishCatalog[englishKey] ?? "", englishKey);
    if (arabicPlaceholders.join("\u0000") !== englishPlaceholders.join("\u0000")) {
      throw new Error(`LOCALIZATION_CATALOG_PLACEHOLDER_MISMATCH:${englishKey}`);
    }
  }
}

assertCatalogCompatibility(arCatalog, enCatalog);

const catalogs: Readonly<Record<import("./locales.js").Locale, Catalog>> = {
  ar: arCatalog,
  en: enCatalog,
};

export function getCatalogSync(locale: import("./locales.js").Locale): Catalog {
  return catalogs[locale];
}

export async function getCatalog(locale: import("./locales.js").Locale): Promise<Catalog> {
  return getCatalogSync(locale);
}
