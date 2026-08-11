"use client";

import { createElement, type ReactNode } from "react";
import { Button } from "react-aria-components/Button";

import styles from "./action-button.module.css";

export type ActionButtonProperties = Readonly<{
  "aria-label"?: string;
  children: ReactNode;
  form?: string;
  isDisabled?: boolean;
  onPress?: () => void;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "quiet" | "critical";
}>;

export function ActionButton({
  children,
  isDisabled = false,
  onPress,
  type = "button",
  variant = "secondary",
  ...properties
}: ActionButtonProperties) {
  return createElement(
    Button,
    {
      ...properties,
      ...(onPress === undefined ? {} : { onPress }),
      className: `${styles.button!} ${styles[variant]!}`,
      isDisabled,
      type,
    },
    children,
  );
}
