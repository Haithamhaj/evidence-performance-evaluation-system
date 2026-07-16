import { describe, expect, it } from "vitest";

import { getCatalog } from "./catalog.js";
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
});
