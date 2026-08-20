"use client";

import type { Catalog } from "@evaluation/localization";
import { ProductIcon } from "@evaluation/ui";
import { createElement } from "react";

import foundationStyles from "../foundation/foundation.module.css";
import { buildShellModel } from "./shell-model";
import { StableShell } from "./stable-shell";

const employee = { active: true, roles: [] as string[] };
const manager = { active: true, roles: ["manager"] };
const shellCatalogs = {
  ar: {
    "actions.close": "إغلاق",
    "actions.login": "تسجيل الدخول",
    "actions.logout": "تسجيل الخروج",
    "capture.code": "شفرة ملصقة",
    "capture.file": "ملف أو صورة خاصة",
    "capture.link": "رابط HTTP أو HTTPS",
    "capture.note": "ملاحظة الإضافة",
    "capture.privateHint":
      "احفظ ملاحظة أو رابطًا أو شفرة أو ملفًا أو صورة خامًا في صندوقك الخاص. لا ينشئ ذلك مهمة أو تحديثًا أو سجل أدلة أو تقدم مشروع أو مدخلًا للتقييم.",
    "capture.recovery":
      "ما زالت مسودتك الخاصة هنا. حاول مرة أخرى أو احفظ يدويًا عندما تكون جاهزًا.",
    "capture.reviewHint":
      "راجع هذه المسودة الخاصة الخام قبل الحفظ. تبقى الترقية إلى عمل رسمي إجراءً منفصلًا.",
    "capture.reviewSave": "مراجعة وحفظ خاص",
    "capture.saved": "تم الحفظ في صندوقك الخاص.",
    "capture.savePrivate": "حفظ خاص",
    "capture.source": "نوع المصدر",
    "capture.source.code": "شفرة ملصقة",
    "capture.source.file": "ملف",
    "capture.source.image": "صورة",
    "capture.source.link": "رابط",
    "capture.source.text": "ملاحظة",
    "capture.title": "شارك أي شيء",
    "capture.subtitle": "الصق رابطًا، اكتب تحديثًا، تحدث، ارفع ملفًا أو صورة، أو أضف شفرة.",
    "capture.step.capture": "إضافة",
    "capture.step.clarify": "توضيح",
    "capture.step.review": "مراجعة وتأكيد",
    "capture.composerLabel": "على ماذا تعمل؟",
    "capture.composerPlaceholder": "شارك تحديثًا أو الصق رابطًا…",
    "capture.addVoice": "إضافة ملاحظة صوتية",
    "capture.addLink": "إضافة رابط",
    "capture.addImage": "إضافة صورة",
    "capture.addCode": "إضافة شفرة",
    "capture.addFile": "إضافة ملف",
    "capture.removeSource": "إزالة {source}",
    "capture.characterCount": "{count} / 8000",
    "capture.understand": "فهم المحتوى",
    "capture.understanding": "جارٍ فهم مسودتك الخاصة…",
    "capture.understoodTitle": "هذا ما فهمته حتى الآن",
    "capture.likelyProject": "المشروع المرجح",
    "capture.change": "تغيير",
    "capture.likelyMeaning": "المعنى المرجح",
    "capture.relatedWork": "العمل المرتبط",
    "capture.relatedWorkFound": "تم تحديد عنصر عمل مرتبط",
    "capture.relatedWorkNone": "لم يُحدد عنصر عمل بعد",
    "capture.kpiSignal": "إشارة مؤشر الأداء",
    "capture.kpiMissing": "قد تظل قيمة القياس أو مصدر التحقق مفقودة.",
    "capture.privacy": "الخصوصية",
    "capture.privateDraft": "مسودة خاصة حتى تراجعها وتؤكدها.",
    "capture.confidence.high": "ثقة عالية",
    "capture.confidence.uncertain": "تحتاج مراجعة",
    "capture.meaning.private_note": "ملاحظة خاصة",
    "capture.meaning.task": "مهمة",
    "capture.meaning.project_update": "تحديث مشروع",
    "capture.meaning.suggested_evidence": "دليل مقترح",
    "capture.clarification": "توضيح بالذكاء الاصطناعي",
    "capture.answer": "إجابتك…",
    "capture.notYet": "ليس لدي بعد",
    "capture.continueReview": "متابعة المراجعة",
    "capture.noRecord": "لن يتم نشر أو تسجيل أي شيء حتى تؤكد.",
    "locale.switchToArabic": "العربية",
    "locale.switchToEnglish": "English",
    "shell.availableNextSlice": "متاح في الشريحة التالية",
    "shell.brand": "موجز العمل",
    "shell.brandMark": "CB",
    "shell.global.capture": "إضافة",
    "shell.global.chat": "المحادثة",
    "shell.global.search": "اسأل أو ابحث أو أضف…",
    "shell.global.whatChanged": "ما الذي تغيّر",
    "shell.nav.administration": "الإدارة",
    "shell.nav.evaluation": "التقييم",
    "shell.nav.health": "حالة النظام",
    "shell.nav.help": "المساعدة",
    "shell.nav.managerOperations": "عمليات المدير",
    "shell.nav.more": "المزيد",
    "shell.nav.projects": "المشاريع",
    "shell.nav.research": "البحث",
    "shell.nav.settings": "الإعدادات",
    "shell.nav.today": "اليوم",
    "shell.nav.work": "العمل",
    "shell.skipToContent": "الانتقال إلى المحتوى الرئيسي",
  },
  en: {
    "actions.close": "Close",
    "actions.login": "Log in",
    "actions.logout": "Log out",
    "capture.code": "Pasted code",
    "capture.file": "Private file or image",
    "capture.link": "HTTP or HTTPS link",
    "capture.note": "Capture note",
    "capture.privateHint":
      "Save a raw note, link, code, file, or image to your private Inbox. This does not create a Task, Update, Evidence record, Project progress, or evaluation input.",
    "capture.recovery":
      "Your private draft is still here. Try again or save manually when you are ready.",
    "capture.reviewHint":
      "Review this raw private draft before saving. Promotion to official work remains a separate action.",
    "capture.reviewSave": "Review and save privately",
    "capture.saved": "Saved to your private Inbox.",
    "capture.savePrivate": "Save privately",
    "capture.source": "Source type",
    "capture.source.code": "Pasted code",
    "capture.source.file": "File",
    "capture.source.image": "Image",
    "capture.source.link": "Link",
    "capture.source.text": "Note",
    "capture.title": "Share anything",
    "capture.subtitle":
      "Paste a link, write an update, speak, upload a file or image, or add code.",
    "capture.step.capture": "Capture",
    "capture.step.clarify": "Clarify",
    "capture.step.review": "Review & confirm",
    "capture.composerLabel": "What are you working on?",
    "capture.composerPlaceholder": "Share an update or paste a link…",
    "capture.addVoice": "Add a voice note",
    "capture.addLink": "Add a link",
    "capture.addImage": "Add an image",
    "capture.addCode": "Add code",
    "capture.addFile": "Add a file",
    "capture.removeSource": "Remove {source}",
    "capture.characterCount": "{count} / 8000",
    "capture.understand": "Understand this",
    "capture.understanding": "Understanding your private draft…",
    "capture.understoodTitle": "Here’s what I understand so far",
    "capture.likelyProject": "Likely Project",
    "capture.change": "Change",
    "capture.likelyMeaning": "Likely meaning",
    "capture.relatedWork": "Related work",
    "capture.relatedWorkFound": "Related Work Item identified",
    "capture.relatedWorkNone": "No Work Item identified yet",
    "capture.kpiSignal": "KPI signal",
    "capture.kpiMissing": "A measurement value or verification source may still be missing.",
    "capture.privacy": "Privacy",
    "capture.privateDraft": "Private draft until you review and confirm.",
    "capture.confidence.high": "High confidence",
    "capture.confidence.uncertain": "Needs review",
    "capture.meaning.private_note": "Private note",
    "capture.meaning.task": "Task",
    "capture.meaning.project_update": "Project update",
    "capture.meaning.suggested_evidence": "Suggested evidence",
    "capture.clarification": "AI clarification",
    "capture.answer": "Your answer…",
    "capture.notYet": "I don’t have it yet",
    "capture.continueReview": "Continue review",
    "capture.noRecord": "Nothing will be posted or recorded until you confirm.",
    "locale.switchToArabic": "العربية",
    "locale.switchToEnglish": "English",
    "shell.availableNextSlice": "Available in the next slice",
    "shell.brand": "Command Brief",
    "shell.brandMark": "CB",
    "shell.global.capture": "Capture",
    "shell.global.chat": "Chat",
    "shell.global.search": "Ask, search, or capture…",
    "shell.global.whatChanged": "What Changed",
    "shell.nav.administration": "Administration",
    "shell.nav.evaluation": "Evaluation",
    "shell.nav.health": "System health",
    "shell.nav.help": "Help",
    "shell.nav.managerOperations": "Manager operations",
    "shell.nav.more": "More",
    "shell.nav.projects": "Projects",
    "shell.nav.research": "Research",
    "shell.nav.settings": "Settings",
    "shell.nav.today": "Today",
    "shell.nav.work": "Work",
    "shell.skipToContent": "Skip to main content",
  },
} as const;

function ShellStory({
  locale,
  role,
}: Readonly<{ locale: "ar" | "en"; role: "employee" | "manager" }>) {
  const principal = role === "manager" ? manager : employee;
  const alternate = locale === "ar" ? "en" : "ar";
  return createElement(
    StableShell,
    {
      authAction: "logout",
      catalog: shellCatalogs[locale] as unknown as Catalog,
      locale,
      localeSwitchHref: `/${alternate}`,
      model: buildShellModel({ locale, principal }),
    },
    createElement(ShellPreview, { locale }),
  );
}

function ShellPreview({ locale }: Readonly<{ locale: "ar" | "en" }>) {
  const arabic = locale === "ar";
  return (
    <div className={foundationStyles.canvas!} dir={arabic ? "rtl" : "ltr"} lang={locale}>
      <div className={foundationStyles.brief!}>
        <header>
          <p className={foundationStyles.eyebrow!}>
            {arabic ? "اليوم / 11 أغسطس 2026" : "Today / 11 Aug 2026"}
          </p>
          <h1 className={foundationStyles.heading!}>
            {arabic ? "صباح الخير، Codex" : "Good morning, Codex"}
          </h1>
        </header>

        <PreviewSection
          accent="decision"
          label={arabic ? "يحتاج قرارك" : "Needs Your Decision"}
          title={arabic ? "ربط PR #184 بمصادقة API؟" : "Link PR #184 to API authentication?"}
          detail={
            arabic
              ? "GitHub · Atlas Voice Intelligence · قبل 8 دقائق"
              : "GitHub · Atlas Voice Intelligence · 8 min ago"
          }
          icon="github"
        />
        <PreviewSection
          label={arabic ? "مجهز لك" : "Prepared for You"}
          title={arabic ? "مسودة تحديث المشروع الأسبوعي" : "Weekly project update draft"}
          detail={
            arabic
              ? "أُعدت من 3 مهام مؤكدة وPR #184."
              : "Prepared from 3 confirmed tasks and PR #184."
          }
          icon="document"
        />
        <PreviewSection
          label={arabic ? "اليوم" : "Today"}
          title={arabic ? "التحقق من بديل البث" : "Validate streaming fallback"}
          detail={arabic ? "Atlas Voice Intelligence · اليوم" : "Atlas Voice Intelligence · Today"}
          icon="check"
        />
        <PreviewSection
          label={arabic ? "المتابعة" : "Continue"}
          title={arabic ? "قياس ذاكرة المحادثة" : "Conversation memory benchmark"}
          detail={arabic ? "غير محجوب · لا توجد تبعيات" : "Unblocked · No dependencies"}
          icon="research"
        />
        <PreviewSection
          label={arabic ? "ما الذي تغيّر" : "What Changed"}
          title={
            arabic
              ? "دُمج PR #182 واكتمل شرط المرحلة"
              : "PR #182 merged; milestone condition satisfied"
          }
          detail={arabic ? "GitHub commit 9c3a1d2 على main" : "GitHub commit 9c3a1d2 on main"}
          icon="check"
        />
      </div>
    </div>
  );
}

// Babel removes JSX-only references before the base unused-variable rule runs.
// eslint-disable-next-line no-unused-vars
function PreviewSection({
  accent,
  detail,
  icon,
  label,
  title,
}: Readonly<{
  accent?: "decision";
  detail: string;
  icon: "check" | "document" | "github" | "research";
  label: string;
  title: string;
}>) {
  return (
    <section
      className={`${foundationStyles.section!} ${
        accent === "decision" ? foundationStyles.decision! : ""
      }`}
    >
      <p className={foundationStyles.sectionLabel!}>{label}</p>
      <div className={`${foundationStyles.card!} ${foundationStyles.row!}`}>
        {createElement(ProductIcon, { name: icon, size: "large" })}
        <div className={foundationStyles.rowCopy!}>
          <strong>{title}</strong>
          <span className={foundationStyles.supporting!}>{detail}</span>
        </div>
      </div>
    </section>
  );
}

export default {
  component: ShellStory,
  parameters: { a11y: { test: "error" }, layout: "fullscreen" },
  title: "Shell/Stable Shell",
};

export const EmployeeEnglish = { args: { locale: "en", role: "employee" } };
export const ManagerEnglish = { args: { locale: "en", role: "manager" } };
export const EmployeeArabic = { args: { locale: "ar", role: "employee" } };
export const ManagerArabicMobile = {
  args: { locale: "ar", role: "manager" },
  parameters: {
    viewport: {
      defaultViewport: "mobile390",
      options: {
        mobile390: { name: "Mobile 390px", styles: { height: "844px", width: "390px" } },
      },
    },
  },
};
