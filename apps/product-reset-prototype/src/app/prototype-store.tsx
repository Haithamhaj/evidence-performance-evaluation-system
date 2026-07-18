"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  activityEvents as initialActivityEvents,
  evidenceSuggestions as initialEvidenceSuggestions,
  inboxItems,
  projects,
  readinessFacts,
  workItems as initialWorkItems,
  workstreams,
} from "../domain/mock-data";
import type {
  ActivityEvent,
  EvidenceSuggestion,
  Locale,
  Persona,
  WorkItem,
} from "../domain/types";

export type WorkView = "list" | "board" | "calendar" | "timeline";

type PrototypeContextValue = {
  readonly locale: Locale;
  readonly persona: Persona;
  readonly path: string;
  readonly workView: WorkView;
  readonly selectedWorkItemId: string | null;
  readonly workItems: readonly WorkItem[];
  readonly activities: readonly ActivityEvent[];
  readonly evidenceSuggestions: readonly EvidenceSuggestion[];
  readonly resolvedInboxIds: ReadonlySet<string>;
  readonly projects: typeof projects;
  readonly workstreams: typeof workstreams;
  readonly inboxItems: typeof inboxItems;
  readonly readinessFacts: typeof readinessFacts;
  readonly navigate: (path: string) => void;
  readonly setLocale: (locale: Locale) => void;
  readonly setPersona: (persona: Persona) => void;
  readonly setWorkView: (view: WorkView) => void;
  readonly openWorkItem: (id: string) => void;
  readonly closeWorkItem: () => void;
  readonly resolveInbox: (id: string) => void;
  readonly addWorkItem: (item: WorkItem) => void;
  readonly addActivity: (event: ActivityEvent) => void;
  readonly updateEvidence: (item: EvidenceSuggestion) => void;
};

const PrototypeContext = createContext<PrototypeContextValue | null>(null);

type PrototypeProviderProperties = {
  readonly children: ReactNode;
  readonly initialLocale: Locale;
  readonly initialPath: string;
};

function buildUrl(
  locale: Locale,
  path: string,
  persona: Persona,
  workView: WorkView,
  selectedWorkItemId: string | null,
) {
  const params = new URLSearchParams();
  if (persona === "manager") params.set("persona", persona);
  if (workView !== "list") params.set("view", workView);
  if (selectedWorkItemId !== null) params.set("workItem", selectedWorkItemId);
  const query = params.size === 0 ? "" : `?${params.toString()}`;
  return `/${locale}${path.length === 0 ? "" : `/${path}`}${query}`;
}

export function PrototypeProvider({
  children,
  initialLocale,
  initialPath,
}: PrototypeProviderProperties) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [persona, setPersonaState] = useState<Persona>("employee");
  const [path, setPath] = useState(initialPath);
  const [workView, setWorkViewState] = useState<WorkView>("list");
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);
  const [workItems, setWorkItems] = useState<readonly WorkItem[]>(initialWorkItems);
  const [activities, setActivities] = useState<readonly ActivityEvent[]>(initialActivityEvents);
  const [evidenceSuggestions, setEvidenceSuggestions] =
    useState<readonly EvidenceSuggestion[]>(initialEvidenceSuggestions);
  const [resolvedInboxIds, setResolvedInboxIds] = useState<ReadonlySet<string>>(new Set());

  const syncUrl = useCallback(
    (
      nextLocale = locale,
      nextPath = path,
      nextPersona = persona,
      nextView = workView,
      nextWorkItem = selectedWorkItemId,
    ) => {
      window.history.pushState(
        {},
        "",
        buildUrl(nextLocale, nextPath, nextPersona, nextView, nextWorkItem),
      );
    },
    [locale, path, persona, selectedWorkItemId, workView],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("persona") === "manager") setPersonaState("manager");
    const view = params.get("view");
    if (view === "board" || view === "calendar" || view === "timeline") {
      setWorkViewState(view);
    }
    setSelectedWorkItemId(params.get("workItem"));
  }, []);

  const value = useMemo<PrototypeContextValue>(
    () => ({
      locale,
      persona,
      path,
      workView,
      selectedWorkItemId,
      workItems,
      activities,
      evidenceSuggestions,
      resolvedInboxIds,
      projects,
      workstreams,
      inboxItems,
      readinessFacts,
      navigate(nextPath) {
        setPath(nextPath);
        syncUrl(locale, nextPath, persona, workView, selectedWorkItemId);
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
      setLocale(nextLocale) {
        setLocaleState(nextLocale);
        syncUrl(nextLocale, path, persona, workView, selectedWorkItemId);
      },
      setPersona(nextPersona) {
        setPersonaState(nextPersona);
        const nextPath = nextPersona === "manager" ? "manager" : "";
        setPath(nextPath);
        syncUrl(locale, nextPath, nextPersona, workView, selectedWorkItemId);
      },
      setWorkView(nextView) {
        setWorkViewState(nextView);
        syncUrl(locale, path, persona, nextView, selectedWorkItemId);
      },
      openWorkItem(id) {
        setSelectedWorkItemId(id);
        syncUrl(locale, path, persona, workView, id);
      },
      closeWorkItem() {
        setSelectedWorkItemId(null);
        syncUrl(locale, path, persona, workView, null);
      },
      resolveInbox(id) {
        setResolvedInboxIds((current) => new Set([...current, id]));
      },
      addWorkItem(item) {
        setWorkItems((current) => [item, ...current]);
      },
      addActivity(event) {
        setActivities((current) => [event, ...current]);
      },
      updateEvidence(item) {
        setEvidenceSuggestions((current) =>
          current.map((candidate) => (candidate.id === item.id ? item : candidate)),
        );
      },
    }),
    [
      activities,
      evidenceSuggestions,
      locale,
      path,
      persona,
      resolvedInboxIds,
      selectedWorkItemId,
      syncUrl,
      workItems,
      workView,
    ],
  );

  return <PrototypeContext value={value}>{children}</PrototypeContext>;
}

export function usePrototype(): PrototypeContextValue {
  const context = useContext(PrototypeContext);
  if (context === null) throw new Error("usePrototype must be used inside PrototypeProvider");
  return context;
}
