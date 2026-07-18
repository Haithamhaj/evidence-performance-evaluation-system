import type {
  ActivityEvent,
  EvidenceSuggestion,
  InboxItem,
  Project,
  ReadinessFact,
  WorkItem,
  Workstream,
} from "./types";

const t = (ar: string, en: string) => ({ ar, en });

export const projects: readonly Project[] = [
  {
    id: "project-nabd",
    name: t("منصة نبض المحادثات", "Nabd Conversation Platform"),
    purpose: t(
      "تحويل المحادثات إلى مؤشرات جودة قابلة للتنفيذ دون تقييم الموظفين آلياً.",
      "Turn conversations into actionable quality signals without automated employee scoring.",
    ),
    employeeRole: t("مالك تقني مشارك", "Contributing technical owner"),
    health: "needs_attention",
    owner: "ليان الحربي",
    targetDate: "2026-09-30",
    latestUpdate: t("اكتمل معيار النوايا العربية وبدأت مراجعة الأمان.", "Arabic intent benchmark completed; security review started."),
    nextAction: t("اعتماد حدود البيانات التجريبية", "Approve experimental data boundaries"),
    blocker: t("انتظار قرار بوابة بيانات العميل", "Waiting for client data-gateway decision"),
    milestones: [
      t("المعيار العربي", "Arabic benchmark"),
      t("تجربة لوحة الجودة", "Quality dashboard pilot"),
      t("تكامل العميل", "Client integration"),
    ],
    kpis: [
      { label: t("دقة اكتشاف النوايا", "Intent detection accuracy"), value: "91.4%" },
      { label: t("زمن معالجة المحادثة", "Conversation processing latency"), value: "4.2s" },
    ],
  },
  {
    id: "project-sawt",
    name: t("مساعد صوتي للمؤسسات", "Enterprise Voice Assistant"),
    purpose: t(
      "تقديم تجربة صوتية عربية موثوقة للمكالمات عالية الحساسية.",
      "Deliver a reliable Arabic voice experience for high-sensitivity calls.",
    ),
    employeeRole: t("مساهم في التقييم والتكامل", "Evaluation and integration contributor"),
    health: "on_track",
    owner: "سالم الدوسري",
    targetDate: "2026-10-15",
    latestUpdate: t("نجحت تجربة الضوضاء الخليجية ضمن الحد المستهدف.", "Gulf noise test passed the target threshold."),
    nextAction: t("مراجعة سيناريوهات الاسترداد", "Review recovery scenarios"),
    blocker: null,
    milestones: [
      t("حزمة اللهجات", "Dialect pack"),
      t("اختبار الانقطاع", "Interruption testing"),
      t("الإطلاق الداخلي", "Internal release"),
    ],
    kpis: [
      { label: t("نسبة إتمام المكالمات", "Call completion rate"), value: "87%" },
      { label: t("متوسط زمن الاستجابة", "Median response latency"), value: "780ms" },
    ],
  },
];

export const workstreams: readonly Workstream[] = [
  {
    id: "ws-intent-quality",
    projectId: "project-nabd",
    name: t("جودة النوايا العربية", "Arabic Intent Quality"),
    purpose: t("قياس وتحسين فهم النوايا العربية المختلطة.", "Measure and improve mixed-Arabic intent understanding."),
    owner: "هيثم الحاج",
    contributors: ["نورة الشمري", "عمر قاسم"],
    health: "on_track",
    targetOutput: t("معيار معتمد مع تحليل الأخطاء", "Approved benchmark with error analysis"),
    kpis: [{ label: t("تغطية الحالات الحرجة", "Critical-case coverage"), value: "96%" }],
    criteria: [
      t("يوثق خط الأساس قبل التحسين", "Documents the baseline before improvement"),
      t("يربط القرار بنتيجة قابلة لإعادة الاختبار", "Links decisions to reproducible results"),
    ],
    responsibilityHistory: [
      {
        person: "هيثم الحاج",
        role: t("المالك الأساسي", "Primary owner"),
        startsAt: "2026-04-01",
        endsAt: null,
      },
    ],
  },
  {
    id: "ws-quality-dashboard",
    projectId: "project-nabd",
    name: t("لوحة الجودة", "Quality Dashboard"),
    purpose: t("عرض صحة المنتج دون تحويل النشاط إلى أداء فردي.", "Show product health without turning activity into individual performance."),
    owner: "نورة الشمري",
    contributors: ["هيثم الحاج"],
    health: "needs_attention",
    targetOutput: t("لوحة تشغيلية للمدير والفريق", "Operational dashboard for manager and team"),
    kpis: [{ label: t("تحديث البيانات", "Data freshness"), value: "15 min" }],
    criteria: [t("تفصل صحة المشروع عن تقييم الأفراد", "Separates project health from employee evaluation")],
    responsibilityHistory: [
      {
        person: "نورة الشمري",
        role: t("المالك الأساسي", "Primary owner"),
        startsAt: "2026-05-11",
        endsAt: null,
      },
    ],
  },
  {
    id: "ws-client-integration",
    projectId: "project-nabd",
    name: t("تكامل بيانات العميل", "Client Data Integration"),
    purpose: t("إدخال بيانات العميل ضمن حدود الخصوصية.", "Ingest client data within privacy boundaries."),
    owner: "عمر قاسم",
    contributors: ["هيثم الحاج"],
    health: "at_risk",
    targetOutput: t("مسار بيانات مدقق وقابل للاسترداد", "Audited and recoverable data path"),
    kpis: [{ label: t("نجاح الاستيراد", "Import success"), value: "99.2%" }],
    criteria: [t("يوثق قرارات الخصوصية والمخاطر", "Documents privacy and risk decisions")],
    responsibilityHistory: [
      {
        person: "عمر قاسم",
        role: t("المالك الأساسي", "Primary owner"),
        startsAt: "2026-06-01",
        endsAt: null,
      },
    ],
  },
  {
    id: "ws-speech-eval",
    projectId: "project-sawt",
    name: t("تقييم الكلام واللهجات", "Speech and Dialect Evaluation"),
    purpose: t("اختبار النسخ الصوتي على لهجات وسياقات واقعية.", "Test transcription on realistic dialects and contexts."),
    owner: "هيثم الحاج",
    contributors: ["سارة مراد"],
    health: "on_track",
    targetOutput: t("حزمة تقييم قابلة للتكرار", "Reproducible evaluation suite"),
    kpis: [{ label: t("خطأ الكلمات", "Word error rate"), value: "11.8%" }],
    criteria: [t("يحفظ المصدر والنص الخام والمصحح", "Preserves source, raw transcript, and edited transcript")],
    responsibilityHistory: [
      {
        person: "هيثم الحاج",
        role: t("المالك الأساسي", "Primary owner"),
        startsAt: "2026-05-20",
        endsAt: null,
      },
    ],
  },
  {
    id: "ws-voice-runtime",
    projectId: "project-sawt",
    name: t("تكامل وقت التشغيل", "Voice Runtime Integration"),
    purpose: t("دمج الاستجابة الصوتية مع الاسترداد الآمن.", "Integrate voice response with safe recovery."),
    owner: "سارة مراد",
    contributors: ["هيثم الحاج"],
    health: "at_risk",
    targetOutput: t("مسار مكالمات مستقر", "Stable call flow"),
    kpis: [{ label: t("الاسترداد من الانقطاع", "Interruption recovery"), value: "83%" }],
    criteria: [t("يختبر سيناريوهات الفشل قبل الإطلاق", "Tests failure scenarios before release")],
    responsibilityHistory: [
      {
        person: "سارة مراد",
        role: t("المالك الأساسي", "Primary owner"),
        startsAt: "2026-06-08",
        endsAt: null,
      },
    ],
  },
];

const itemSeeds = [
  ["wi-101", "اعتماد مجموعة النوايا الحرجة", "Approve critical intent set", "project-nabd", "ws-intent-quality", "in_review", "urgent", "2026-07-18"],
  ["wi-102", "تحليل أخطاء العربية المختلطة", "Analyze mixed-Arabic errors", "project-nabd", "ws-intent-quality", "in_progress", "high", "2026-07-19"],
  ["wi-103", "توثيق خط الأساس", "Document the baseline", "project-nabd", "ws-intent-quality", "done", "medium", "2026-07-15"],
  ["wi-104", "تجربة تحسين معيار النوايا", "Run intent benchmark improvement", "project-nabd", "ws-intent-quality", "in_progress", "high", "2026-07-18"],
  ["wi-105", "مراجعة حدود لوحة الجودة", "Review quality dashboard boundaries", "project-nabd", "ws-quality-dashboard", "ready", "high", "2026-07-20"],
  ["wi-106", "تصميم حالة المشروع الصحية", "Design project health state", "project-nabd", "ws-quality-dashboard", "planned", "medium", "2026-07-23"],
  ["wi-107", "اختبار عرض المدير", "Test manager projection", "project-nabd", "ws-quality-dashboard", "blocked", "high", "2026-07-17"],
  ["wi-108", "قرار بوابة بيانات العميل", "Decide client data gateway", "project-nabd", "ws-client-integration", "blocked", "urgent", "2026-07-16"],
  ["wi-109", "مراجعة عينات المحادثات", "Review conversation samples", "project-nabd", "ws-client-integration", "ready", "medium", null],
  ["wi-110", "فحص سياسة الاحتفاظ", "Check retention policy", "project-nabd", "ws-client-integration", "planned", "low", "2026-07-25"],
  ["wi-111", "توسيع عينات الضوضاء الخليجية", "Expand Gulf noise samples", "project-sawt", "ws-speech-eval", "in_progress", "high", "2026-07-18"],
  ["wi-112", "توثيق عائق بوابة العميل", "Document client gateway blocker", "project-sawt", "ws-speech-eval", "ready", "medium", "2026-07-21"],
  ["wi-113", "مراجعة نصوص Levantine", "Review Levantine transcripts", "project-sawt", "ws-speech-eval", "planned", "medium", null],
  ["wi-114", "اختبار النص المختلط", "Test mixed-language transcript", "project-sawt", "ws-speech-eval", "in_review", "high", "2026-07-19"],
  ["wi-115", "سيناريو استرداد المكالمة", "Call recovery scenario", "project-sawt", "ws-voice-runtime", "blocked", "urgent", "2026-07-17"],
  ["wi-116", "قياس زمن الاستجابة", "Measure response latency", "project-sawt", "ws-voice-runtime", "in_progress", "medium", "2026-07-22"],
  ["wi-117", "مراجعة جاهزية الإطلاق", "Review release readiness", "project-sawt", null, "ready", "high", "2026-07-24"],
  ["wi-118", "تحديث معيار أمان الصوت", "Update voice safety criterion", "project-sawt", null, "planned", "medium", null],
  ["wi-119", "تأكيد مساهمة الاختبار", "Confirm testing contribution", "project-sawt", "ws-speech-eval", "in_review", "medium", "2026-07-20"],
  ["wi-120", "إغلاق تجربة الانقطاع", "Close interruption experiment", "project-sawt", "ws-voice-runtime", "done", "low", "2026-07-14"],
] as const;

export const workItems: readonly WorkItem[] = itemSeeds.map(
  ([id, ar, en, projectId, workstreamId, status, priority, dueDate], index) => ({
    id,
    title: t(ar, en),
    description: t(
      `وصف واقعي موجز لـ ${ar} مع سياق النتيجة والمسؤولية.`,
      `A concise realistic description of ${en} with result and responsibility context.`,
    ),
    projectId,
    workstreamId,
    employeeRole: index % 3 === 0 ? t("مالك أساسي", "Primary owner") : t("مساهم", "Contributor"),
    primaryAssignee: index % 4 === 0 ? "نورة الشمري" : "هيثم الحاج",
    participants: index % 2 === 0 ? ["هيثم الحاج", "نورة الشمري"] : ["هيثم الحاج"],
    type: index % 5 === 0 ? "decision" : index % 4 === 0 ? "review" : "task",
    status,
    priority,
    startDate: `2026-07-${String(Math.max(1, 4 + index)).padStart(2, "0")}`,
    dueDate,
    requirements: [t("تسجيل النتيجة والسياق", "Record the result and context")],
    acceptanceCriteria: [t("مراجعة بشرية قبل الإغلاق", "Human review before closure")],
    dependencies: index > 0 && index % 4 === 0 ? [itemSeeds[index - 1]?.[0] ?? ""] : [],
    blockerReason:
      status === "blocked"
        ? t("بانتظار وصول أو قرار خارجي موثق", "Waiting for documented external access or decision")
        : null,
    nextAction: t("تأكيد الخطوة التالية مع أصحاب العلاقة", "Confirm the next step with participants"),
    criterionIds: index % 2 === 0 ? ["criterion-quality"] : ["criterion-resilience"],
    updateIds: index % 3 === 0 ? [`update-${index + 1}`] : [],
    evidenceIds: index % 4 === 0 ? [`evidence-${index + 1}`] : [],
    githubLinks: index % 5 === 0 ? [`https://github.com/leapai/prototype/pull/${index + 31}`] : [],
    contributionContext: t(
      "المساهمة موصوفة ضمن فترة المسؤولية ولا تفترض رصيد الفريق.",
      "Contribution is described within the responsibility window and does not imply team credit.",
    ),
    history: [
      {
        label: t("تم إنشاء عنصر العمل", "Work Item created"),
        at: `2026-07-${String(Math.max(1, 4 + index)).padStart(2, "0")}T08:00:00Z`,
        actor: "هيثم الحاج",
      },
    ],
  }),
);

export const inboxItems: readonly InboxItem[] = [
  { id: "in-1", kind: "manager_clarification", title: t("طلب توضيح من المدير", "Manager clarification request"), detail: t("وضح أثر قرار بوابة البيانات على الموعد.", "Clarify how the data-gateway decision affects the target date."), actionable: true, workItemId: "wi-108", occurredAt: "2026-07-18T07:40:00Z" },
  { id: "in-2", kind: "mention", title: t("إشارة في تعليق", "Comment mention"), detail: t("ذكرتك نورة في مراجعة لوحة الجودة.", "Noura mentioned you in the quality-dashboard review."), actionable: true, workItemId: "wi-105", occurredAt: "2026-07-18T06:50:00Z" },
  { id: "in-3", kind: "criteria_acknowledgment", title: t("إقرار معيار جديد", "Criteria acknowledgment"), detail: t("معيار الخصوصية جاهز للمراجعة.", "The privacy criterion is ready for review."), actionable: true, workItemId: null, occurredAt: "2026-07-17T15:20:00Z" },
  { id: "in-4", kind: "github_suggestion", title: t("دليل GitHub مقترح", "Suggested GitHub evidence"), detail: t("نتيجة CI ناجحة للمعيار العربي.", "A successful CI result for the Arabic benchmark."), actionable: true, workItemId: "wi-104", occurredAt: "2026-07-17T13:10:00Z" },
  { id: "in-5", kind: "attribution_request", title: t("طلب توضيح الإسناد", "Attribution clarification"), detail: t("حدد مساهمتك الجزئية في اختبار الضوضاء.", "Describe your partial contribution to the noise test."), actionable: true, workItemId: "wi-111", occurredAt: "2026-07-17T10:30:00Z" },
  { id: "in-6", kind: "weekly_reminder", title: t("تذكير تحديث الخميس", "Thursday update reminder"), detail: t("تكامل بيانات العميل يحتاج تحديثاً جوهرياً أو تأكيداً سريعاً.", "Client Data Integration needs a substantive update or quick confirmation."), actionable: true, workItemId: "wi-108", occurredAt: "2026-07-17T08:00:00Z" },
  { id: "in-7", kind: "evaluation_action", title: t("إجراء تقييم قادم", "Upcoming evaluation action"), detail: t("راجع معاينة الحقائق للفترة الحالية.", "Review the Fact View preview for the current period."), actionable: true, workItemId: null, occurredAt: "2026-07-16T11:00:00Z" },
];

export const activityEvents: readonly ActivityEvent[] = [
  { id: "act-1", kind: "verified_fact", title: t("اكتمل خط الأساس", "Baseline completed"), detail: t("تم تشغيل 420 حالة وحفظ نتائج المصدر.", "420 cases were run and source results retained."), occurredAt: "2026-07-18T08:20:00Z", actor: "هيثم الحاج", projectId: "project-nabd", workstreamId: "ws-intent-quality", workItemId: "wi-104" },
  { id: "act-2", kind: "suggested_evidence", title: t("نتيجة CI مقترحة", "CI result suggested"), detail: t("اقتراح فقط؛ لم يؤكد كدليل بعد.", "Suggestion only; not yet confirmed as evidence."), occurredAt: "2026-07-18T07:50:00Z", actor: "GitHub App", projectId: "project-nabd", workstreamId: "ws-intent-quality", workItemId: "wi-104" },
  { id: "act-3", kind: "blocker", title: t("عائق بوابة العميل", "Client gateway blocker"), detail: t("بانتظار قرار وصول رسمي؛ لا توجد نسبة أداء مرتبطة.", "Waiting for a formal access decision; no performance value is attached."), occurredAt: "2026-07-17T14:10:00Z", actor: "عمر قاسم", projectId: "project-nabd", workstreamId: "ws-client-integration", workItemId: "wi-108" },
  { id: "act-4", kind: "responsibility_change", title: t("بدأت فترة مسؤولية", "Responsibility window started"), detail: t("بدأ هيثم ملكية تقييم الكلام.", "Haitham began ownership of speech evaluation."), occurredAt: "2026-05-20T00:00:00Z", actor: "النظام", projectId: "project-sawt", workstreamId: "ws-speech-eval", workItemId: null },
];

export const evidenceSuggestions: readonly EvidenceSuggestion[] = [
  { id: "ev-1", sourceKind: "pull_request", title: t("تحسين عزل النص المختلط", "Improve mixed-text isolation"), sourceLabel: "PR #81", projectId: "project-nabd", workstreamId: "ws-quality-dashboard", workItemId: "wi-105", state: "suggested", executionMode: null, context: null },
  { id: "ev-2", sourceKind: "commit", title: t("إضافة حالات معيار عربية", "Add Arabic benchmark cases"), sourceLabel: "commit 8fd1c2a", projectId: "project-nabd", workstreamId: "ws-intent-quality", workItemId: "wi-104", state: "suggested", executionMode: null, context: null },
  { id: "ev-3", sourceKind: "ci_result", title: t("نجاح اختبارات النوايا", "Intent tests passed"), sourceLabel: "CI run #194", projectId: "project-nabd", workstreamId: "ws-intent-quality", workItemId: "wi-104", state: "suggested", executionMode: null, context: null },
  { id: "ev-4", sourceKind: "test_result", title: t("نتيجة ضوضاء خليجية", "Gulf noise test result"), sourceLabel: "eval-2026-07-17", projectId: "project-sawt", workstreamId: "ws-speech-eval", workItemId: "wi-111", state: "confirmed", executionMode: "mixed", context: t("تحقق الفريق من النتيجة ووصفت مساهمتي الجزئية.", "The team verified the result and I described my partial contribution.") },
  { id: "ev-5", sourceKind: "file", title: t("تقرير تحليل الأخطاء", "Error analysis report"), sourceLabel: "error-analysis.pdf", projectId: "project-nabd", workstreamId: "ws-intent-quality", workItemId: "wi-102", state: "confirmed", executionMode: "manual", context: t("يربط الأخطاء بقرارات العينة.", "Links errors to sample decisions.") },
  { id: "ev-6", sourceKind: "link", title: t("مرجع سياسة العميل", "Client policy reference"), sourceLabel: "client.example/policy", projectId: "project-nabd", workstreamId: "ws-client-integration", workItemId: "wi-108", state: "suggested", executionMode: null, context: null },
  { id: "ev-7", sourceKind: "screenshot", title: t("شاشة لوحة الجودة", "Quality dashboard screen"), sourceLabel: "quality-dashboard.png", projectId: "project-nabd", workstreamId: "ws-quality-dashboard", workItemId: "wi-107", state: "confirmed", executionMode: "ai_assisted", context: t("لقطة موثقة مع مصدر ونتيجة.", "Contextualized screenshot with source and result.") },
  { id: "ev-8", sourceKind: "architecture_diagram", title: t("مخطط استرداد المكالمة", "Call recovery architecture"), sourceLabel: "recovery-flow.svg", projectId: "project-sawt", workstreamId: "ws-voice-runtime", workItemId: "wi-115", state: "suggested", executionMode: null, context: null },
];

export const readinessFacts: readonly ReadinessFact[] = [
  {
    id: "fact-1",
    period: t("الربع الثالث 2026", "Q3 2026"),
    projectId: "project-nabd",
    workstreamId: "ws-intent-quality",
    responsibilityWindow: t("1 أبريل 2026 — مستمر", "1 Apr 2026 — ongoing"),
    employeeClaim: t("حسّنت موثوقية معيار النوايا العربية.", "Improved the reliability of the Arabic intent benchmark."),
    supportedFacts: [
      t("شُغلت 420 حالة اختبار.", "420 test cases were executed."),
      t("انخفضت الإيجابيات الكاذبة 18%.", "False positives decreased by 18%."),
    ],
    unclearParts: [t("أثر التحسين على بيانات العميل لم يتحقق بعد.", "Impact on client data is not yet verified.")],
    result: t("معيار قابل لإعادة الاختبار ومراجعة أمان مفتوحة.", "A reproducible benchmark with an open security review."),
    evidenceIds: ["ev-2", "ev-3", "ev-5"],
    verificationState: "source_supported",
    attributionState: "peer_acknowledged",
    criterionIds: ["criterion-quality"],
  },
];

export const prototypeData = {
  projects,
  workstreams,
  workItems,
  inboxItems,
  activityEvents,
  evidenceSuggestions,
  readinessFacts,
} as const;
