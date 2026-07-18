"use client";

import { useEffect, useRef, useState } from "react";

import { usePrototype, type WorkView } from "../app/prototype-store";
import { groupMyWork, projectProgress } from "../domain/screen-logic";
import type { LocalizedText, WorkItem } from "../domain/types";
import { copy, type CatalogKey } from "../i18n/catalog";
import { EmptyState } from "./empty-state";
import { Icon } from "./icon";
import { StatusBadge } from "./status-badge";

const text = (value: LocalizedText, locale: "ar" | "en") => value[locale];

function projectFor(item: WorkItem, projects: ReturnType<typeof usePrototype>["projects"]) {
  return projects.find((project) => project.id === item.projectId);
}

function workstreamFor(item: WorkItem, workstreams: ReturnType<typeof usePrototype>["workstreams"]) {
  return workstreams.find((workstream) => workstream.id === item.workstreamId);
}

function dateLabel(value: string | null, locale: "ar" | "en") {
  if (value === null) return locale === "ar" ? "دون موعد" : "No due date";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function ScreenHeader({
  actions,
  screen,
}: {
  readonly actions?: React.ReactNode;
  readonly screen: "myWork" | "inbox" | "projects" | "evidence" | "readiness" | "manager";
}) {
  const { locale } = usePrototype();
  return (
    <div className="pageHeader">
      <div>
        <p className="eyebrow">{copy(locale, "prototype.synthetic")}</p>
        <h1>{copy(locale, `screens.${screen}.title` as CatalogKey)}</h1>
        <p>{copy(locale, `screens.${screen}.subtitle` as CatalogKey)}</p>
      </div>
      {actions ? <div className="headerActions">{actions}</div> : null}
    </div>
  );
}

function ViewSwitcher() {
  const { locale, setWorkView, workView } = usePrototype();
  const views: readonly [WorkView, string, string][] = [
    ["list", "قائمة", "List"],
    ["board", "لوحة", "Board"],
    ["calendar", "تقويم", "Calendar"],
    ["timeline", "خط زمني", "Timeline"],
  ];
  return (
    <div className="viewSwitcher" role="group" aria-label={copy(locale, "labels.view")}>
      {views.map(([view, ar, en]) => (
        <button
          aria-pressed={view === workView}
          className={view === workView ? "isSelected" : ""}
          key={view}
          onClick={() => setWorkView(view)}
          type="button"
        >
          {locale === "ar" ? ar : en}
        </button>
      ))}
    </div>
  );
}

function WorkItemRow({ item }: { readonly item: WorkItem }) {
  const { locale, openWorkItem, projects, workstreams } = usePrototype();
  const project = projectFor(item, projects);
  const workstream = workstreamFor(item, workstreams);
  return (
    <button className="workItemRow" onClick={() => openWorkItem(item.id)} type="button">
      <span className={`priorityRail priority-${item.priority}`} aria-hidden="true" />
      <span className="workItemMain">
        <span className="workItemTitle">{text(item.title, locale)}</span>
        <span className="workItemContext">
          {project ? text(project.name, locale) : ""}
          {workstream ? ` · ${text(workstream.name, locale)}` : ""}
        </span>
      </span>
      <span className="workItemMeta">
        <StatusBadge kind="status" value={item.status} />
        <span>{dateLabel(item.dueDate, locale)}</span>
      </span>
      <Icon name="chevron" />
    </button>
  );
}

function WorkGroup({
  items,
  title,
}: {
  readonly items: readonly WorkItem[];
  readonly title: CatalogKey;
}) {
  const { locale } = usePrototype();
  if (items.length === 0) return null;
  return (
    <section className="workGroup">
      <div className="sectionHeading">
        <h2>{copy(locale, title)}</h2>
        <span>{items.length}</span>
      </div>
      <div className="surface rowList">
        {items.map((item) => (
          <WorkItemRow item={item} key={item.id} />
        ))}
      </div>
    </section>
  );
}

function AlternativeView({ items }: { readonly items: readonly WorkItem[] }) {
  const { locale, openWorkItem, workView } = usePrototype();
  if (workView === "board") {
    const columns = ["planned", "in_progress", "blocked", "in_review", "done"] as const;
    return (
      <div className="board">
        {columns.map((status) => (
          <section className="boardColumn" key={status}>
            <div className="sectionHeading">
              <h2>{copy(locale, `status.${status}` as CatalogKey)}</h2>
              <span>{items.filter((item) => item.status === status).length}</span>
            </div>
            {items
              .filter((item) => item.status === status)
              .map((item) => (
                <button className="workCard" key={item.id} onClick={() => openWorkItem(item.id)} type="button">
                  <strong>{text(item.title, locale)}</strong>
                  <small>{dateLabel(item.dueDate, locale)}</small>
                </button>
              ))}
          </section>
        ))}
      </div>
    );
  }
  if (workView === "calendar") {
    return (
      <div className="calendarGrid surface">
        {["18", "19", "20", "21", "22", "23", "24"].map((dayNumber) => (
          <section key={dayNumber}>
            <strong>{dayNumber}</strong>
            {items
              .filter((item) => item.dueDate?.endsWith(`-${dayNumber}`))
              .map((item) => (
                <button key={item.id} onClick={() => openWorkItem(item.id)} type="button">
                  {text(item.title, locale)}
                </button>
              ))}
          </section>
        ))}
      </div>
    );
  }
  if (workView === "timeline") {
    return (
      <div className="timelineView surface">
        {items.slice(0, 8).map((item, index) => (
          <button key={item.id} onClick={() => openWorkItem(item.id)} type="button">
            <span style={{ inlineSize: `${Math.max(22, 78 - index * 5)}%` }} />
            {text(item.title, locale)}
          </button>
        ))}
      </div>
    );
  }
  return null;
}

export function MyWorkScreen() {
  const { activities, locale, openWorkItem, workItems, workView } = usePrototype();
  const grouped = groupMyWork(workItems, "2026-07-18");
  const allOpen = workItems.filter((item) => item.status !== "done" && item.status !== "cancelled");

  return (
    <>
      <ScreenHeader actions={<ViewSwitcher />} screen="myWork" />
      <div className="homeSummary">
        <div><strong>{allOpen.length}</strong><span>{locale === "ar" ? "عنصر مفتوح" : "open items"}</span></div>
        <div><strong>{grouped.needsAction.length}</strong><span>{copy(locale, "groups.needsAction")}</span></div>
        <div><strong>{grouped.blocked.length + grouped.overdue.length}</strong><span>{locale === "ar" ? "يحتاج انتباهاً" : "need attention"}</span></div>
        <p>{locale === "ar" ? "هذه مؤشرات عمل تشغيلية وليست قياس أداء." : "These are operational work signals, not performance measures."}</p>
      </div>
      {workView === "list" ? (
        <div className="workGroups">
          <WorkGroup items={grouped.needsAction} title="groups.needsAction" />
          <WorkGroup items={grouped.overdue} title="groups.overdue" />
          <WorkGroup items={grouped.today} title="groups.today" />
          <WorkGroup items={grouped.thisWeek} title="groups.thisWeek" />
          <WorkGroup items={grouped.blocked} title="groups.blocked" />
          <WorkGroup items={grouped.reviews} title="groups.reviews" />
          <WorkGroup items={grouped.noDueDate} title="groups.noDueDate" />
        </div>
      ) : (
        <AlternativeView items={allOpen} />
      )}
      <section className="activityPreview">
        <div className="sectionHeading">
          <h2>{copy(locale, "groups.recentActivity")}</h2>
        </div>
        <div className="surface timelineList">
          {activities.slice(0, 3).map((event) => (
            <button
              key={event.id}
              onClick={() => event.workItemId && openWorkItem(event.workItemId)}
              type="button"
            >
              <span className="timelineDot" />
              <span><strong>{text(event.title, locale)}</strong><small>{text(event.detail, locale)}</small></span>
              <time>{new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", { month: "short", day: "numeric" }).format(new Date(event.occurredAt))}</time>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

export function InboxScreen() {
  const {
    inboxItems,
    locale,
    navigate,
    openWorkItem,
    resolveInbox,
    resolvedInboxIds,
  } = usePrototype();
  const [filter, setFilter] = useState<"action" | "information">("action");
  const visible = inboxItems.filter(
    (item) => !resolvedInboxIds.has(item.id) && (filter === "action" ? item.actionable : !item.actionable),
  );
  return (
    <>
      <ScreenHeader
        actions={
          <div className="viewSwitcher">
            <button className={filter === "action" ? "isSelected" : ""} onClick={() => setFilter("action")} type="button">
              {locale === "ar" ? "إجراء مطلوب" : "Action required"}
            </button>
            <button className={filter === "information" ? "isSelected" : ""} onClick={() => setFilter("information")} type="button">
              {locale === "ar" ? "للعلم" : "Information"}
            </button>
          </div>
        }
        screen="inbox"
      />
      {visible.length === 0 ? <EmptyState /> : (
        <div className="surface inboxList">
          {visible.map((item) => (
            <article className="inboxRow" key={item.id}>
              <span className="inboxKind" aria-hidden="true">↳</span>
              <div>
                <strong>{text(item.title, locale)}</strong>
                <p>{text(item.detail, locale)}</p>
                <small>{new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.occurredAt))}</small>
              </div>
              <div className="rowActions">
                {item.workItemId ? <button className="secondaryButton" onClick={() => openWorkItem(item.workItemId!)} type="button">{copy(locale, "actions.open")}</button> : null}
                {item.kind === "github_suggestion" ? <button className="secondaryButton" onClick={() => navigate("evidence")} type="button">{locale === "ar" ? "مراجعة الدليل" : "Review evidence"}</button> : null}
                <button className="primaryButton" onClick={() => resolveInbox(item.id)} type="button">{copy(locale, "actions.resolve")}</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

export function ProjectsScreen() {
  const { locale, navigate, projects, workItems, workstreams } = usePrototype();
  return (
    <>
      <ScreenHeader screen="projects" />
      <div className="projectGrid">
        {projects.map((project) => {
          const progress = projectProgress(workItems, project.id);
          const streamCount = workstreams.filter((stream) => stream.projectId === project.id).length;
          return (
            <button className="surface projectCard" key={project.id} onClick={() => navigate(`projects/${project.id}`)} type="button">
              <div className="cardTopline">
                <StatusBadge kind="health" value={project.health} />
                <span>{project.targetDate}</span>
              </div>
              <h2>{text(project.name, locale)}</h2>
              <p>{text(project.purpose, locale)}</p>
              <dl>
                <div><dt>{locale === "ar" ? "مسارات العمل" : "Workstreams"}</dt><dd>{streamCount}</dd></div>
                <div><dt>{locale === "ar" ? "اكتمال العمل" : "Work completion"}</dt><dd>{progress.percent}%</dd></div>
              </dl>
              <div className="progressTrack" aria-label={`${progress.percent}%`}><span style={{ inlineSize: `${progress.percent}%` }} /></div>
              <span className="nextLine"><b>{copy(locale, "labels.nextAction")}:</b> {text(project.nextAction, locale)}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

export function ProjectDetailScreen({ projectId }: { readonly projectId: string }) {
  const { locale, navigate, projects, workItems, workstreams, workView } = usePrototype();
  const [tab, setTab] = useState("overview");
  const project = projects.find((candidate) => candidate.id === projectId);
  if (!project) return <EmptyState />;
  const projectItems = workItems.filter((item) => item.projectId === projectId);
  const streams = workstreams.filter((stream) => stream.projectId === projectId);
  const tabs = [
    ["overview", "نظرة عامة", "Overview"],
    ["work", "العمل", "Work"],
    ["workstreams", "مسارات العمل", "Workstreams"],
    ["updates", "التحديثات", "Updates"],
    ["activity", "النشاط", "Activity"],
    ["documents", "المستندات", "Documents"],
    ["criteria", "المعايير", "Criteria"],
    ["settings", "الإعدادات", "Settings"],
  ] as const;
  return (
    <>
      <button className="backLink" onClick={() => navigate("projects")} type="button">← {locale === "ar" ? "كل المشاريع" : "All projects"}</button>
      <div className="detailHero">
        <div><StatusBadge kind="health" value={project.health} /><h1>{text(project.name, locale)}</h1><p>{text(project.purpose, locale)}</p></div>
        <dl>
          <div><dt>{copy(locale, "labels.owner")}</dt><dd>{project.owner}</dd></div>
          <div><dt>{copy(locale, "labels.role")}</dt><dd>{text(project.employeeRole, locale)}</dd></div>
          <div><dt>{copy(locale, "labels.targetDate")}</dt><dd>{project.targetDate}</dd></div>
        </dl>
      </div>
      <div className="tabBar" role="tablist">
        {tabs.map(([id, ar, en]) => <button aria-selected={tab === id} className={tab === id ? "isSelected" : ""} key={id} onClick={() => setTab(id)} role="tab" type="button">{locale === "ar" ? ar : en}</button>)}
      </div>
      {tab === "overview" ? (
        <div className="detailGrid">
          <section className="surface detailCard"><h2>{copy(locale, "labels.latestUpdate")}</h2><p>{text(project.latestUpdate, locale)}</p><h3>{copy(locale, "labels.nextAction")}</h3><p>{text(project.nextAction, locale)}</p>{project.blocker ? <div className="riskCallout"><b>{copy(locale, "labels.blocker")}</b><p>{text(project.blocker, locale)}</p></div> : null}</section>
          <section className="surface detailCard"><h2>{locale === "ar" ? "مؤشرات تشغيلية" : "Operational KPIs"}</h2>{project.kpis.map((kpi) => <div className="kpiLine" key={kpi.label.en}><span>{text(kpi.label, locale)}</span><strong>{kpi.value}</strong></div>)}<small>{locale === "ar" ? "لا تستخدم هذه المؤشرات لتقييم أداء الأفراد." : "These indicators are not used to score individual performance."}</small></section>
        </div>
      ) : null}
      {tab === "work" ? <><ViewSwitcher />{workView === "list" ? <div className="surface rowList">{projectItems.map((item) => <WorkItemRow item={item} key={item.id} />)}</div> : <AlternativeView items={projectItems} />}</> : null}
      {tab === "workstreams" ? <div className="projectGrid">{streams.map((stream) => <button className="surface projectCard" key={stream.id} onClick={() => navigate(`projects/${projectId}/workstreams/${stream.id}`)} type="button"><StatusBadge kind="health" value={stream.health} /><h2>{text(stream.name, locale)}</h2><p>{text(stream.purpose, locale)}</p><span>{stream.owner}</span></button>)}</div> : null}
      {!["overview", "work", "workstreams"].includes(tab) ? <section className="surface detailCard"><h2>{locale === "ar" ? tabs.find(([id]) => id === tab)?.[1] : tabs.find(([id]) => id === tab)?.[2]}</h2><p>{locale === "ar" ? "محتوى واقعي للمعاينة ضمن النموذج؛ لا توجد كتابة إلى النظام الإنتاجي." : "Realistic preview content; no production-system writes are made."}</p></section> : null}
    </>
  );
}

export function WorkstreamScreen({ workstreamId }: { readonly workstreamId: string }) {
  const { locale, navigate, projects, workItems, workstreams } = usePrototype();
  const stream = workstreams.find((candidate) => candidate.id === workstreamId);
  if (!stream) return <EmptyState />;
  const project = projects.find((candidate) => candidate.id === stream.projectId);
  const items = workItems.filter((item) => item.workstreamId === stream.id);
  return (
    <>
      <button className="backLink" onClick={() => navigate(`projects/${stream.projectId}`)} type="button">← {project ? text(project.name, locale) : ""}</button>
      <div className="detailHero">
        <div><StatusBadge kind="health" value={stream.health} /><h1>{text(stream.name, locale)}</h1><p>{text(stream.purpose, locale)}</p></div>
        <dl><div><dt>{copy(locale, "labels.owner")}</dt><dd>{stream.owner}</dd></div><div><dt>{locale === "ar" ? "المخرج المستهدف" : "Target output"}</dt><dd>{text(stream.targetOutput, locale)}</dd></div></dl>
      </div>
      <div className="detailGrid">
        <section className="surface detailCard"><h2>{locale === "ar" ? "معايير ديناميكية" : "Dynamic criteria"}</h2>{stream.criteria.map((criterion) => <p className="criterionLine" key={criterion.en}>✓ {text(criterion, locale)}</p>)}</section>
        <section className="surface detailCard"><h2>{locale === "ar" ? "المسؤولية والإسناد" : "Responsibility and attribution"}</h2>{stream.responsibilityHistory.map((entry) => <div className="responsibility" key={entry.startsAt}><strong>{entry.person}</strong><span>{text(entry.role, locale)}</span><small>{entry.startsAt} — {entry.endsAt ?? (locale === "ar" ? "مستمر" : "ongoing")}</small></div>)}</section>
      </div>
      <section className="workGroup"><div className="sectionHeading"><h2>{copy(locale, "labels.openItems")}</h2><span>{items.length}</span></div><div className="surface rowList">{items.map((item) => <WorkItemRow item={item} key={item.id} />)}</div></section>
    </>
  );
}

export function WorkItemPanel() {
  const {
    activities,
    closeWorkItem,
    evidenceSuggestions,
    locale,
    projects,
    selectedWorkItemId,
    workItems,
    workstreams,
  } = usePrototype();
  const closeRef = useRef<HTMLButtonElement>(null);
  const item = workItems.find((candidate) => candidate.id === selectedWorkItemId);

  useEffect(() => {
    if (item) closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeWorkItem();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeWorkItem, item]);

  if (!item) return null;
  const project = projectFor(item, projects);
  const workstream = workstreamFor(item, workstreams);
  const relatedActivity = activities.filter((event) => event.workItemId === item.id);
  const evidence = evidenceSuggestions.filter((entry) => entry.workItemId === item.id);
  return (
    <div className="panelBackdrop" onMouseDown={closeWorkItem}>
      <aside aria-labelledby="work-item-title" aria-modal="true" className="workItemPanel" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <header className="panelHeader">
          <div><span className="monoId">{item.id.toUpperCase()}</span><h2 id="work-item-title">{text(item.title, locale)}</h2></div>
          <button aria-label={copy(locale, "a11y.closePanel")} className="iconButton" onClick={closeWorkItem} ref={closeRef} type="button"><Icon name="close" /></button>
        </header>
        <div className="panelBody">
          <div className="panelBadges"><StatusBadge kind="status" value={item.status} /><StatusBadge kind="priority" value={item.priority} /></div>
          <p>{text(item.description, locale)}</p>
          <dl className="propertyGrid">
            <div><dt>{copy(locale, "labels.project")}</dt><dd>{project ? text(project.name, locale) : "—"}</dd></div>
            <div><dt>{copy(locale, "labels.workstream")}</dt><dd>{workstream ? text(workstream.name, locale) : "—"}</dd></div>
            <div><dt>{copy(locale, "labels.role")}</dt><dd>{text(item.employeeRole, locale)}</dd></div>
            <div><dt>{copy(locale, "labels.owner")}</dt><dd>{item.primaryAssignee}</dd></div>
            <div><dt>{copy(locale, "labels.dueDate")}</dt><dd>{dateLabel(item.dueDate, locale)}</dd></div>
          </dl>
          {item.blockerReason ? <div className="riskCallout"><b>{copy(locale, "labels.blocker")}</b><p>{text(item.blockerReason, locale)}</p></div> : null}
          <section><h3>{copy(locale, "labels.nextAction")}</h3><p>{text(item.nextAction, locale)}</p></section>
          <section><h3>{locale === "ar" ? "معايير القبول" : "Acceptance criteria"}</h3>{item.acceptanceCriteria.map((criterion) => <p className="criterionLine" key={criterion.en}>□ {text(criterion, locale)}</p>)}</section>
          <section><h3>{locale === "ar" ? "الأدلة المرتبطة" : "Linked evidence"}</h3>{evidence.length ? evidence.map((entry) => <div className="evidenceMini" key={entry.id}><span>{entry.sourceLabel}</span><strong>{text(entry.title, locale)}</strong></div>) : <p className="mutedText">{locale === "ar" ? "لا يوجد دليل مؤكد بعد." : "No confirmed evidence yet."}</p>}</section>
          <section><h3>{locale === "ar" ? "سجل النشاط" : "Activity timeline"}</h3>{[...item.history, ...relatedActivity.map((event) => ({ label: event.title, at: event.occurredAt, actor: event.actor }))].map((event) => <div className="historyLine" key={`${event.at}-${event.actor}`}><span className="timelineDot" /><div><strong>{text(event.label, locale)}</strong><small>{event.actor} · {new Date(event.at).toLocaleDateString()}</small></div></div>)}</section>
        </div>
      </aside>
    </div>
  );
}
