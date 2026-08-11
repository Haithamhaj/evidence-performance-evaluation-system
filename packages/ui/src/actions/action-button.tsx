"use client";

import { createElement, type ReactNode } from "react";
import { Button } from "react-aria-components/Button";

import styles from "./action-button.module.css";

const variantClassNames = {
  critical: styles.critical!,
  primary: styles.primary!,
  quiet: styles.quiet!,
  secondary: "",
} as const;

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
      className: `${styles.button!} ${variantClassNames[variant]}`.trim(),
      isDisabled,
      type,
    },
    children,
  );
}
