"use client";

import type { ReactNode } from "react";

import { LexiconProvider } from "@/contexts/LexiconContext";

export function AppProviders({ children }: { children: ReactNode }) {
  return <LexiconProvider>{children}</LexiconProvider>;
}
