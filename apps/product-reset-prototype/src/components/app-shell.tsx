"use client";

import type { ReactNode } from "react";

import { usePrototype } from "../app/prototype-store";
import { copy, type CatalogKey } from "../i18n/catalog";
import { Icon } from "./icon";

type AppShellProperties = {
  readonly children: ReactNode;
  readonly onQuickAdd: () => void;
  readonly onQuickUpdate: () => void;
};

const employeeNav = [
  { path: "", key: "nav.myWork", icon: "home" },
  { path: "inbox", key: "nav.inbox", icon: "inbox" },
  { path: "projects", key: "nav.projects", icon: "projects" },
  { path: "evidence", key: "nav.evidence", icon: "evidence" },
  { path: "readiness", key: "nav.readiness", icon: "readiness" },
] as const;
const managerNav = [
  { path: "manager", key: "nav.operations", icon: "operations" },
  { path: "projects", key: "nav.projects", icon: "projects" },
  { path: "inbox", key: "nav.actions", icon: "inbox" },
  { path: "readiness", key: "nav.readiness", icon: "readiness" },
  { path: "readiness", key: "nav.evaluations", icon: "evidence" },
] as const;

export function AppShell({ children, onQuickAdd, onQuickUpdate }: AppShellProperties) {
  const { locale, navigate, path, persona, setLocale, setPersona } = usePrototype();
  const nav = persona === "employee" ? employeeNav : managerNav;

  return (
    <div className="prototypeShell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brandMark" aria-hidden="true">
            و
          </span>
          <div>
            <strong>{locale === "ar" ? "وضوح" : "Wuduh"}</strong>
            <span>{locale === "ar" ? "مساحة العمل اليومية" : "Daily work space"}</span>
          </div>
        </div>
        <p className="prototypePill">
          <span aria-hidden="true">●</span> {copy(locale, "prototype.synthetic")}
        </p>
        <nav className="sideNav" aria-label={copy(locale, "a11y.primaryNavigation")}>
          {nav.map((item) => (
            <button
              className={path === item.path ? "navItem isActive" : "navItem"}
              key={`${persona}-${item.key}`}
              onClick={() => navigate(item.path)}
              type="button"
            >
              <Icon name={item.icon} />
              <span>{copy(locale, item.key)}</span>
            </button>
          ))}
        </nav>
        <div className="sidebarFooter">{copy(locale, "prototype.notice")}</div>
      </aside>
      <div className="workspace">
        <header className="utilityBar">
          <div
            className="segmentedControl"
            role="group"
            aria-label={copy(locale, "a11y.personaSwitch")}
          >
            {(["employee", "manager"] as const).map((candidate) => (
              <button
                aria-pressed={persona === candidate}
                className={persona === candidate ? "isSelected" : ""}
                key={candidate}
                onClick={() => setPersona(candidate)}
                type="button"
              >
                {copy(locale, `persona.${candidate}` as CatalogKey)}
              </button>
            ))}
          </div>
          <div className="utilityActions">
            <button
              className="ghostButton"
              onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
              type="button"
            >
              {copy(locale, locale === "ar" ? "actions.switchEnglish" : "actions.switchArabic")}
            </button>
            <button className="ghostButton" onClick={onQuickUpdate} type="button">
              <Icon name="spark" />
              {copy(locale, "actions.quickUpdate")}
            </button>
            <button className="primaryButton" onClick={onQuickAdd} type="button">
              <Icon name="plus" />
              {copy(locale, "actions.quickAdd")}
            </button>
          </div>
        </header>
        <main className="content" id="main-content">
          {children}
        </main>
        <nav className="mobileNav" aria-label={copy(locale, "a11y.primaryNavigation")}>
          {nav.map((item) => (
            <button
              className={path === item.path ? "isActive" : ""}
              key={`mobile-${persona}-${item.key}`}
              onClick={() => navigate(item.path)}
              type="button"
            >
              <Icon name={item.icon} />
              <span>{copy(locale, item.key)}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
