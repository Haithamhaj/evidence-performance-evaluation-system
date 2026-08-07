export function renderHtml(
  projection: import("../projection-registry.js").ReportProjection,
  metadata: Readonly<{ locale: "en" | "ar"; timezone: string; generatedAt: Date }>,
) {
  const direction = metadata.locale === "ar" ? "rtl" : "ltr";
  const timestamp = new Intl.DateTimeFormat(metadata.locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: metadata.timezone,
  }).format(metadata.generatedAt);
  return `<!doctype html><html lang="${metadata.locale}" dir="${direction}"><head><meta charset="utf-8"><title>${escapeHtml(projection.title)}</title></head><body><main><h1>${escapeHtml(projection.title)}</h1><time>${escapeHtml(timestamp)}</time><ul>${projection.lines.map((line) => `<li><bdi>${escapeHtml(line)}</bdi></li>`).join("")}</ul></main></body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
