import { defaultLocale, getCatalogSync, localeMetadata } from "@evaluation/localization";

import "./globals.css";

export default function GlobalNotFound() {
  const catalog = getCatalogSync(defaultLocale);
  const metadata = localeMetadata[defaultLocale];

  return (
    <html lang={metadata.languageTag} dir={metadata.direction}>
      <body>
        <main role="main">
          <h1 data-message-key="errors.notFound">{catalog["errors.notFound"]}</h1>
        </main>
      </body>
    </html>
  );
}
