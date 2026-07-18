"use client";

import { createElement, useEffect } from "react";

export function WorkItemDrawer({
  catalog,
  item,
  onClose,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  item: import("@evaluation/contracts").WorkItemDetail;
  onClose: () => void;
}>) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="drawerBackdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        aria-labelledby="work-item-title"
        aria-modal="true"
        className="workItemDrawer"
        role="dialog"
      >
        <header className="drawerHeader">
          <div>
            <span className={`statusBadge status-${item.status}`}>
              {catalog[`myWork.status.${item.status}`]}
            </span>
            <h2 id="work-item-title">{item.title}</h2>
          </div>
          <button autoFocus className="quietButton" onClick={onClose} type="button">
            {catalog["actions.close"]}
          </button>
        </header>
        <p>{item.description}</p>
        {item.nextAction === null ? null : (
          <section className="drawerSection">
            <h3>{catalog["myWork.nextAction"]}</h3>
            <p>{item.nextAction}</p>
          </section>
        )}
        {item.blocker === null ? null : (
          <section className="drawerSection blockerSection">
            <h3>{catalog["myWork.blocker"]}</h3>
            <p>{item.blocker}</p>
          </section>
        )}
        {createElement(ListSection, {
          empty: catalog["myWork.empty"],
          heading: catalog["myWork.requirements"],
          values: item.requirements,
        })}
        {createElement(ListSection, {
          empty: catalog["myWork.empty"],
          heading: catalog["myWork.acceptance"],
          values: item.acceptanceConditions,
        })}
      </aside>
    </div>
  );
}

function ListSection({
  empty,
  heading,
  values,
}: Readonly<{ empty: string; heading: string; values: readonly string[] }>) {
  return (
    <section className="drawerSection">
      <h3>{heading}</h3>
      {values.length === 0 ? (
        <p>{empty}</p>
      ) : (
        <ul>
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
