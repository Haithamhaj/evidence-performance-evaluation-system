import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Daily Work Prototype",
  description: "Synthetic Product Direction Reset acceptance prototype.",
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
