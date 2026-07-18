"use client";

import { useMemo, useRef, useState } from "react";

import { usePrototype } from "../app/prototype-store";
import { structureTextUpdate, structureTranscript } from "../domain/mock-ai";
import type { ExecutionMode, LocalizedText, WorkItem } from "../domain/types";
import { copy, type CatalogKey } from "../i18n/catalog";
import { Icon } from "./icon";
import { ScreenHeader } from "./work-screens";
import { StatusBadge } from "./status-badge";

const text = (value: LocalizedText, locale: "ar" | "en") => value[locale];

function Modal({
  children,
  onClose,
  title,
}: {
  readonly children: React.ReactNode;
  readonly onClose: () => void;
  readonly title: string;
}) {
  return (
    <div className="modalBackdrop" onMouseDown={onClose}>
      <section
        aria-labelledby="modal-title"
        aria-modal="true"
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header>
          <h2 id="modal-title">{title}</h2>
          <button aria-label="Close" className="iconButton" onClick={onClose} type="button">
            <Icon name="close" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function QuickAddDialog({ onClose }: { readonly onClose: () => void }) {
  const { addWorkItem, locale, projects, workstreams } = usePrototype();
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [workstreamId, setWorkstreamId] = useState("");
  const [saved, setSaved] = useState(false);

  const save = () => {
    if (title.trim().length === 0 || projectId.length === 0) return;
    const id = `wi-demo-${Date.now()}`;
    const item: WorkItem = {
      id,
      title: { ar: title, en: title },
      description: {
        ar: "عنصر عمل تجريبي أضيف داخل النموذج المعزول.",
        en: "A simulated Work Item added inside the isolated prototype.",
      },
      projectId,
      workstreamId: workstreamId || null,
      employeeRole: { ar: "مساهم", en: "Contributor" },
      primaryAssignee: "هيثم الحاج",
      participants: ["هيثم الحاج"],
      type: "task",
      status: "planned",
      priority: "medium",
      startDate: "2026-07-18",
      dueDate: null,
      requirements: [],
      acceptanceCriteria: [{ ar: "مراجعة بشرية قبل الإغلاق", en: "Human review before closure" }],
      dependencies: [],
      blockerReason: null,
      nextAction: { ar: "تحديد الموعد والخطوة التالية", en: "Set the date and next action" },
      criterionIds: [],
      updateIds: [],
      evidenceIds: [],
      githubLinks: [],
      contributionContext: {
        ar: "لم يحدد سياق المساهمة بعد.",
        en: "Contribution context has not been described yet.",
      },
      history: [{
        actor: "هيثم الحاج",
        at: new Date().toISOString(),
        label: { ar: "أضيف من الإضافة السريعة", en: "Added through Quick Add" },
      }],
    };
    addWorkItem(item);
    setSaved(true);
  };

  return (
    <Modal onClose={onClose} title={locale === "ar" ? "إضافة عنصر عمل سريع" : "Quick Add Work Item"}>
      <div className="modalBody">
        <p className="simulationNote">{locale === "ar" ? "محاكاة محلية فقط — لن تُرسل البيانات إلى النظام الإنتاجي." : "Local simulation only — no data is sent to the production system."}</p>
        <label>{locale === "ar" ? "العنوان" : "Title"}<input autoFocus onChange={(event) => setTitle(event.target.value)} placeholder={locale === "ar" ? "مثال: مراجعة حالات الاختبار" : "Example: Review test cases"} value={title} /></label>
        <label>{copy(locale, "labels.project")}<select onChange={(event) => { setProjectId(event.target.value); setWorkstreamId(""); }} value={projectId}>{projects.map((project) => <option key={project.id} value={project.id}>{text(project.name, locale)}</option>)}</select></label>
        <label>{copy(locale, "labels.workstream")} <small>{locale === "ar" ? "(اختياري)" : "(optional)"}</small><select onChange={(event) => setWorkstreamId(event.target.value)} value={workstreamId}><option value="">{locale === "ar" ? "دون مسار عمل" : "No workstream"}</option>{workstreams.filter((stream) => stream.projectId === projectId).map((stream) => <option key={stream.id} value={stream.id}>{text(stream.name, locale)}</option>)}</select></label>
        {saved ? <div className="successNotice" role="status">{locale === "ar" ? "أضيف إلى My Work داخل هذه الجلسة." : "Added to My Work for this session."}</div> : null}
      </div>
      <footer className="modalFooter"><button className="secondaryButton" onClick={onClose} type="button">{copy(locale, "actions.close")}</button><button className="primaryButton" disabled={!title.trim()} onClick={save} type="button">{copy(locale, "actions.save")}</button></footer>
    </Modal>
  );
}

export function QuickUpdateDialog({ onClose }: { readonly onClose: () => void }) {
  const { addActivity, locale, workItems } = usePrototype();
  const [mode, setMode] = useState<"choose" | "text" | "voice">("choose");
  const [raw, setRaw] = useState("");
  const [workItemId, setWorkItemId] = useState(workItems[0]?.id ?? "");
  const [stage, setStage] = useState<"input" | "review" | "saved">("input");
  const [recording, setRecording] = useState(false);
  const selected = workItems.find((item) => item.id === workItemId);
  const draft = useMemo(() => {
    if (!raw.trim()) return null;
    const context = { workItemId: workItemId || null, criterionIds: selected?.criterionIds ?? [] };
    return mode === "voice" ? structureTranscript(raw, context) : structureTextUpdate(raw, context);
  }, [mode, raw, selected?.criterionIds, workItemId]);

  const simulateVoice = () => {
    setRecording(true);
    window.setTimeout(() => {
      setRaw(locale === "ar"
        ? "أكملت مراجعة 120 عينة، ووجدنا عائقاً في بيانات اللهجة الشامية. الخطوة التالية توثيق الحالات مع سارة."
        : "Completed review of 120 samples. We found a blocker in Levantine data. Next step is to document cases with Sarah.");
      setRecording(false);
    }, 700);
  };

  const confirm = () => {
    if (!draft || !selected) return;
    addActivity({
      id: `act-demo-${Date.now()}`,
      kind: "structured_summary",
      title: { ar: "تحديث منظم مؤكد", en: "Confirmed structured update" },
      detail: { ar: draft.activity, en: draft.activity },
      occurredAt: new Date().toISOString(),
      actor: "هيثم الحاج",
      projectId: selected.projectId,
      workstreamId: selected.workstreamId,
      workItemId: selected.id,
    });
    setStage("saved");
  };

  return (
    <Modal onClose={onClose} title={locale === "ar" ? "تحديث سريع" : "Quick Update"}>
      <div className="modalBody">
        <p className="simulationNote">{locale === "ar" ? "تنظيم حتمي محلي يشبه مساعدة AI — لا يوجد اتصال بنموذج أو مفتاح API." : "Deterministic local structuring that simulates AI assistance — no model or API key is used."}</p>
        {mode === "choose" ? <div className="choiceGrid"><button onClick={() => setMode("text")} type="button"><span>⌨</span><strong>{locale === "ar" ? "تحديث نصي" : "Text update"}</strong><small>{locale === "ar" ? "اكتب ما أنجزته والنتيجة" : "Describe the work and result"}</small></button><button onClick={() => setMode("voice")} type="button"><span>◉</span><strong>{locale === "ar" ? "تحديث صوتي" : "Voice update"}</strong><small>{locale === "ar" ? "تسجيل ومحضر صوتي محاكى" : "Simulated recording and transcript"}</small></button></div> : null}
        {mode !== "choose" && stage === "input" ? <>
          <label>{locale === "ar" ? "عنصر العمل المرتبط" : "Related Work Item"}<select onChange={(event) => setWorkItemId(event.target.value)} value={workItemId}>{workItems.slice(0, 12).map((item) => <option key={item.id} value={item.id}>{text(item.title, locale)}</option>)}</select></label>
          {mode === "voice" ? <div className={recording ? "voiceRecorder isRecording" : "voiceRecorder"}><span className="voiceOrb">●</span><p>{recording ? (locale === "ar" ? "جارٍ الاستماع…" : "Listening…") : (locale === "ar" ? "اضغط لبدء محاكاة التسجيل" : "Press to simulate recording")}</p><button className="secondaryButton" onClick={simulateVoice} type="button">{recording ? "…" : locale === "ar" ? "بدء التسجيل" : "Start recording"}</button></div> : null}
          <label>{mode === "voice" ? (locale === "ar" ? "النص الخام القابل للتصحيح" : "Editable raw transcript") : (locale === "ar" ? "ماذا حدث؟" : "What happened?")}<textarea onChange={(event) => setRaw(event.target.value)} placeholder={locale === "ar" ? "أكملت… وكانت النتيجة… والخطوة التالية…" : "I completed… The result was… Next step is…"} rows={5} value={raw} /></label>
          {draft?.clarificationQuestion ? <div className="clarification"><b>{locale === "ar" ? "سؤال توضيحي" : "Clarification"}</b><p>{locale === "ar" ? "ما النتيجة أو القرار الذي نتج عن هذا النشاط؟" : draft.clarificationQuestion}</p></div> : null}
        </> : null}
        {stage === "review" && draft ? <div className="structuredReview"><h3>{locale === "ar" ? "راجع قبل التأكيد" : "Review before confirming"}</h3><dl><div><dt>{locale === "ar" ? "النشاط" : "Activity"}</dt><dd>{draft.activity || "—"}</dd></div><div><dt>{locale === "ar" ? "النتيجة" : "Result"}</dt><dd>{draft.result || (locale === "ar" ? "غير محددة" : "Not provided")}</dd></div><div><dt>{locale === "ar" ? "العائق" : "Blocker"}</dt><dd>{draft.blocker || "—"}</dd></div><div><dt>{locale === "ar" ? "الخطوة التالية" : "Next step"}</dt><dd>{draft.nextStep || "—"}</dd></div></dl><p>{locale === "ar" ? "أنت تؤكد المحتوى؛ لم يولد النظام أي تقييم أو درجة." : "You confirm the content; the system generated no rating or score."}</p></div> : null}
        {stage === "saved" ? <div className="successNotice" role="status">{locale === "ar" ? "تمت إضافة التحديث إلى سجل النشاط في هذه الجلسة." : "The update was added to the activity timeline for this session."}</div> : null}
      </div>
      <footer className="modalFooter">
        <button className="secondaryButton" onClick={mode === "choose" || stage === "saved" ? onClose : stage === "review" ? () => setStage("input") : () => setMode("choose")} type="button">{stage === "review" ? copy(locale, "actions.back") : copy(locale, "actions.close")}</button>
        {mode !== "choose" && stage === "input" ? <button className="primaryButton" disabled={!raw.trim()} onClick={() => setStage("review")} type="button">{locale === "ar" ? "تنظيم ومراجعة" : "Structure and review"}</button> : null}
        {stage === "review" ? <button className="primaryButton" onClick={confirm} type="button">{copy(locale, "actions.confirm")}</button> : null}
      </footer>
    </Modal>
  );
}

export function EvidenceScreen() {
  const { evidenceSuggestions, locale, projects, updateEvidence, workItems, workstreams } = usePrototype();
  const [state, setState] = useState<"suggested" | "confirmed">("suggested");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [context, setContext] = useState("");
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("manual");
  const selected = evidenceSuggestions.find((item) => item.id === selectedId);
  const visible = evidenceSuggestions.filter((item) => state === "suggested" ? item.state === "suggested" : item.state === "confirmed");

  const confirmEvidence = () => {
    if (!selected || !context.trim()) return;
    updateEvidence({ ...selected, state: "confirmed", context: { ar: context, en: context }, executionMode });
    setSelectedId(null);
    setContext("");
  };
  return (
    <>
      <ScreenHeader actions={<div className="viewSwitcher"><button className={state === "suggested" ? "isSelected" : ""} onClick={() => setState("suggested")} type="button">{locale === "ar" ? "اقتراحات" : "Suggestions"}</button><button className={state === "confirmed" ? "isSelected" : ""} onClick={() => setState("confirmed")} type="button">{locale === "ar" ? "مؤكدة" : "Confirmed"}</button></div>} screen="evidence" />
      <div className="policyBanner"><strong>{locale === "ar" ? "اقتراح فقط" : "Suggestion only"}</strong><span>{locale === "ar" ? "نشاط GitHub لا يصبح دليلاً حتى تراجعه وتصف مساهمتك وسياق التنفيذ." : "GitHub activity does not become evidence until you review it and describe your contribution and execution context."}</span></div>
      <div className="evidenceGrid">
        <div className="surface evidenceList">{visible.map((item) => {
          const project = projects.find((candidate) => candidate.id === item.projectId);
          const stream = workstreams.find((candidate) => candidate.id === item.workstreamId);
          return <button className={selectedId === item.id ? "evidenceRow isSelected" : "evidenceRow"} key={item.id} onClick={() => { setSelectedId(item.id); setContext(item.context?.[locale] ?? ""); }} type="button"><span className="sourceTag">{item.sourceLabel}</span><strong>{text(item.title, locale)}</strong><small>{project ? text(project.name, locale) : ""}{stream ? ` · ${text(stream.name, locale)}` : ""}</small><span className={`evidenceState state-${item.state}`}>{item.state === "confirmed" ? (locale === "ar" ? "مؤكد" : "Confirmed") : (locale === "ar" ? "مقترح" : "Suggested")}</span></button>;
        })}</div>
        <aside className="surface evidenceReview">{selected ? <><span className="sourceTag">{selected.sourceLabel}</span><h2>{text(selected.title, locale)}</h2><p>{locale === "ar" ? "راجع المصدر ثم اختر عنصر العمل وأضف وصفاً دقيقاً لمساهمتك. لا تعتمد حجم التغيير أو عدد الملفات كمقياس أداء." : "Review the source, then link the Work Item and accurately describe your contribution. Change size and file count are not performance measures."}</p><label>{locale === "ar" ? "عنصر العمل" : "Work Item"}<select defaultValue={selected.workItemId ?? ""}><option value="">{locale === "ar" ? "اختر" : "Select"}</option>{workItems.map((item) => <option key={item.id} value={item.id}>{text(item.title, locale)}</option>)}</select></label><label>{locale === "ar" ? "وضع التنفيذ" : "Execution mode"}<select onChange={(event) => setExecutionMode(event.target.value as ExecutionMode)} value={executionMode}>{(["manual", "ai_assisted", "agent_generated", "mixed"] as const).map((mode) => <option key={mode} value={mode}>{copy(locale, `execution.${mode}` as CatalogKey)}</option>)}</select></label><label>{locale === "ar" ? "سياق مساهمتي" : "My contribution context"}<textarea onChange={(event) => setContext(event.target.value)} rows={5} value={context} /></label>{selected.state === "suggested" ? <div className="evidenceActions"><button className="secondaryButton" onClick={() => updateEvidence({ ...selected, state: "rejected" })} type="button">{copy(locale, "actions.reject")}</button><button className="primaryButton" disabled={!context.trim()} onClick={confirmEvidence} type="button">{copy(locale, "actions.confirm")}</button></div> : <div className="successNotice">{locale === "ar" ? "دليل مؤكد ومربوط بالسياق." : "Confirmed evidence with context."}</div>}</> : <div className="emptyReview"><span>⌘</span><p>{locale === "ar" ? "اختر اقتراحاً لمراجعته." : "Select a suggestion to review."}</p></div>}</aside>
      </div>
    </>
  );
}

export function ReadinessScreen() {
  const { evidenceSuggestions, locale, projects, readinessFacts, workstreams } = usePrototype();
  return (
    <>
      <ScreenHeader screen="readiness" />
      <div className="policyBanner neutral"><strong>{locale === "ar" ? "لا توجد درجة مقترحة" : "No suggested rating"}</strong><span>{locale === "ar" ? "هذه معاينة Fact View لفصل الحقائق المدعومة عن تفسير الموظف. القرار النهائي للمدير." : "This Fact View separates source-supported facts from employee interpretation. Final judgment remains with the manager."}</span></div>
      {readinessFacts.map((fact) => {
        const project = projects.find((item) => item.id === fact.projectId);
        const stream = workstreams.find((item) => item.id === fact.workstreamId);
        const evidence = evidenceSuggestions.filter((item) => fact.evidenceIds.includes(item.id));
        return <article className="factView" key={fact.id}><header><div><p className="eyebrow">{text(fact.period, locale)}</p><h2>{project ? text(project.name, locale) : ""}</h2><span>{stream ? text(stream.name, locale) : ""}</span></div><span className={`verification state-${fact.verificationState}`}>{copy(locale, `verification.${fact.verificationState}` as CatalogKey)}</span></header><div className="factColumns"><section><h3>{locale === "ar" ? "حقائق مدعومة بالمصدر" : "Source-supported facts"}</h3>{fact.supportedFacts.map((value) => <p className="factLine" key={value.en}>✓ {text(value, locale)}</p>)}<h4>{locale === "ar" ? "أجزاء غير محسومة" : "Unclear parts"}</h4>{fact.unclearParts.map((value) => <p className="unclearLine" key={value.en}>? {text(value, locale)}</p>)}</section><section className="interpretation"><h3>{locale === "ar" ? "تفسير الموظف" : "Employee interpretation"}</h3><p>{text(fact.employeeClaim, locale)}</p><h4>{locale === "ar" ? "النتيجة المسجلة" : "Recorded result"}</h4><p>{text(fact.result, locale)}</p><small>{locale === "ar" ? "يعرض كتفسير منفصل، وليس حقيقة مصدرية." : "Shown separately as interpretation, not a source fact."}</small></section></div><footer><span><b>{locale === "ar" ? "فترة المسؤولية:" : "Responsibility window:"}</b> {text(fact.responsibilityWindow, locale)}</span>{evidence.map((item) => <span className="sourceTag" key={item.id}>{item.sourceLabel}</span>)}</footer></article>;
      })}
    </>
  );
}

export function ManagerScreen() {
  const { inboxItems, locale, projects, workItems, workstreams } = usePrototype();
  const blocked = workItems.filter((item) => item.status === "blocked");
  return (
    <>
      <ScreenHeader screen="manager" />
      <div className="managerSummary">
        <div className="surface metricCard"><span>{locale === "ar" ? "إجراءات تحتاج متابعة" : "Actions needing follow-up"}</span><strong>{inboxItems.filter((item) => item.actionable).length}</strong><small>{locale === "ar" ? "عدد تشغيلي، ليس قياس أداء" : "Operational count, not performance"}</small></div>
        <div className="surface metricCard"><span>{locale === "ar" ? "مشاريع تحتاج انتباهاً" : "Projects needing attention"}</span><strong>{projects.filter((project) => project.health !== "on_track").length}</strong><small>{locale === "ar" ? "صحة المشروع فقط" : "Project health only"}</small></div>
        <div className="surface metricCard"><span>{locale === "ar" ? "عوائق مفتوحة" : "Open blockers"}</span><strong>{blocked.length}</strong><small>{locale === "ar" ? "دون ترتيب موظفين" : "No employee ranking"}</small></div>
      </div>
      <div className="detailGrid">
        <section className="surface detailCard"><div className="sectionHeading"><h2>{locale === "ar" ? "صحة المشاريع ومسارات العمل" : "Project and Workstream health"}</h2></div>{projects.map((project) => <div className="managerProject" key={project.id}><div><strong>{text(project.name, locale)}</strong><small>{text(project.nextAction, locale)}</small></div><StatusBadge kind="health" value={project.health} /></div>)}{workstreams.filter((stream) => stream.health === "at_risk").map((stream) => <div className="managerProject nested" key={stream.id}><div><strong>{text(stream.name, locale)}</strong><small>{stream.owner}</small></div><StatusBadge kind="health" value={stream.health} /></div>)}</section>
        <section className="surface detailCard"><div className="sectionHeading"><h2>{locale === "ar" ? "جاهزية التوثيق — عرض خشن" : "Documentation readiness — coarse view"}</h2></div><div className="coarseReadiness"><div><span className="readinessDot ready" /><strong>{locale === "ar" ? "سجل كافٍ للمراجعة" : "Record ready for review"}</strong><small>{locale === "ar" ? "هيثم الحاج · لا تظهر نسبة أو ترتيب" : "Haitham Alhaj · no percentage or rank shown"}</small></div><div><span className="readinessDot attention" /><strong>{locale === "ar" ? "يحتاج متابعة توثيقية" : "Needs documentation follow-up"}</strong><small>{locale === "ar" ? "نورة الشمري · لا تظهر قيمة فردية" : "Noura Alshammari · no individual value shown"}</small></div></div><p className="privacyNote">{locale === "ar" ? "التفاصيل الفردية للجاهزية محجوبة عن شاشة قرار التقييم." : "Individual readiness details remain excluded from rating-decision screens."}</p></section>
      </div>
      <section className="workGroup"><div className="sectionHeading"><h2>{locale === "ar" ? "عوائق تحتاج إزالة" : "Blockers to unblock"}</h2><span>{blocked.length}</span></div><div className="surface blockerTable">{blocked.map((item) => <div key={item.id}><strong>{text(item.title, locale)}</strong><span>{item.primaryAssignee}</span><span>{item.dueDate}</span><StatusBadge kind="priority" value={item.priority} /></div>)}</div></section>
    </>
  );
}
