import arCatalog from "./catalogs/ar.json" with { type: "json" };
import enCatalog from "./catalogs/en.json" with { type: "json" };

export type CatalogKey = keyof typeof enCatalog;
export type Catalog = Readonly<Record<CatalogKey, string>>;

const placeholderNamePattern = /^[A-Za-z][A-Za-z0-9_.-]*$/u;
const supportedPlaceholderTypes = new Set(["date", "number", "time"]);

function placeholderNames(value: string, key: string) {
  const names = new Set<string>();

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "}") {
      throw new Error(`LOCALIZATION_CATALOG_PLACEHOLDER_INVALID:${key}`);
    }
    if (value[index] !== "{") continue;

    const end = value.indexOf("}", index + 1);
    const nestedStart = value.indexOf("{", index + 1);
    if (end === -1 || (nestedStart !== -1 && nestedStart < end)) {
      throw new Error(`LOCALIZATION_CATALOG_PLACEHOLDER_INVALID:${key}`);
    }

    const parts = value
      .slice(index + 1, end)
      .split(",")
      .map((part) => part.trim());
    const name = parts[0] ?? "";
    const isSimple = parts.length === 1 && placeholderNamePattern.test(name);
    const isSupportedTyped =
      parts.length === 2 &&
      placeholderNamePattern.test(name) &&
      supportedPlaceholderTypes.has(parts[1] ?? "");

    if ((!isSimple && !isSupportedTyped) || names.has(name)) {
      throw new Error(`LOCALIZATION_CATALOG_PLACEHOLDER_INVALID:${key}`);
    }

    names.add(name);
    index = end;
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
