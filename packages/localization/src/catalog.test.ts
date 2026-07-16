import { describe, expect, it } from "vitest";

import { assertCatalogCompatibility, getCatalog } from "./catalog.js";
import { defaultLocale, localeMetadata } from "./locales.js";

const forbiddenIdentifiedNoticeTerms = [
  "anonymous",
  "confidential",
  "مجهول",
  "مجهولة",
  "سري",
  "سرية",
] as const;

describe("localization catalogs", () => {
  it("keeps Arabic and English catalogs key-identical", async () => {
    const ar = await getCatalog("ar");
    const en = await getCatalog("en");

    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
  });

  it("uses Arabic as the default locale", () => {
    expect(defaultLocale).toBe("ar");
    expect(localeMetadata.ar.direction).toBe("rtl");
    expect(localeMetadata.en.direction).toBe("ltr");
  });

  it("uses the exact approved Identified-mode notice in both locales", async () => {
    const ar = await getCatalog("ar");
    const en = await getCatalog("en");

    expect(en["feedback.identifiedNotice"]).toBe(
      "In this identified pilot, your identity, completion status, ratings, comments, and submission timestamp are visible to the authorized manager.",
    );
    expect(ar["feedback.identifiedNotice"]).toBe(
      "في هذا البرنامج التجريبي محدد الهوية، تظهر هويتك وحالة الإكمال والتقييمات والتعليقات ووقت الإرسال للمدير المخوّل.",
    );
  });

  it("does not promise anonymity or confidentiality in Identified-mode notices", async () => {
    const notices = [
      (await getCatalog("ar"))["feedback.identifiedNotice"],
      (await getCatalog("en"))["feedback.identifiedNotice"],
    ];

    for (const notice of notices) {
      const normalized = notice.toLocaleLowerCase();
      for (const forbiddenTerm of forbiddenIdentifiedNoticeTerms) {
        expect(normalized).not.toContain(forbiddenTerm);
      }
    }
  });

  it("requires identical placeholder parameters for every localized key", () => {
    expect(() =>
      assertCatalogCompatibility({ greeting: "مرحباً {name}" }, { greeting: "Hello {person}" }),
    ).toThrowError("LOCALIZATION_CATALOG_PLACEHOLDER_MISMATCH:greeting");
  });

  it("compares ICU-style top-level parameter names", () => {
    expect(() =>
      assertCatalogCompatibility(
        { count: "{count, plural, one {عنصر} other {# عناصر}}" },
        { count: "{total, plural, one {item} other {# items}}" },
      ),
    ).toThrowError("LOCALIZATION_CATALOG_PLACEHOLDER_MISMATCH:count");
  });

  it.each([
    ["duplicate", "Hello {name} {name}"],
    ["unclosed", "Hello {name"],
    ["malformed", "Hello {not valid}"],
  ])("rejects %s placeholders", (_label, value) => {
    expect(() => assertCatalogCompatibility({ greeting: value }, { greeting: value })).toThrowError(
      "LOCALIZATION_CATALOG_PLACEHOLDER_INVALID:greeting",
    );
  });
});
