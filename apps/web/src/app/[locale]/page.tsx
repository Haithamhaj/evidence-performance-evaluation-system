import { getCatalog, isLocale } from "@evaluation/localization";
import { BidiText } from "@evaluation/ui";
import { notFound } from "next/navigation";
import { createElement } from "react";

interface HomePageProperties {
  readonly params: Promise<{ readonly locale: string }>;
}

export default async function HomePage({ params }: HomePageProperties) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const catalog = await getCatalog(locale);
  const alternateLocale = locale === "ar" ? "en" : "ar";

  return (
    <div className="appShell">
      <header className="appHeader">
        <nav className="appNavigation" aria-label={catalog["nav.home"]}>
          <a data-focus-id="home" href={`/${locale}`}>
            {catalog["nav.home"]}
          </a>
          <a data-focus-id="health" href="#health">
            {catalog["nav.health"]}
          </a>
          <a data-focus-id="rubric" href="#rubric">
            {catalog["nav.rubricApproval"]}
          </a>
          <a data-focus-id="locale" href={`/${alternateLocale}`} hrefLang={alternateLocale}>
            {catalog[`locale.switchTo${alternateLocale === "ar" ? "Arabic" : "English"}`]}
          </a>
        </nav>
        <a data-focus-id="login" href="/api/auth/login">
          {catalog["actions.login"]}
        </a>
      </header>

      <main className="appMain" id="main-content">
        <section className="panel">
          <h1>{catalog["shell.title"]}</h1>
          <p>{catalog["shell.subtitle"]}</p>
        </section>

        <section className="notice panel" aria-label={catalog["feedback.identifiedNotice"]}>
          <p>{catalog["feedback.identifiedNotice"]}</p>
        </section>

        <section className="panel" id="health">
          <h2>{catalog["nav.health"]}</h2>
          <p>{catalog["health.healthy"]}</p>
        </section>

        <section className="panel" id="rubric">
          <h2>{catalog["nav.rubricApproval"]}</h2>
          <p>{catalog["rubricApproval.pendingReview"]}</p>
        </section>

        <section className="panel">
          <h2>{catalog["mixed.heading"]}</h2>
          <dl className="technicalGrid">
            <dt>{catalog["mixed.userTextLabel"]}</dt>
            <dd>
              {createElement(BidiText, {
                kind: "auto-isolate",
                children: catalog["mixed.userTextSample"],
              })}
            </dd>
            <dt>{catalog["mixed.codeLabel"]}</dt>
            <dd>
              {createElement(BidiText, {
                kind: "code",
                children: catalog["mixed.codeSample"],
              })}
            </dd>
            <dt>{catalog["mixed.urlLabel"]}</dt>
            <dd>
              {createElement(BidiText, {
                kind: "url",
                children: catalog["mixed.urlSample"],
              })}
            </dd>
            <dt>{catalog["mixed.emailLabel"]}</dt>
            <dd>
              {createElement(BidiText, {
                kind: "email",
                children: catalog["mixed.emailSample"],
              })}
            </dd>
            <dt>{catalog["mixed.modelLabel"]}</dt>
            <dd>
              {createElement(BidiText, {
                kind: "model",
                children: catalog["mixed.modelSample"],
              })}
            </dd>
            <dt>{catalog["mixed.pathLabel"]}</dt>
            <dd>
              {createElement(BidiText, {
                kind: "path",
                children: catalog["mixed.pathSample"],
              })}
            </dd>
            <dt>{catalog["mixed.hashLabel"]}</dt>
            <dd>
              {createElement(BidiText, {
                kind: "hash",
                children: catalog["mixed.hashSample"],
              })}
            </dd>
          </dl>
        </section>
      </main>
    </div>
  );
}
