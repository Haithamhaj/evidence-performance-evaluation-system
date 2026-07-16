import type { ReactNode } from "react";

export type BidiTextKind = "auto-isolate" | "code" | "url" | "email" | "model" | "path" | "hash";

export interface BidiTextProperties {
  readonly children: ReactNode;
  readonly kind: BidiTextKind;
}

export function BidiText({ children, kind }: BidiTextProperties) {
  if (kind === "auto-isolate") {
    return <bdi data-bidi-kind={kind}>{children}</bdi>;
  }

  return (
    <bdi dir="ltr" data-bidi-kind={kind}>
      {children}
    </bdi>
  );
}
