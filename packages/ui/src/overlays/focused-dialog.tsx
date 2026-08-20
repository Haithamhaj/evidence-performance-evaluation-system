"use client";

import { createElement, type ReactNode } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components/Modal";

import styles from "./focused-dialog.module.css";

export type FocusedDialogProperties = Readonly<{
  children: ReactNode;
  closeLabel: string;
  layout?: "default" | "workspace";
  title: ReactNode;
  trigger: ReactNode;
}>;

export function FocusedDialog({
  children,
  closeLabel,
  layout = "default",
  title,
  trigger,
}: FocusedDialogProperties) {
  return createElement(
    DialogTrigger,
    null,
    trigger,
    createElement(
      ModalOverlay,
      {
        className: `${styles.overlay!} ${layout === "workspace" ? styles.workspaceOverlay! : ""}`,
        isDismissable: true,
      },
      createElement(
        Modal,
        {
          className: `${styles.modal!} ${layout === "workspace" ? styles.workspaceModal! : ""}`,
        },
        createElement(
          Dialog,
          { className: styles.dialog! },
          <>
            <header className={styles.header!}>
              {createElement(Heading, { className: styles.title!, slot: "title" }, title)}
              {createElement(
                Button,
                {
                  "aria-label": closeLabel,
                  className: styles.close!,
                  slot: "close",
                },
                <span aria-hidden="true">×</span>,
              )}
            </header>
            <div className={styles.content!}>{children}</div>
          </>,
        ),
      ),
    ),
  );
}
