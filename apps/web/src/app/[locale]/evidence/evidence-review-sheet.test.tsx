import { getCatalog } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EvidenceReviewSheetView } from "./evidence-review-sheet.js";

describe("EvidenceReviewSheetView", () => {
  it("renders a visible mobile review sheet with all manual evidence choices", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(EvidenceReviewSheetView, {
        catalog,
        contextLabel: "Pilot evaluation platform · Acceptance flow",
        review: null,
        sourceKind: "file",
      }),
    );
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("Screenshot or file");
    expect(markup).toContain("Pasted code");
    expect(markup).toContain("CLI snapshot");
    expect(markup).toContain("Supported claim");
    expect(markup).toContain("Contribution context");
  });

  it("requires employee review before evidence confirmation", async () => {
    const catalog = await getCatalog("ar");
    const markup = renderToStaticMarkup(
      createElement(EvidenceReviewSheetView, {
        catalog,
        contextLabel: "منصة التقييم · مسار القبول",
        sourceKind: "pasted_text",
        review: {
          supportedClaim: "نجحت سيناريوهات القبول المتفق عليها.",
          contributionContext: "نفذت الاختبارات وراجعت النتيجة.",
          revision: 2,
          sourceKind: "pasted_text",
          sourceProvenance: "employee_text",
          revisionKind: "employee_edit",
          project: { id: crypto.randomUUID(), name: "منصة التقييم" },
          workstream: { id: crypto.randomUUID(), name: "جاهزية API" },
          workItem: { id: crypto.randomUUID(), title: "إغلاق مسار القبول" },
          relatedKpiComponents: [{ id: crypto.randomUUID(), name: "اكتمال القبول" }],
          relatedCriteria: [{ id: crypto.randomUUID(), name: "التسليم الموثوق" }],
          verificationState: "unverified",
        },
      }),
    );
    expect(markup).toContain("تأكيد الدليل");
    expect(markup).toContain("مراجعتك وتأكيدك إلزاميان");
    expect(markup).toContain("منصة التقييم");
    expect(markup).toContain("جاهزية API");
    expect(markup).toContain("إغلاق مسار القبول");
    expect(markup).toContain("اكتمال القبول");
    expect(markup).toContain("التسليم الموثوق");
    expect(markup).toContain("غير متحقق بعد");
    expect(markup).not.toContain("تقييم أداء");
  });

  it("prefills the evidence claim from the employee-reviewed AI update draft", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(EvidenceReviewSheetView, {
        catalog,
        contextLabel: "Pilot evaluation platform · Acceptance flow",
        review: null,
        sourceKind: "cli_snapshot",
        suggestedClaim: "All 12 agreed acceptance scenarios passed.",
        suggestedContributionContext: "Implemented the scenarios and reviewed the results.",
      }),
    );

    expect(markup).toContain("All 12 agreed acceptance scenarios passed.");
    expect(markup).toContain("Implemented the scenarios and reviewed the results.");
  });
});
