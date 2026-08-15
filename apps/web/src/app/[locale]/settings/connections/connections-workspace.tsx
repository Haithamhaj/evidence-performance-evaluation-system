/* eslint-disable no-unused-vars */
import type { Catalog, Locale } from "@evaluation/localization";
import { ProductIcon } from "@evaluation/ui";

import { GoogleWorkspaceCard } from "./google-workspace-card";
import styles from "./connections-workspace.module.css";

export function ConnectionsWorkspace({
  catalog,
  githubAvailable,
  locale,
}: Readonly<{ catalog: Catalog; githubAvailable: boolean; locale: Locale }>) {
  return (
    <section className={styles.workspace!} dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
      <header className={styles.header!}>
        <p>{catalog["connections.eyebrow"]}</p>
        <h1>{catalog["connections.title"]}</h1>
        <span>{catalog["connections.description"]}</span>
      </header>
      <div className={styles.grid!}>
        <GoogleWorkspaceCard catalog={catalog} locale={locale} />
        <section
          className={`panel connectionCard ${styles.github!}`}
          aria-labelledby="github-heading"
        >
          <div className={styles.connectionTitle!}>
            <span className={styles.icon!}>
              <ProductIcon name="github" size="large" />
            </span>
            <div>
              <p className="eyebrow">{catalog["connections.github.source"]}</p>
              <h2 id="github-heading">{catalog["connections.github.title"]}</h2>
            </div>
          </div>
          <p>{catalog["connections.github.intro"]}</p>
          <p className={styles.status!} data-available={githubAvailable}>
            {githubAvailable
              ? catalog["connections.github.available"]
              : catalog["connections.github.adminRequired"]}
          </p>
          <dl className={styles.details!}>
            <div>
              <dt>{catalog["connections.github.permissionsTitle"]}</dt>
              <dd>{catalog["connections.github.permissions"]}</dd>
            </div>
            <div>
              <dt>{catalog["connections.github.boundaryTitle"]}</dt>
              <dd>{catalog["connections.github.boundary"]}</dd>
            </div>
          </dl>
          <a className="secondaryAction" href={`/${locale}/projects`}>
            {catalog["connections.github.openProjects"]}
          </a>
        </section>
      </div>
    </section>
  );
}
