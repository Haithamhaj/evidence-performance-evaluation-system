export type ProhibitedConceptCode =
  | "rating_recommendation"
  | "rating_prediction"
  | "employee_ranking"
  | "productivity_score"
  | "activity_volume_inference"
  | "readiness_conversion";

export type ProhibitedOutputViolation = Readonly<{
  code: ProhibitedConceptCode;
  source: "text" | "key";
  match: string;
}>;

export type ProhibitedOutputScan = Readonly<{
  allowed: boolean;
  violations: readonly ProhibitedOutputViolation[];
}>;

type ScanInput = Readonly<{ text?: string; value?: unknown }>;

const TEXT_PATTERNS: ReadonlyArray<readonly [ProhibitedConceptCode, readonly RegExp[]]> = [
  [
    "rating_recommendation",
    [
      /\b(?:suggested|recommended|proposed)\s+(?:performance\s+)?rating\b/iu,
      /\b(?:i|we)\s+(?:recommend|suggest|propose)\s+(?:an?\s+)?(?:performance\s+)?rating\b/iu,
      /\b(?:performance\s+)?rating\s+(?:suggestion|recommendation)\b/iu,
      /\b(?:performance\s+)?rating\s+(?:(?:that|which)\s+)?(?:i|we)\s+(?:recommend|suggest|propose)\b/iu,
      /(?:التقييم|تقييم\s+الاداء|درجة\s+الاداء).{0,24}(?:المقترح|الموصي\s+به)/iu,
      /(?:التقييم|تقييم\s+الاداء|درجة\s+الاداء).{0,16}(?:الذي|التي).{0,8}(?:اوصي|نوصي|اقترح)/iu,
      /(?:اقترح|اوصي\s+بـ?).{0,24}(?:تقييم|درجة)/iu,
      /(?:نوصي|اوصي).{0,12}(?:ب?تقييم|ب?درجة)/iu,
    ],
  ],
  [
    "rating_prediction",
    [
      /\bpredicted\s+(?:performance\s+)?rating\b/iu,
      /\b(?:expected|anticipated|forecast)\s+(?:performance\s+)?rating\b/iu,
      /\b(?:i|we)\s+predict.{0,24}\b(?:employee\s+)?rating\b/iu,
      /\b(?:performance\s+)?rating\s+(?:is\s+)?predicted\b/iu,
      /\b(?:performance\s+)?rating\s+(?:(?:that|which)\s+)?(?:i|we)\s+(?:predict|expect|forecast)\b/iu,
      /(?:التقييم|تقييم\s+الاداء|درجة\s+الاداء).{0,24}(?:المتوقع|المتنبا\s+به)/iu,
      /(?:التقييم|تقييم\s+الاداء|درجة\s+الاداء).{0,16}(?:الذي|التي).{0,8}(?:اتوقعه?|نتوقعه?|نتنبا)/iu,
      /(?:اتوقع|نتوقع).{0,24}(?:تقييم|درجة)/iu,
    ],
  ],
  [
    "employee_ranking",
    [
      /\bemployee\s+(?:rank|ranking|leaderboard\s+position)\b/iu,
      /\brank(?:ed|ing)?\s+(?:the\s+)?employee\b/iu,
      /(?:ترتيب|رتبة).{0,20}(?:الموظف|الموظفة)/iu,
      /(?:الموظف|الموظفة).{0,20}(?:الاول|الاولي|الثاني|الثانية|ترتيب|رتبة)/iu,
    ],
  ],
  [
    "productivity_score",
    [
      /\bproductivity\s+(?:score|grade|index|rating)\b/iu,
      /(?:درجة|موشر|تقييم).{0,20}(?:الانتاجية)/iu,
      /(?:الانتاجية).{0,20}(?:درجة|موشر|تقييم)/iu,
      /(?:الانتاجية).{0,8}[0-9٠-٩]+\s*(?:من|\/|٪|%)/iu,
    ],
  ],
  [
    "activity_volume_inference",
    [
      /\b(?:more|fewer|number\s+of|count\s+of|volume\s+of)\s+(?:commits?|updates?|activities|projects?|tasks?|pull\s+requests?).{0,48}\b(?:performance|productivity|stronger|weaker|better|worse)\b/iu,
      /\b\d+\s+(?:commits?|updates?|activities|projects?|tasks?|pull\s+requests?).{0,48}\b(?:performance|productivity|stronger|weaker|better|worse)\b/iu,
      /\b(?:performance|productivity).{0,48}\b(?:commit|update|activity|project|task|pull\s+request)\s+(?:count|volume|frequency)\b/iu,
      /(?:عدد|كثرة|حجم|تكرار).{0,24}(?:التحديثات|الالتزامات|المشاريع|المهام|الانشطة).{0,48}(?:اداء|انتاجية).{0,20}(?:افضل|اعلي|اقوي|اسوا|اضعف)/iu,
      /(?:[0-9٠-٩]+|خمسة|عشرة).{0,8}(?:تحديثات|التحديثات|التزامات|الالتزامات|مشاريع|المشاريع|مهام|المهام|انشطة|الانشطة).{0,48}(?:اداء|انتاجية).{0,20}(?:افضل|اعلي|اقوي|اسوا|اضعف)/iu,
      /(?:اداء|انتاجية).{0,48}(?:عدد|كثرة|حجم|تكرار).{0,24}(?:التحديثات|الالتزامات|المشاريع|المهام|الانشطة)/iu,
    ],
  ],
  [
    "readiness_conversion",
    [
      /\bdocumentation\s+readiness.{0,48}\b(?:means|indicates|equals|proves|becomes)\b.{0,32}\bperformance\b/iu,
      /\bperformance.{0,48}\bdocumentation\s+readiness\b/iu,
      /(?:جاهزية|اكتمال).{0,20}(?:التوثيق|الوثائق).{0,32}(?:تعني|تعكس|تدل|تساوي|تثبت).{0,24}(?:اداء|تقييم)/iu,
      /(?:اداء|تقييم).{0,32}(?:جاهزية|اكتمال).{0,20}(?:التوثيق|الوثائق)/iu,
    ],
  ],
];

const KEY_PATTERNS: ReadonlyArray<readonly [ProhibitedConceptCode, RegExp]> = [
  ["rating_recommendation", /^(?:suggested|recommended|proposed)(?:performance)?rating$/u],
  ["rating_prediction", /^predicted(?:performance)?rating$/u],
  ["employee_ranking", /^(?:employee)?(?:rank|ranking|leaderboardposition)$/u],
  ["productivity_score", /^productivity(?:score|grade|index|rating)$/u],
  [
    "activity_volume_inference",
    /^(?:commit|pullrequest|update|activity|project|task)(?:count|volume|frequency|total)$/u,
  ],
  [
    "readiness_conversion",
    /^(?:documentationreadinessperformance|performancefromdocumentationreadiness)$/u,
  ],
];

export function scanProhibitedOutput(input: ScanInput): ProhibitedOutputScan {
  const violations: ProhibitedOutputViolation[] = [];
  const normalizedText = normalizeText(input.text ?? "");
  const clauses = splitClauses(normalizedText);

  for (const [code, patterns] of TEXT_PATTERNS) {
    const match = clauses
      .filter((clause) => !isNeutralPolicyClause(clause, code))
      .flatMap((clause) => patterns.map((pattern) => clause.match(pattern)))
      .find(Boolean);
    if (match?.[0] !== undefined) violations.push({ code, source: "text", match: match[0] });
  }

  for (const key of collectKeys(input.value)) {
    const normalizedKey = key.replace(/[^a-z0-9]/giu, "").toLowerCase();
    const matched = KEY_PATTERNS.find(([, pattern]) => pattern.test(normalizedKey));
    if (matched !== undefined && !violations.some(({ code }) => code === matched[0])) {
      violations.push({ code: matched[0], source: "key", match: key });
    }
  }

  return { allowed: violations.length === 0, violations };
}

function isNeutralPolicyClause(text: string, code: ProhibitedConceptCode): boolean {
  if (code === "rating_recommendation") {
    return (
      /\b(?:recommended|suggested|proposed)\s+(?:performance\s+)?rating\s+(?:is\s+)?(?:not\s+allowed|prohibited|forbidden|disallowed)\b/iu.test(
        text,
      ) || /(?:لا|لن)\s+(?:اوصي|نوصي|اقترح).{0,16}(?:تقييم|درجة)/iu.test(text)
    );
  }
  if (code === "rating_prediction") {
    return /\b(?:predicted|expected|forecast)\s+(?:performance\s+)?rating\s+(?:is\s+)?(?:not\s+allowed|prohibited|forbidden|disallowed)\b/iu.test(
      text,
    );
  }
  if (code === "activity_volume_inference") {
    return (
      /\b(?:more|fewer)\s+(?:commits?|updates?|activities|projects?|tasks?|pull\s+requests?)\s+(?:do|does)\s+not\s+(?:mean|indicate|prove).{0,32}\b(?:performance|productivity)\b/iu.test(
        text,
      ) ||
      /(?:كثرة|عدد|حجم).{0,24}(?:التحديثات|الالتزامات|المشاريع|المهام|الانشطة).{0,16}(?:لا|ليس|ليست)\s+(?:تعني|تدل|تثبت).{0,24}(?:اداء|انتاجية)/iu.test(
        text,
      )
    );
  }
  if (code === "readiness_conversion") {
    return (
      /\bperformance\s+(?:must|should)\s+remain\s+separate\s+from\s+documentation\s+readiness\b/iu.test(
        text,
      ) ||
      /(?:اداء|تقييم).{0,20}(?:منفصل|منفصلا|منفصلة).{0,20}(?:جاهزية|اكتمال).{0,16}(?:التوثيق|الوثائق)/iu.test(
        text,
      )
    );
  }
  return false;
}

function splitClauses(text: string): string[] {
  return text
    .split(/[.!?؟؛;\r\n]+/u)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u0640\u064B-\u065F\u0670]/gu, "")
    .replace(/[إأآٱ]/gu, "ا")
    .replace(/ى/gu, "ي")
    .replace(/ؤ/gu, "و")
    .replace(/ئ/gu, "ي");
}

function collectKeys(value: unknown, seen = new WeakSet<object>()): string[] {
  if (value === null || typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);
  if (Array.isArray(value)) return value.flatMap((item) => collectKeys(item, seen));
  return Object.entries(value).flatMap(([key, child]) => [key, ...collectKeys(child, seen)]);
}
