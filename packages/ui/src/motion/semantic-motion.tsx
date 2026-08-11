"use client";

import { MotionConfig } from "motion/react";
import { createElement, type ReactNode } from "react";

export type SemanticMotionProviderProperties = Readonly<{
  children: ReactNode;
}>;

export function SemanticMotionProvider({ children }: SemanticMotionProviderProperties) {
  return createElement(MotionConfig, { reducedMotion: "user" }, children);
}
