"use client";

import { createElement, type ReactNode } from "react";
import { Button, Disclosure, DisclosurePanel } from "react-aria-components/Disclosure";

import styles from "./product-disclosure.module.css";

export type ProductDisclosureProperties = Readonly<{
  children: ReactNode;
  defaultExpanded?: boolean;
  title: ReactNode;
}>;

export function ProductDisclosure({
  children,
  defaultExpanded = false,
  title,
}: ProductDisclosureProperties) {
  return createElement(
    Disclosure,
    { className: styles.disclosure!, defaultExpanded },
    createElement(
      Button,
      { className: styles.trigger!, slot: "trigger" },
      <>
        <span>{title}</span>
        <span aria-hidden="true" className={styles.indicator!}>
          ▾
        </span>
      </>,
    ),
    createElement(DisclosurePanel, { children, className: styles.panel! }),
  );
}
