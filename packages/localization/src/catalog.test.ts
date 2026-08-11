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

  it("keeps the stable AI-native shell vocabulary in both locales", async () => {
    const requiredKeys = [
      "shell.brand",
      "shell.skipToContent",
      "shell.availableNextSlice",
      "shell.nav.today",
      "shell.nav.work",
      "shell.nav.projects",
      "shell.nav.research",
      "shell.nav.evaluation",
      "shell.nav.managerOperations",
      "shell.nav.administration",
      "shell.nav.health",
      "shell.nav.settings",
      "shell.nav.help",
      "shell.nav.more",
      "shell.global.capture",
      "shell.global.search",
      "shell.global.chat",
      "shell.global.whatChanged",
      "shell.loading",
      "shell.errorTitle",
      "shell.errorBody",
    ] as const;
    const ar = await getCatalog("ar");
    const en = await getCatalog("en");

    for (const key of requiredKeys) {
      expect(Object.hasOwn(ar, key)).toBe(true);
      expect(Object.hasOwn(en, key)).toBe(true);
    }
  });

  it("keeps the complete project workspace vocabulary in both locales", async () => {
    const requiredKeys = [
      "workspace.projects.title",
      "workspace.workstreams.title",
      "workspace.people.title",
      "workspace.document.title",
      "workspace.readiness.title",
      "workspace.criteria.title",
      "workspace.loading",
      "workspace.empty",
      "workspace.errorReference",
      "workspace.status.active",
      "workspace.responsibility.contributor",
      "workspace.criteriaAction.generate",
      "workspace.criteriaAction.owner_review",
      "workspace.criteriaAction.publish",
      "workspace.criteriaAction.respond",
      "workspace.criteriaAction.manager_resolve",
      "workspace.criteriaAction.activate",
    ] as const;
    const ar = await getCatalog("ar");
    const en = await getCatalog("en");

    for (const key of requiredKeys) {
      expect(Object.hasOwn(ar, key)).toBe(true);
      expect(Object.hasOwn(en, key)).toBe(true);
    }
  });

  it("keeps the protected Progress Contract human-review vocabulary in both locales", async () => {
    const requiredKeys = [
      "progressContract.review",
      "progressContract.aiDraftLabel",
      "progressContract.approvedSource",
      "progressContract.sourceVersion",
      "progressContract.applyAsDraft",
      "progressContract.activationRequired",
      "progressContract.submitForApproval",
      "progressContract.activate",
      "progressContract.active",
      "progressContract.confirmation.deterministic",
      "progressContract.confirmation.human_confirmed",
    ] as const;
    const ar = await getCatalog("ar");
    const en = await getCatalog("en");

    for (const key of requiredKeys) {
      expect(Object.hasOwn(ar, key)).toBe(true);
      expect(Object.hasOwn(en, key)).toBe(true);
    }
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

  it("compares supported typed placeholder parameter names", () => {
    expect(() =>
      assertCatalogCompatibility({ count: "{count, number}" }, { count: "{total, number}" }),
    ).toThrowError("LOCALIZATION_CATALOG_PLACEHOLDER_MISMATCH:count");
  });

  it.each([
    ["different typed placeholders", "{value, date}", "{value, number}"],
    ["simple and typed placeholders", "{value}", "{value, date}"],
  ])("rejects matching placeholder names with %s", (_label, arabic, english) => {
    expect(() => assertCatalogCompatibility({ key: arabic }, { key: english })).toThrowError(
      "LOCALIZATION_CATALOG_PLACEHOLDER_MISMATCH:key",
    );
  });

  it.each([
    ["simple", "{value}"],
    ["date", "{value, date}"],
    ["number", "{value, number}"],
    ["time", "{value, time}"],
  ])("accepts matching %s placeholders", (_label, placeholder) => {
    expect(() =>
      assertCatalogCompatibility({ key: placeholder }, { key: placeholder }),
    ).not.toThrow();
  });

  it.each([
    ["unknown typed", "{count, wat}"],
    ["incomplete complex ICU", "{count, plural}"],
    ["unsupported complex ICU", "{count, plural, one {item} other {items}}"],
  ])("rejects %s placeholders", (_label, value) => {
    expect(() => assertCatalogCompatibility({ count: value }, { count: value })).toThrowError(
      "LOCALIZATION_CATALOG_PLACEHOLDER_INVALID:count",
    );
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
