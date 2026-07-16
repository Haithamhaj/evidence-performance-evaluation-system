import arCatalog from "./catalogs/ar.json" with { type: "json" };
import enCatalog from "./catalogs/en.json" with { type: "json" };

export type CatalogKey = keyof typeof enCatalog;
export type Catalog = Readonly<Record<CatalogKey, string>>;

function assertCatalogParity() {
  const arabicKeys = Object.keys(arCatalog).sort();
  const englishKeys = Object.keys(enCatalog).sort();

  if (arabicKeys.length !== englishKeys.length) {
    throw new Error("LOCALIZATION_CATALOG_KEY_MISMATCH");
  }

  for (const [index, englishKey] of englishKeys.entries()) {
    if (arabicKeys[index] !== englishKey) {
      throw new Error("LOCALIZATION_CATALOG_KEY_MISMATCH");
    }
  }
}

assertCatalogParity();

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
