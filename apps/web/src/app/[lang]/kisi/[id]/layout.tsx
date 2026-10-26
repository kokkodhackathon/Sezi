import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { robots: { index: false } };

export default function PersonLayout({ children }: { children: ReactNode }) {
  return children;
}
