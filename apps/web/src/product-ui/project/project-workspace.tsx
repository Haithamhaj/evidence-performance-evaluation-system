/* eslint-disable no-unused-vars */
import type { Catalog } from "@evaluation/localization";
import { ProductDisclosure, ProductIcon } from "@evaluation/ui";
import type { CSSProperties } from "react";

import { buildProjectExperienceModel } from "../../features/project-experience/project-experience-model";
import { ProjectAssistant } from "./project-assistant";
import { ProjectOwnershipTransfer } from "./project-ownership-transfer";
import styles from "./project-workspace.module.css";

type Experience = any;

export function ProjectWorkspace({
  catalog,
  experience,
  locale,
}: Readonly<{ catalog: Catalog; experience: Experience; locale: "ar" | "en" }>) {
  if (experience.access === "ended") {
    return (
      <section
        className={styles.accessEnded!}
        data-testid="project-access-ended"
        dir={locale === "ar" ? "rtl" : "ltr"}
      >
        <h1>{catalog["project.experience.accessEnded"]}</h1>
        <p>{catalog["project.experience.accessEndedDetail"]}</p>
        <a href={`/${locale}/projects`}>{catalog["project.experience.backToProjects"]}</a>
      </section>
    );
  }
  const model = buildProjectExperienceModel(experience);
  const copy = buildCopy(catalog);
  return (
    <section
      className={styles.workspace!}
      data-testid="project-workspace"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <main className={styles.main!}>
        <nav className={styles.breadcrumbs!} aria-label={copy.breadcrumbs}>
          <a href={`/${locale}/my-work`}>{copy.home}</a>
          <span>/</span>
          <a href={`/${locale}/projects`}>{copy.projects}</a>
          <span>/</span>
          <span>{model.project.name}</span>
        </nav>
        <header className={styles.projectHeader!}>
          <span className={styles.projectIcon!}>
            <ProductIcon name="folder" size="large" />
          </span>
          <div>
            <h1>{model.project.name}</h1>
            <p>{model.project.description}</p>
            <small>
              {model.document
                ? `${copy.grounded} ${model.document.title} v${model.document.version}`
                : copy.documentMissing}
            </small>
          </div>
          {model.document ? (
            <a href={localizedHref(model.document.href, locale)}>{copy.openDocument}</a>
          ) : null}
        </header>

        <nav className={styles.workspaceNav!} aria-label={copy.workspaceNav}>
          <a aria-current="page" href="#overview">
            {copy.overview}
          </a>
          <a href="#plan">{copy.plan}</a>
          <a href={`/${locale}/tasks?view=my&layout=list&project=${model.project.id}`}>
            {copy.work}
          </a>
          <a href="#progress">{copy.progressNav}</a>
          <a href="#timeline">{copy.timelineNav}</a>
        </nav>

        <section id="overview" className={styles.overviewSummary!} aria-label={copy.atGlance}>
          <h2 className={styles.visuallyHidden!}>{copy.overview}</h2>
          <dl>
            <div>
              <dt>{copy.currentStage}</dt>
              <dd>{model.overview.current?.name ?? copy.notAvailable}</dd>
            </div>
            <div>
              <dt>{copy.nextStage}</dt>
              <dd>{model.overview.next?.name ?? copy.notAvailable}</dd>
            </div>
            <div>
              <dt>{copy.activeBlocker}</dt>
              <dd>
                {model.overview.blocker ? (
                  model.overview.blocker.href ? (
                    <a href={localizedHref(model.overview.blocker.href, locale)}>
                      {model.overview.blocker.title}
                    </a>
                  ) : (
                    model.overview.blocker.title
                  )
                ) : (
                  copy.noActiveBlocker
                )}
              </dd>
            </div>
            <div>
              <dt>{copy.latestChange}</dt>
              <dd>
                {model.overview.latestChange ? (
                  <a href={localizedHref(model.overview.latestChange.href, locale)}>
                    {model.overview.latestChange.title}
                  </a>
                ) : (
                  copy.notAvailable
                )}
              </dd>
            </div>
            <div>
              <dt>{copy.nextAction}</dt>
              <dd>
                {model.overview.nextAction ? (
                  <a href={localizedHref(model.overview.nextAction.href, locale)}>
                    {model.overview.nextAction.label}
                  </a>
                ) : (
                  copy.notAvailable
                )}
              </dd>
            </div>
          </dl>
        </section>
        <section className={styles.ownership!} aria-label={copy.ownership}>
          <div>
            <h2>{copy.ownership}</h2>
            <small>{copy.coordinationOnly}</small>
          </div>
          <dl>
            <div>
              <dt>{copy.currentOwner}</dt>
              <dd>{model.ownership.currentOwner?.displayName ?? copy.notAvailable}</dd>
            </div>
            <div>
              <dt>{copy.yourRole}</dt>
              <dd>{roleLabel(copy, model.ownership.viewerRole)}</dd>
            </div>
            <div>
              <dt>{copy.activeFrom}</dt>
              <dd>
                {model.ownership.viewerWindow
                  ? formatDate(model.ownership.viewerWindow.startsAt, locale)
                  : copy.notAvailable}
              </dd>
            </div>
            {model.ownership.viewerRole === "acting_owner" ? (
              <div>
                <dt>{copy.until}</dt>
                <dd>
                  {model.ownership.viewerWindow?.endsAt
                    ? formatDate(model.ownership.viewerWindow.endsAt, locale)
                    : copy.notAvailable}
                </dd>
              </div>
            ) : null}
          </dl>
          <p>
            <strong>{copy.contributors}</strong>{" "}
            {model.ownership.contributors.length === 0
              ? copy.noContributors
              : model.ownership.contributors.map(({ displayName }) => displayName).join(", ")}
          </p>
          {model.ownership.plannedReturnOwnerName ? (
            <p>
              <strong>{copy.plannedReturn}</strong> {model.ownership.plannedReturnOwnerName}
            </p>
          ) : null}
          {model.ownership.transfer.allowed ? (
            <aside className={styles.transferContext!}>
              <strong>{copy.humanTransfer}</strong>
              <p>{copy.transferDetail}</p>
              <ProjectOwnershipTransfer
                catalog={catalog}
                locale={locale}
                ownership={model.ownership}
                projectId={model.project.id}
              />
            </aside>
          ) : null}
        </section>
        <section id="progress" className={styles.progressPanel!} aria-label={copy.progressCharts}>
          {model.progress.kind === "accepted" && model.progressReview.contract ? (
            <>
              <header className={styles.progressChartHeader!}>
                <div>
                  <h2>{copy.progressCharts}</h2>
                  <p>{copy.progressChartsDetail}</p>
                </div>
                <small>{model.progressReview.latestSnapshot?.source.label}</small>
              </header>
              <div className={styles.progressVisuals!}>
                <div className={styles.progressBlock!}>
                  <div
                    className={styles.progressRing!}
                    role="img"
                    aria-label={copy.confirmedProgress.replace("{value}", model.progress.label)}
                    style={{ "--progress": `${model.progress.value}%` } as CSSProperties}
                  >
                    <strong>{model.progress.label}</strong>
                  </div>
                  <div>
                    <strong>{copy.progress}</strong>
                    <small>{copy.contractBased}</small>
                  </div>
                </div>
                <dl className={styles.progressComparison!}>
                  <div>
                    <dt>{copy.previous}</dt>
                    <dd>
                      {model.progressReview.latestSnapshot?.previousPercent === null ||
                      model.progressReview.latestSnapshot?.previousPercent === undefined
                        ? copy.notAvailable
                        : `${model.progressReview.latestSnapshot.previousPercent}%`}
                    </dd>
                  </div>
                  <div>
                    <dt>{copy.currentMeasure}</dt>
                    <dd>{model.progress.label}</dd>
                  </div>
                </dl>
                <div className={styles.kpi!}>
                  {model.kpi ? (
                    <>
                      <span>{model.kpi.name}</span>
                      <strong>{formatKpi(model.kpi)}</strong>
                      <small>
                        {copy.target}: {formatMetric(model.kpi.target, model.kpi.unit)}
                      </small>
                    </>
                  ) : (
                    <>
                      <strong>{copy.noKpi}</strong>
                      <small>{copy.noKpiDetail}</small>
                    </>
                  )}
                </div>
              </div>
              <div className={styles.milestones!}>
                {model.milestones.slice(0, 3).map((milestone) => (
                  <div
                    data-state={milestone.state}
                    className={styles.milestone!}
                    key={milestone.componentId}
                  >
                    <span>
                      {milestone.state === "complete" ? (
                        <ProductIcon name="check" size="small" />
                      ) : null}
                    </span>
                    <strong>{milestone.name}</strong>
                    <small>{copy[milestone.state]}</small>
                  </div>
                ))}
              </div>
              <div className={styles.progressDataTable!}>
                <table aria-label={copy.progressData}>
                  <caption className={styles.visuallyHidden!}>{copy.progressData}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{copy.measure}</th>
                      <th scope="col">{copy.baseline}</th>
                      <th scope="col">{copy.previous}</th>
                      <th scope="col">{copy.currentMeasure}</th>
                      <th scope="col">{copy.target}</th>
                      <th scope="col">{copy.source}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">{copy.overallProgress}</th>
                      <td>—</td>
                      <td>
                        {model.progressReview.latestSnapshot?.previousPercent === null ||
                        model.progressReview.latestSnapshot?.previousPercent === undefined
                          ? "—"
                          : `${model.progressReview.latestSnapshot.previousPercent}%`}
                      </td>
                      <td>{model.progress.label}</td>
                      <td>—</td>
                      <td>{model.progressReview.latestSnapshot?.source.label ?? "—"}</td>
                    </tr>
                    {model.kpi ? (
                      <tr>
                        <th scope="row">{model.kpi.name}</th>
                        <td>{formatMetric(model.kpi.baseline, model.kpi.unit)}</td>
                        <td>—</td>
                        <td>{formatMetric(model.kpi.current, model.kpi.unit)}</td>
                        <td>{formatMetric(model.kpi.target, model.kpi.unit)}</td>
                        <td>{model.kpi.source.label}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className={styles.progressChartEmpty!}>
              <h2>{copy.progressCharts}</h2>
              <strong>{copy.noProgressChart}</strong>
              <p>{copy.noProgressChartDetail}</p>
            </div>
          )}
        </section>

        <section className={styles.criteriaContract!} aria-label={copy.criteriaContract}>
          <header>
            <div>
              <h2>{copy.criteriaContract}</h2>
              <p>{copy.criteriaContractDetail}</p>
            </div>
            {model.criteriaContract.actionOwner === "employee" ? (
              <a href={`/${locale}/projects/${model.project.id}/settings/progress-contract`}>
                {copy[model.criteriaContract.nextAction]}
              </a>
            ) : (
              <span className={styles.ownerAction!}>{copy.projectOwnerAction}</span>
            )}
          </header>
          <div className={styles.criteriaContractFlow!}>
            <section data-complete={model.criteriaContract.sourceDocumentVersion !== null}>
              <span>1</span>
              <div>
                <small>{copy.contractSource}</small>
                <strong>
                  {model.criteriaContract.sourceDocumentVersion === null
                    ? copy.documentMissing
                    : `${copy.projectDocument} v${model.criteriaContract.sourceDocumentVersion}`}
                </strong>
              </div>
            </section>
            <section
              data-complete={
                model.criteriaContract.proposal?.state === "ready" ||
                model.criteriaContract.proposal?.state === "applied"
              }
            >
              <span>2</span>
              <div>
                <small>{copy.contractProposal}</small>
                <strong>{copy[model.criteriaContract.status]}</strong>
                {model.criteriaContract.proposal ? (
                  <em>
                    {copy.proposedComponents.replace(
                      "{count}",
                      String(model.criteriaContract.proposal.componentCount),
                    )}
                    {" · "}
                    {copy.questionsToResolve.replace(
                      "{count}",
                      String(model.criteriaContract.proposal.ambiguityCount),
                    )}
                  </em>
                ) : null}
              </div>
            </section>
            <section data-complete={model.criteriaContract.status === "active"}>
              <span>3</span>
              <div>
                <small>{copy.humanApproval}</small>
                <strong>
                  {model.criteriaContract.status === "active"
                    ? copy.contractActivated
                    : copy.humanApprovalRequired}
                </strong>
              </div>
            </section>
          </div>
          <p className={styles.criteriaContractGuardrail!}>{copy.criteriaContractGuardrail}</p>
        </section>

        <section className={styles.progressReview!} aria-label={copy.progressReview}>
          <header>
            <div>
              <h2>{copy.progressReview}</h2>
              <p>{copy.officialSourcesOnly}</p>
            </div>
            <a href={`/${locale}/projects/${model.project.id}/settings/progress-contract`}>
              {copy.reviewContract}
            </a>
          </header>
          {model.progressReview.contract ? (
            <div className={styles.progressReviewGrid!}>
              <section>
                <span className={styles.reviewLabel!}>{copy.activeContract}</span>
                <strong>
                  {copy.contractVersion.replace(
                    "{version}",
                    String(model.progressReview.contract.contractVersion),
                  )}
                </strong>
                <small>
                  {copy[model.progressReview.contract.calculationKind]} · {copy.effective}{" "}
                  {formatDate(model.progressReview.contract.effectiveAt, locale)}
                </small>
                <h3>{copy.components}</h3>
                <ul>
                  {model.progressReview.contract.components.map((component) => (
                    <li key={component.componentId}>
                      <span>{component.name}</span>
                      <small>
                        {component.weight === null ? copy.notWeighted : `${component.weight}%`}
                      </small>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <span className={styles.reviewLabel!}>{copy.latestApprovedSnapshot}</span>
                {model.progressReview.latestSnapshot ? (
                  <>
                    <strong>{model.progressReview.latestSnapshot.percent}%</strong>
                    <small>
                      {copy.previous}{" "}
                      {model.progressReview.latestSnapshot.previousPercent === null
                        ? copy.notAvailable
                        : `${model.progressReview.latestSnapshot.previousPercent}%`}
                    </small>
                    <p>{model.progressReview.latestSnapshot.reason}</p>
                    <small>
                      {copy.source}: {model.progressReview.latestSnapshot.source.label}
                    </small>
                  </>
                ) : (
                  <p>{copy.noApprovedSnapshot}</p>
                )}
              </section>
              <section>
                <span className={styles.reviewLabel!}>{copy.pendingChange}</span>
                {model.progressReview.pendingChange ? (
                  <>
                    <strong>{copy[model.progressReview.pendingChange.state]}</strong>
                    <small>
                      {formatDate(model.progressReview.pendingChange.requestedAt, locale)}
                    </small>
                  </>
                ) : (
                  <p>{copy.noPendingChange}</p>
                )}
                <h3>{copy.informationNeeded}</h3>
                {model.progressReview.ambiguities.length === 0 ? (
                  <p>{copy.noAmbiguity}</p>
                ) : (
                  <ul>
                    {model.progressReview.ambiguities.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : (
            <div className={styles.progressReviewEmpty!}>
              <ProductIcon name="help" size="small" />
              <div>
                <strong>{copy.noContract}</strong>
                <p>{copy.noKpiDetail}</p>
              </div>
            </div>
          )}
          <p className={styles.progressGuardrail!}>{copy.doesNotChangeProgress}</p>
        </section>

        <section id="plan" className={styles.plan!}>
          <header>
            <h2>{copy.plan}</h2>
            <p>{model.project.description}</p>
            {model.plan.ownerName ? (
              <p>
                {copy.owner}: <strong>{model.plan.ownerName}</strong>
              </p>
            ) : null}
            <p>
              {copy.planSource}: {model.plan.document?.title ?? copy.documentMissing}
            </p>
          </header>
          <div className={styles.planContent!}>
            <section>
              <h3>{copy.workstreams}</h3>
              {model.plan.workstreams.length === 0 ? (
                <p>{copy.noWorkstreams}</p>
              ) : (
                <ul className={styles.workstreamList!}>
                  {model.plan.workstreams.map((workstream) => (
                    <li key={workstream.id}>
                      <ProductIcon name="folder" size="small" />
                      <a
                        href={`/${locale}/projects/${model.project.id}/workstreams/${workstream.id}`}
                      >
                        {workstream.name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h3>{copy.milestonePlan}</h3>
              {model.plan.milestones.length === 0 ? (
                <p>{copy.notAvailable}</p>
              ) : (
                <ol className={styles.planMilestones!}>
                  {model.plan.milestones.map((milestone) => (
                    <li key={milestone.componentId} data-state={milestone.state}>
                      <span>{milestone.state === "complete" ? "✓" : ""}</span>
                      <strong>{milestone.name}</strong>
                      <small>{copy[milestone.state]}</small>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </section>

        <section className={styles.documentSources!} aria-label={copy.projectDocumentsSources}>
          <header>
            <div>
              <h2>{copy.projectDocumentsSources}</h2>
              <p>{copy.recordedSourcesNote}</p>
            </div>
            {model.document ? (
              <a href={localizedHref(model.document.href, locale)}>{copy.openDocument}</a>
            ) : null}
          </header>
          {model.documentWorkspace ? (
            <div className={styles.documentSourcesGrid!}>
              <dl>
                <div>
                  <dt>{copy.currentVersion}</dt>
                  <dd>v{model.documentWorkspace.currentVersion}</dd>
                </div>
                <div>
                  <dt>{copy.sourceAvailability}</dt>
                  <dd>{copy[model.documentWorkspace.sourceAvailability]}</dd>
                </div>
              </dl>
              <section>
                <h3>{copy.versionHistory}</h3>
                <ol>
                  {model.documentWorkspace.history.map((version) => (
                    <li key={version.version}>
                      <strong>v{version.version}</strong>
                      <span title={version.reason}>{version.reason}</span>
                      <small>
                        {copy.sourceCount.replace("{count}", String(version.sourceCount))} ·{" "}
                        {formatDate(version.createdAt, locale)}
                      </small>
                    </li>
                  ))}
                </ol>
              </section>
              <section>
                <h3>{copy.recordedSources}</h3>
                {model.documentWorkspace.sources.length === 0 ? (
                  <p>{copy.noRecordedSources}</p>
                ) : (
                  <ul>
                    {model.documentWorkspace.sources.map((source, index) => (
                      <li key={`${source.kind}:${source.label}:${index}`}>
                        <ProductIcon
                          name={source.kind === "upload" ? "document" : "link"}
                          size="small"
                        />
                        <div>
                          <strong>{source.label}</strong>
                          <small>{copy[source.kind]}</small>
                        </div>
                        {source.href ? (
                          <a href={source.href} target="_blank" rel="noreferrer">
                            {copy.open}
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : (
            <p>{copy.documentMissing}</p>
          )}
        </section>

        <section className={styles.attention!}>
          <h2>{copy.attention}</h2>
          {model.attention.length === 0 ? (
            <p>{copy.noAttention}</p>
          ) : (
            <ul>
              {model.attention.map((item) => (
                <li key={item.id}>
                  <ProductIcon name="help" size="small" />
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.subtitle}</span>
                  </div>
                  {item.href ? <a href={localizedHref(item.href, locale)}>{copy.open}</a> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.collections!}>
          <h2>{copy.workEvidence}</h2>
          <div className={styles.tabs!}>
            {(["work", "updates", "evidence", "documents"] as const).map((key) => (
              <a href={`#${key}`} key={key}>
                {copy[key]} <span>{model.collections[key].length}</span>
              </a>
            ))}
          </div>
          <div className={styles.collectionGrid!}>
            {(["work", "updates", "evidence", "documents"] as const).map((key) => (
              <section id={key} key={key}>
                <h3>{copy[key]}</h3>
                {model.collections[key].length === 0 ? (
                  <p>{copy.empty}</p>
                ) : (
                  <ul>
                    {model.collections[key].slice(0, 3).map((item) => (
                      <li key={item.id}>
                        <ProductIcon
                          name={
                            key === "work" ? "check" : key === "documents" ? "document" : "sparkles"
                          }
                          size="small"
                        />
                        <div>
                          <strong>{item.title}</strong>
                          <span>{item.subtitle}</span>
                        </div>
                        {item.href ? (
                          <a href={localizedHref(item.href, locale)}>{copy.open}</a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </section>

        <section id="timeline" className={styles.timeline!} aria-label={copy.meaningfulTimeline}>
          <header>
            <h2>{copy.timeline}</h2>
            <p>{copy.meaningfulTimelineDetail}</p>
          </header>
          {model.timeline.length === 0 ? (
            <p>{copy.empty}</p>
          ) : (
            <ol>
              {model.timeline.map((item) => (
                <li key={item.id}>
                  <time dateTime={item.occurredAt}>{formatDate(item.occurredAt, locale)}</time>
                  <span className={styles.timelineMarker!}>
                    <ProductIcon name="check" size="small" />
                  </span>
                  <div>
                    <span className={styles.timelineStatus!}>{item.statusLabel}</span>
                    <strong>{item.title}</strong>
                    {item.detail ? <p>{item.detail}</p> : null}
                    <small>
                      {item.contextLabel ? `${item.contextLabel} · ` : ""}
                      {copy.source}: {item.source.label}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
      <aside className={styles.assistant!} aria-label={copy.assistant}>
        <header>
          <ProductIcon name="sparkles" size="small" />
          <strong>{copy.assistant}</strong>
        </header>
        {model.agentSignals.length > 0 ? (
          <section className={styles.agentSignals!} aria-label={copy.agentSignals}>
            <div>
              <p className={styles.eyebrow!}>{copy.projectAgent}</p>
              <h2>{copy.whatINoticed}</h2>
            </div>
            <ul>
              {model.agentSignals.map((signal) => (
                <li key={signal.id} data-severity={signal.severity}>
                  <span />
                  <div>
                    <strong>{signal.title}</strong>
                    <p>{signal.detail}</p>
                    <small>
                      {copy.source}: {signal.source.label}
                    </small>
                    <a href={localizedHref(signal.action.href, locale)}>{signal.action.label}</a>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {model.preparedActions.length > 0 ? (
          <section className={styles.preparedActions!} aria-label={copy.preparedActions}>
            <div>
              <p className={styles.eyebrow!}>{copy.preparedForYou}</p>
              <h2>{copy.reviewBeforeChange}</h2>
            </div>
            <ul>
              {model.preparedActions.map((prepared) => (
                <li key={prepared.id}>
                  <ProductIcon name="sparkles" size="small" />
                  <div>
                    <strong>{prepared.title}</strong>
                    <p>{prepared.detail}</p>
                    <a href={localizedHref(prepared.action.href, locale)}>
                      {prepared.action.label}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
            <small>{copy.preparedGuardrail}</small>
          </section>
        ) : null}
        <ProjectAssistant catalog={catalog} locale={locale} projectId={model.project.id} />
        {model.smartBrief ? (
          <>
            <p className={styles.eyebrow!}>SMART BRIEF</p>
            <h2>{model.smartBrief.title}</h2>
            <p>{model.smartBrief.body}</p>
            <p className={styles.eyebrow!}>{copy.suggestedAction}</p>
            <p>{model.smartBrief.why}</p>
            <small>
              {copy.source}: {model.smartBrief.source.label}
            </small>
            <a
              className={styles.primaryAction!}
              href={localizedHref(model.smartBrief.action.href, locale)}
            >
              {model.smartBrief.action.label}
            </a>
            <ProductDisclosure title={copy.howCalculated}>
              <p>{model.smartBrief.consequence}</p>
            </ProductDisclosure>
          </>
        ) : (
          <p>{copy.empty}</p>
        )}
      </aside>
    </section>
  );
}

function buildCopy(catalog: Catalog) {
  return {
    breadcrumbs: catalog["project.experience.breadcrumbs"],
    workspaceNav: catalog["project.experience.workspaceNav"],
    overview: catalog["project.experience.overview"],
    plan: catalog["project.experience.plan"],
    progressNav: catalog["project.experience.progressNav"],
    timelineNav: catalog["project.experience.timelineNav"],
    workstreams: catalog["project.experience.workstreams"],
    noWorkstreams: catalog["project.experience.noWorkstreams"],
    owner: catalog["project.experience.owner"],
    ownership: catalog["project.experience.ownership"],
    currentOwner: catalog["project.experience.currentOwner"],
    yourRole: catalog["project.experience.yourRole"],
    ownerRole: catalog["project.experience.ownerRole"],
    contributor: catalog["project.experience.contributorRole"],
    manager: catalog["project.experience.managerRole"],
    acting_owner: catalog["project.experience.actingOwnerRole"],
    coordinationOnly: catalog["project.experience.coordinationOnly"],
    activeFrom: catalog["project.experience.activeFrom"],
    until: catalog["project.experience.until"],
    contributors: catalog["project.experience.contributors"],
    noContributors: catalog["project.experience.noContributors"],
    plannedReturn: catalog["project.experience.plannedReturn"],
    humanTransfer: catalog["project.experience.humanTransfer"],
    transferDetail: catalog["project.experience.transferDetail"],
    reviewContract: catalog["project.experience.reviewContract"],
    home: catalog["project.experience.home"],
    projects: catalog["project.experience.projects"],
    grounded: catalog["project.experience.grounded"],
    documentMissing: catalog["project.experience.documentMissing"],
    openDocument: catalog["project.experience.openDocument"],
    progress: catalog["project.experience.progress"],
    progressCharts: catalog["project.experience.progressCharts"],
    progressChartsDetail: catalog["project.experience.progressChartsDetail"],
    progressData: catalog["project.experience.progressData"],
    noProgressChart: catalog["project.experience.noProgressChart"],
    noProgressChartDetail: catalog["project.experience.noProgressChartDetail"],
    measure: catalog["project.experience.measure"],
    baseline: catalog["project.experience.baseline"],
    currentMeasure: catalog["project.experience.currentMeasure"],
    overallProgress: catalog["project.experience.overallProgress"],
    confirmedProgress: catalog["project.experience.confirmedProgress"],
    contractBased: catalog["project.experience.contractBased"],
    target: catalog["project.experience.target"],
    noKpi: catalog["project.experience.noKpi"],
    noKpiDetail: catalog["project.experience.noKpiDetail"],
    attention: catalog["project.experience.attention"],
    noAttention: catalog["project.experience.noAttention"],
    open: catalog["project.experience.open"],
    workEvidence: catalog["project.experience.workEvidence"],
    work: catalog["project.experience.work"],
    updates: catalog["project.experience.updates"],
    evidence: catalog["project.experience.evidence"],
    documents: catalog["project.experience.documents"],
    empty: catalog["project.experience.empty"],
    timeline: catalog["project.experience.timeline"],
    meaningfulTimeline: catalog["project.experience.meaningfulTimeline"],
    meaningfulTimelineDetail: catalog["project.experience.meaningfulTimelineDetail"],
    atGlance: catalog["project.experience.atGlance"],
    currentStage: catalog["project.experience.currentStage"],
    nextStage: catalog["project.experience.nextStage"],
    activeBlocker: catalog["project.experience.activeBlocker"],
    latestChange: catalog["project.experience.latestChange"],
    nextAction: catalog["project.experience.nextAction"],
    notAvailable: catalog["project.experience.notAvailable"],
    noActiveBlocker: catalog["project.experience.noActiveBlocker"],
    milestonePlan: catalog["project.experience.milestonePlan"],
    planSource: catalog["project.experience.planSource"],
    progressReview: catalog["project.experience.progressReview"],
    officialSourcesOnly: catalog["project.experience.officialSourcesOnly"],
    activeContract: catalog["project.experience.activeContract"],
    contractVersion: catalog["project.experience.contractVersion"],
    weighted: catalog["project.experience.weighted"],
    stage_gate: catalog["project.experience.stageGate"],
    effective: catalog["project.experience.effective"],
    components: catalog["project.experience.components"],
    notWeighted: catalog["project.experience.notWeighted"],
    latestApprovedSnapshot: catalog["project.experience.latestApprovedSnapshot"],
    previous: catalog["project.experience.previous"],
    noApprovedSnapshot: catalog["project.experience.noApprovedSnapshot"],
    pendingChange: catalog["project.experience.pendingChange"],
    pending: catalog["project.experience.pending"],
    failed: catalog["project.experience.failed"],
    noPendingChange: catalog["project.experience.noPendingChange"],
    informationNeeded: catalog["project.experience.informationNeeded"],
    noAmbiguity: catalog["project.experience.noAmbiguity"],
    noContract: catalog["project.experience.noContract"],
    doesNotChangeProgress: catalog["project.experience.doesNotChangeProgress"],
    projectDocumentsSources: catalog["project.experience.projectDocumentsSources"],
    recordedSourcesNote: catalog["project.experience.recordedSourcesNote"],
    currentVersion: catalog["project.experience.currentVersion"],
    sourceAvailability: catalog["project.experience.sourceAvailability"],
    available: catalog["project.experience.available"],
    missing: catalog["project.experience.missing"],
    versionHistory: catalog["project.experience.versionHistory"],
    sourceCount: catalog["project.experience.sourceCount"],
    recordedSources: catalog["project.experience.recordedSources"],
    noRecordedSources: catalog["project.experience.noRecordedSources"],
    upload: catalog["project.experience.uploadSource"],
    github: catalog["project.experience.githubSource"],
    external_link: catalog["project.experience.externalLinkSource"],
    criteriaContract: catalog["project.experience.criteriaContract"],
    criteriaContractDetail: catalog["project.experience.criteriaContractDetail"],
    contractSource: catalog["project.experience.contractSource"],
    projectDocument: catalog["project.experience.projectDocument"],
    contractProposal: catalog["project.experience.contractProposal"],
    proposedComponents: catalog["project.experience.proposedComponents"],
    questionsToResolve: catalog["project.experience.questionsToResolve"],
    humanApproval: catalog["project.experience.humanApproval"],
    contractActivated: catalog["project.experience.contractActivated"],
    humanApprovalRequired: catalog["project.experience.humanApprovalRequired"],
    criteriaContractGuardrail: catalog["project.experience.criteriaContractGuardrail"],
    source_required: catalog["project.experience.sourceRequired"],
    proposal_required: catalog["project.experience.proposalRequired"],
    proposal_pending: catalog["project.experience.proposalPending"],
    review_required: catalog["project.experience.reviewRequired"],
    recovery_required: catalog["project.experience.recoveryRequired"],
    active: catalog["project.experience.contractActive"],
    connect_document: catalog["project.experience.connectDocument"],
    request_proposal: catalog["project.experience.requestProposal"],
    wait_for_proposal: catalog["project.experience.waitForProposal"],
    review_proposal: catalog["project.experience.reviewProposal"],
    recover_proposal: catalog["project.experience.recoverProposal"],
    review_active_contract: catalog["project.experience.reviewActiveContract"],
    projectOwnerAction: catalog["project.experience.projectOwnerAction"],
    agentSignals: catalog["project.experience.agentSignals"],
    projectAgent: catalog["project.experience.projectAgent"],
    whatINoticed: catalog["project.experience.whatINoticed"],
    preparedActions: catalog["project.experience.preparedActions"],
    preparedForYou: catalog["project.experience.preparedForYou"],
    reviewBeforeChange: catalog["project.experience.reviewBeforeChange"],
    preparedGuardrail: catalog["project.experience.preparedGuardrail"],
    assistant: catalog["home.overview.assistant"],
    suggestedAction: catalog["home.overview.suggestedAction"],
    source: catalog["home.overview.source"],
    howCalculated: catalog["home.overview.howCalculated"],
    complete: catalog["home.overview.complete"],
    current: catalog["home.overview.current"],
    next: catalog["home.overview.next"],
    awaiting_evidence: catalog["home.overview.awaitingEvidence"],
    not_started: catalog["home.overview.notStarted"],
  } as const;
}

function roleLabel(
  copy: ReturnType<typeof buildCopy>,
  role: "owner" | "contributor" | "manager" | "acting_owner",
) {
  if (role === "owner") return copy.ownerRole;
  return copy[role];
}
function localizedHref(href: string, locale: "ar" | "en") {
  return href.replace(/^\/(?:ar|en)(?=\/)/u, `/${locale}`);
}
function formatKpi(kpi: NonNullable<Experience["kpi"]>) {
  const unit = kpi.unit.trim();
  return ["flow", "flows", "source", "sources"].includes(unit.toLowerCase())
    ? `${kpi.current}/${kpi.target}`
    : `${kpi.current}${unit === "%" ? unit : ` ${unit}`}`;
}
function formatMetric(value: number, unit: string) {
  return unit.trim() === "%" ? `${value}%` : `${value} ${unit.trim()}`;
}
function formatDate(value: string, locale: "ar" | "en") {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
